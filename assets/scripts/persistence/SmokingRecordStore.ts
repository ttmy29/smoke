import type { SessionSnapshot } from '../domain/SessionModel';
import type { KeyValueStorage } from './ProgressStore';

export const SMOKING_RECORD_STORAGE_KEY = 'smoke.records.v1';

export interface SmokingRecord {
  id: string;
  packId: 'wang-xi';
  slotIndex: number;
  endedAt: number;
  durationSeconds: number;
  outcome: 'finished' | 'extinguished';
  puffs: number;
  ashFlicks: number;
  rings: number;
}

export interface SmokingRecordSave {
  version: 1;
  sessions: SmokingRecord[];
  totalCount: number;
  totalPuffs: number;
  totalDurationSeconds: number;
  totalAshFlicks: number;
  totalRings: number;
  dayCounts: Record<string, number>;
  packPriceCents: number | null;
}

export function recordDay(at: number): string {
  const date = new Date(at);
  const two = (value: number): string => value < 10 ? `0${value}` : String(value);
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
}

function count(value: unknown): value is number { return Number.isSafeInteger(value) && (value as number) >= 0; }

function validRecord(value: SmokingRecord): boolean {
  return !!value && typeof value.id === 'string' && value.id.length > 0 && value.packId === 'wang-xi'
    && count(value.slotIndex) && value.slotIndex < 10 && Number.isFinite(value.endedAt) && value.endedAt > 0
    && Number.isFinite(value.durationSeconds) && value.durationSeconds >= 0
    && ['finished', 'extinguished'].indexOf(value.outcome) >= 0
    && [value.puffs, value.ashFlicks, value.rings].every(count);
}

function empty(): SmokingRecordSave {
  return { version: 1, sessions: [], totalCount: 0, totalPuffs: 0, totalDurationSeconds: 0,
    totalAshFlicks: 0, totalRings: 0, dayCounts: {}, packPriceCents: null };
}

/** New session evidence only. Legacy lifetime totals are never expanded into invented rows. */
export class SmokingRecordStore {
  constructor(private readonly storage: KeyValueStorage | null) {}

  public read(): SmokingRecordSave | null {
    try {
      if (!this.storage) return null;
      const raw = this.storage.getItem(SMOKING_RECORD_STORAGE_KEY);
      if (raw === null) return empty();
      const save = JSON.parse(raw) as SmokingRecordSave;
      if (!save || save.version !== 1 || !Array.isArray(save.sessions) || save.sessions.length > 500
        || !save.sessions.every(validRecord) || new Set(save.sessions.map((item) => item.id)).size !== save.sessions.length
        || ![save.totalCount, save.totalPuffs, save.totalAshFlicks, save.totalRings].every(count)
        || save.totalCount < save.sessions.length || !Number.isFinite(save.totalDurationSeconds)
        || save.totalDurationSeconds < 0 || !save.dayCounts || typeof save.dayCounts !== 'object'
        || Array.isArray(save.dayCounts) || !Object.keys(save.dayCounts).every((day) =>
          /^\d{4}-\d{2}-\d{2}$/.test(day) && count(save.dayCounts[day]))
        || !(save.packPriceCents === null || (count(save.packPriceCents) && save.packPriceCents >= 1
          && save.packPriceCents <= 1000000))) return null;
      return save;
    } catch { return null; }
  }

  public recordSession(id: string, slotIndex: number, snapshot: Readonly<SessionSnapshot>, endedAt = Date.now()): boolean {
    const record: SmokingRecord = { id, slotIndex, endedAt, packId: 'wang-xi',
      durationSeconds: snapshot.elapsedSeconds, outcome: snapshot.outcome!, puffs: snapshot.inhaleCount,
      ashFlicks: snapshot.ashFlickCount, rings: snapshot.smokeRingCount };
    if (!validRecord(record)) return false;
    const save = this.read();
    if (!save) return false;
    if (save.sessions.some((item) => item.id === id)) return true;
    const day = recordDay(endedAt);
    return this.write({ ...save, sessions: [...save.sessions, record].slice(-500),
      totalCount: save.totalCount + 1, totalPuffs: save.totalPuffs + record.puffs,
      totalDurationSeconds: save.totalDurationSeconds + record.durationSeconds,
      totalAshFlicks: save.totalAshFlicks + record.ashFlicks, totalRings: save.totalRings + record.rings,
      dayCounts: { ...save.dayCounts, [day]: (save.dayCounts[day] ?? 0) + 1 } });
  }

  public setPackPrice(cents: number | null): boolean {
    if (cents !== null && (!count(cents) || cents < 1 || cents > 1000000)) return false;
    const save = this.read();
    return !!save && this.write({ ...save, packPriceCents: cents });
  }

  private write(save: SmokingRecordSave): boolean {
    try {
      if (!this.storage) return false;
      const encoded = JSON.stringify(save);
      this.storage.setItem(SMOKING_RECORD_STORAGE_KEY, encoded);
      return this.storage.getItem(SMOKING_RECORD_STORAGE_KEY) === encoded;
    } catch { return false; }
  }
}

export function createBrowserSmokingRecordStore(): SmokingRecordStore {
  try { return new SmokingRecordStore(window.localStorage); }
  catch { return new SmokingRecordStore(null); }
}
