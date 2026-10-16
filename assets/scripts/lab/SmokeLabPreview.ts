import { DEFAULT_SMOKE_SCHEME, LabContext, LabInteraction, LabScope, SmokeScheme, validScheme } from './SmokeLabModel';
import type { LabSnapshot } from '../persistence/SmokeLabStore';

interface PreviewRecord { scheme: SmokeScheme; source: LabScope | 'default'; }
/** UI-only state for this app run. Has no storage, daily grant or renderer dependency. */
export class SmokeLabPreview {
  private global: PreviewRecord | null = null;
  private types = new Map<string, PreviewRecord>();
  private boxes = new Map<string, { typeId: string; record: PreviewRecord }>();
  private interaction: LabInteraction | null = null;
  private access = new Set<string>();

  public resolve(snapshot: LabSnapshot | null): LabSnapshot | null {
    if (!snapshot) return null;
    const c = snapshot.context;
    const record = (c.boxId ? this.boxes.get(c.boxId)?.record : null) ?? this.types.get(c.typeId) ?? this.global;
    return { ...snapshot, context: { ...c }, scheme: { ...(record?.scheme ?? snapshot.scheme) },
      source: record?.source ?? snapshot.source, interaction: { ...(this.interaction ?? snapshot.interaction) } };
  }

  public save(scope: LabScope, scheme: SmokeScheme, context: LabContext): boolean {
    if (!validScheme(scheme)) return false;
    return this.set(scope, context, { scheme: { ...scheme }, source: scope });
  }
  public restore(scope: LabScope, context: LabContext): boolean {
    return this.set(scope, context, { scheme: { ...DEFAULT_SMOKE_SCHEME }, source: 'default' });
  }
  public setInteraction(interaction: LabInteraction): void { this.interaction = { ...interaction }; }
  public grant(id: string): void { this.access.add(id); }
  public granted(id: string): boolean { return this.access.has(id); }

  private set(scope: LabScope, context: LabContext, record: PreviewRecord): boolean {
    if (scope === 'box') {
      if (!context.boxId) return false;
      this.boxes.set(context.boxId, { typeId: context.typeId, record });
    } else if (scope === 'type') {
      if (!context.typeId) return false;
      this.types.set(context.typeId, record);
      this.boxes.forEach((box, id) => { if (box.typeId === context.typeId) this.boxes.delete(id); });
    } else if (scope === 'global') { this.global = record; this.types.clear(); this.boxes.clear(); }
    else return false;
    return true;
  }
}
