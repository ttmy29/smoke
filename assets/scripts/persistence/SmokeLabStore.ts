import type { KeyValueStorage } from './ProgressStore';
import { recordDay } from './SmokingRecordStore';
import { DEFAULT_SMOKE_SCHEME, LabContext, LabInteraction, LabRuntime, LabScope, placementFor,
  RING_FORMATIONS, RING_SHAPES, SCHEME_FIELDS, SmokeScheme, validScheme } from '../lab/SmokeLabModel';

export const SMOKE_LAB_STORAGE_KEY = 'smoke.lab.v1';
interface SchemeRecord { mode: 'default' | 'custom'; scheme?: SmokeScheme; }
interface LabSave {
  version: 1; global: SchemeRecord; types: Record<string, SchemeRecord>;
  boxes: Record<string, { typeId: string; record: SchemeRecord }>;
  interaction: LabInteraction;
  access: { day: string; grants: Record<string, boolean>; discovered: Record<string, boolean> };
}
export interface LabSnapshot {
  context: LabContext; days: number; scheme: SmokeScheme; source: LabScope | 'default';
  interaction: LabInteraction; day: string;
}
function fresh(): LabSave {
  return { version: 1, global: { mode: 'default' }, types: {}, boxes: {},
    interaction: { handSmoke: false, formationEnabled: false, formation: 'tunnel' },
    access: { day: '', grants: {}, discovered: {} } };
}
function object(v: unknown): v is Record<string, any> { return !!v && typeof v === 'object' && !Array.isArray(v); }
function record(v: unknown): v is SchemeRecord {
  return object(v) && (v.mode === 'default' ? v.scheme === undefined : v.mode === 'custom' && validScheme(v.scheme));
}
const COLOR_PLACEMENTS = ['lab:idle', 'lab:exhale-color', 'lab:ring-color', 'lab:style'];
function validPlacement(id: string): boolean {
  return COLOR_PLACEMENTS.indexOf(id) >= 0 || id === 'ring:unlimited'
    || RING_SHAPES.some((o) => o.id !== 'circle' && `ring:${o.id}` === id)
    || RING_FORMATIONS.some((o) => `formation:${o.id}` === id);
}
/** Scheme scope and daily access are validated here, never trusted from button state alone. */
export class SmokeLabStore {
  constructor(private readonly storage: KeyValueStorage | null,
    private readonly readContext: () => LabContext | null,
    private readonly readDays: () => number | null,
    private readonly completedTasks: () => readonly string[] = () => []) {}

  private read(): LabSave | null {
    try {
      if (!this.storage) return null;
      const raw = this.storage.getItem(SMOKE_LAB_STORAGE_KEY);
      if (raw === null) return fresh();
      const s = JSON.parse(raw) as LabSave;
      if (!s || s.version !== 1 || !record(s.global) || !object(s.types) || !object(s.boxes)
        || !Object.keys(s.types).every((id) => record(s.types[id]))
        || !Object.keys(s.boxes).every((id) => object(s.boxes[id]) && typeof s.boxes[id].typeId === 'string' && record(s.boxes[id].record))
        || !object(s.interaction) || typeof s.interaction.handSmoke !== 'boolean'
        || typeof s.interaction.formationEnabled !== 'boolean' || !RING_FORMATIONS.some((o) => o.id === s.interaction.formation)
        || !object(s.access) || typeof s.access.day !== 'string' || !object(s.access.grants) || !object(s.access.discovered)
        || ![s.access.grants, s.access.discovered].every((map) => Object.keys(map).every((id) => validPlacement(id) && map[id] === true))) return null;
      return s;
    } catch { return null; }
  }

  private resolve(save: LabSave, context: LabContext): { scheme: SmokeScheme; source: LabSnapshot['source'] } {
    const box = context.boxId ? save.boxes[context.boxId] : undefined;
    const type = Object.prototype.hasOwnProperty.call(save.types, context.typeId) ? save.types[context.typeId] : undefined;
    const selected = box?.record ?? type ?? save.global;
    return { scheme: { ...(selected.mode === 'custom' ? selected.scheme! : DEFAULT_SMOKE_SCHEME) },
      source: selected.mode === 'default' ? 'default' : box ? 'box' : type ? 'type' : 'global' };
  }

  public snapshot(now = Date.now()): LabSnapshot | null {
    const s = this.read(), context = this.readContext(), days = this.readDays();
    if (!s || !context || days === null) return null;
    return { context, days, ...this.resolve(s, context), interaction: { ...s.interaction }, day: recordDay(now) };
  }

  public eligible(id: string): boolean {
    if (!validPlacement(id)) return false;
    if (id.indexOf('ring:') !== 0 || id === 'ring:unlimited') return true;
    const option = RING_SHAPES.find((o) => `ring:${o.id}` === id);
    return !!option && !option.national && (!option.task || this.completedTasks().indexOf(option.task) >= 0);
  }

  public granted(id: string, now = Date.now()): boolean {
    if (id === 'ring:circle') return true;
    const save = this.read();
    return !!save && this.eligible(id) && save.access.day === recordDay(now) && save.access.grants[id] === true;
  }

  public groupState(group: 'ring' | 'formation', now = Date.now()): { count: number; total: number; complete: boolean; granted: boolean } {
    const options = group === 'ring' ? RING_SHAPES.filter((o) => o.id !== 'circle') : RING_FORMATIONS;
    const members = options.map((o) => `${group}:${o.id}`).filter((id) => this.eligible(id));
    const save = this.read();
    const count = members.filter((id) => save?.access.discovered[id]).length;
    return { count, total: members.length, complete: count === members.length,
      granted: members.every((id) => this.granted(id, now)) };
  }

  /** Called only after an explicit successful adapter result; a stale-day completion grants nothing. */
  public grantAccess(id: string, requestedDay: string, now = Date.now()): boolean {
    const save = this.read();
    if (!save || requestedDay !== recordDay(now) || (this.readDays() ?? 0) < 2) return false;
    if (save.access.day !== requestedDay) save.access = { ...save.access, day: requestedDay, grants: {} };
    if (id === 'group:ring' || id === 'group:formation') {
      const group = id === 'group:ring' ? 'ring' : 'formation';
      if (group === 'formation' && !this.granted('ring:unlimited', now)) return false;
      if (!this.groupState(group, now).complete) return false;
      const options = group === 'ring' ? RING_SHAPES : RING_FORMATIONS;
      options.map((o) => `${group}:${o.id}`).filter((p) => this.eligible(p)).forEach((p) => { save.access.grants[p] = true; });
    } else {
      if (!this.eligible(id) || (id.indexOf('formation:') === 0 && !this.granted('ring:unlimited', now))) return false;
      save.access.grants[id] = true; save.access.discovered[id] = true;
      const prefix = id.indexOf('formation:') === 0 ? 'formation' : id.indexOf('ring:') === 0 && id !== 'ring:unlimited' ? 'ring' : null;
      if (prefix) {
        const members = (prefix === 'ring' ? RING_SHAPES : RING_FORMATIONS).map((o) => `${prefix}:${o.id}`).filter((p) => this.eligible(p));
        if (members.every((p) => save.access.discovered[p])) members.forEach((p) => { save.access.grants[p] = true; });
      }
    }
    return this.write(save);
  }

  public save(scope: LabScope, scheme: SmokeScheme, expectedBox: string | null, now = Date.now()): boolean {
    const save = this.read(), context = this.readContext();
    if (!save || !context || context.boxId !== expectedBox || (this.readDays() ?? 0) < 2 || !validScheme(scheme)) return false;
    const current = this.resolve(save, context).scheme;
    const target = scope === 'global' ? save.global : scope === 'type' ? save.types[context.typeId] : undefined;
    const previous = target?.mode === 'custom' ? target.scheme! : DEFAULT_SMOKE_SCHEME;
    if (SCHEME_FIELDS.some((field) => {
      if (scheme[field] === current[field] && (scope === 'box' || scheme[field] === previous[field])) return false;
      if (scheme[field].indexOf('zuguo-') === 0 || scheme[field] === 'text') return true;
      return !this.granted(placementFor(field, scheme), now);
    })) return false;
    return this.setScope(save, context, scope, { mode: 'custom', scheme: { ...scheme } });
  }

  public restore(scope: LabScope, expectedBox: string | null): boolean {
    const save = this.read(), context = this.readContext();
    if (!save || !context || context.boxId !== expectedBox || (this.readDays() ?? 0) < 2) return false;
    return this.setScope(save, context, scope, { mode: 'default' });
  }

  public setInteraction(change: Partial<LabInteraction>, now = Date.now()): boolean {
    const save = this.read(), days = this.readDays();
    if (!save || days === null || days < 2) return false;
    const next = { ...save.interaction, ...change };
    if (typeof next.handSmoke !== 'boolean' || typeof next.formationEnabled !== 'boolean'
      || next.handSmoke && days < 4 || !RING_FORMATIONS.some((o) => o.id === next.formation)) return false;
    if ((change.formation !== undefined || change.formationEnabled === true)
      && (!this.granted('ring:unlimited', now) || !this.granted(`formation:${next.formation}`, now))) return false;
    save.interaction = next;
    return this.write(save);
  }

  public runtime(now = Date.now()): LabRuntime | null {
    const snapshot = this.snapshot(now);
    if (!snapshot) return null;
    const i = snapshot.interaction;
    const unlimited = this.granted('ring:unlimited', now);
    return { scheme: snapshot.scheme, days: snapshot.days, handSmoke: snapshot.days >= 4 && i.handSmoke,
      directionalRing: snapshot.days >= 3, unlimitedRings: unlimited,
      formation: snapshot.days >= 2 && unlimited && i.formationEnabled && this.granted(`formation:${i.formation}`, now) ? i.formation : null };
  }

  private setScope(save: LabSave, context: LabContext, scope: LabScope, value: SchemeRecord): boolean {
    if (scope === 'box') {
      if (!context.boxId) return false;
      save.boxes[context.boxId] = { typeId: context.typeId, record: value };
    } else if (scope === 'type') {
      if (!context.typeId) return false;
      save.types[context.typeId] = value;
      Object.keys(save.boxes).forEach((id) => { if (save.boxes[id].typeId === context.typeId) delete save.boxes[id]; });
    } else if (scope === 'global') { save.global = value; save.boxes = {}; save.types = {}; }
    else return false;
    return this.write(save);
  }

  private write(save: LabSave): boolean {
    try {
      if (!this.storage) return false;
      // Old boxes can no longer be selected in this single-pack project; bound retained history.
      const ids = Object.keys(save.boxes);
      while (ids.length > 128) delete save.boxes[ids.shift()!];
      const encoded = JSON.stringify(save);
      this.storage.setItem(SMOKE_LAB_STORAGE_KEY, encoded);
      return this.storage.getItem(SMOKE_LAB_STORAGE_KEY) === encoded;
    } catch { return false; }
  }
}
