/** The browser adapter can later be replaced without changing session or UI code. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface ProgressSaveV1 {
  version: 1;
  smokedCigarettes: number;
  lastCompletedSessionId: string | null;
}

interface ProgressSaveV2 {
  version: 2;
  smokedCigarettes: number;
  lastCompletedSessionId: string | null;
  lastCompletedAt: number | null;
  day: string;
  todaySmoked: number | null;
}

export interface HomeSmokingStatus {
  lastCompletedAt: number | null;
  todaySmoked: number | null;
  /** V1 held only a lifetime total, so the date of earlier sessions is unknown. */
  historyUnknown: boolean;
}

const STORAGE_KEY_V1 = 'smoke.progress.v1';
const STORAGE_KEY_V2 = 'smoke.progress.v2';

function localDay(now: number): string {
  const date = new Date(now);
  const two = (value: number): string => value < 10 ? `0${value}` : String(value);
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
}

function isProgressSaveV1(value: unknown): value is ProgressSaveV1 {
  if (!value || typeof value !== 'object') return false;
  const save = value as Partial<ProgressSaveV1>;
  return save.version === 1 && Number.isSafeInteger(save.smokedCigarettes)
    && (save.smokedCigarettes ?? -1) >= 0
    && (save.lastCompletedSessionId === null
      || (typeof save.lastCompletedSessionId === 'string' && save.lastCompletedSessionId.length > 0));
}

function isProgressSaveV2(value: unknown): value is ProgressSaveV2 {
  if (!value || typeof value !== 'object') return false;
  const save = value as Partial<ProgressSaveV2>;
  return save.version === 2 && Number.isSafeInteger(save.smokedCigarettes)
    && (save.smokedCigarettes ?? -1) >= 0
    && (save.lastCompletedSessionId === null
      || (typeof save.lastCompletedSessionId === 'string' && save.lastCompletedSessionId.length > 0))
    && (save.lastCompletedAt === null
      || (Number.isFinite(save.lastCompletedAt) && (save.lastCompletedAt ?? -1) >= 0))
    && typeof save.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(save.day)
    && (save.todaySmoked === null || (Number.isSafeInteger(save.todaySmoked)
      && (save.todaySmoked ?? -1) >= 0 && save.todaySmoked <= save.smokedCigarettes));
}

export class ProgressStore {
  constructor(private readonly storage: KeyValueStorage | null) {}

  /** Null means storage is unavailable or invalid, not that the count is zero. */
  public readSmokedCount(): number | null {
    try {
      return this.readSave(Date.now()).smokedCigarettes;
    } catch {
      return null;
    }
  }

  /** Null means storage is unavailable/corrupt; V1 history is deliberately not guessed. */
  public readHomeSmokingStatus(now = Date.now()): HomeSmokingStatus | null {
    try {
      const save = this.readSave(now);
      return {
        lastCompletedAt: save.lastCompletedAt,
        todaySmoked: save.day === localDay(now) ? save.todaySmoked : 0,
        historyUnknown: save.smokedCigarettes > 0 && save.lastCompletedAt === null,
      };
    } catch {
      return null;
    }
  }

  /** Completed natural and extinguished sessions both count; repeat delivery is idempotent. */
  public recordCompletedCigarette(sessionId: string, now = Date.now()): number | null {
    if (!sessionId || !Number.isFinite(now) || now < 0) return null;
    try {
      const current = this.readSave(now);
      if (current.lastCompletedSessionId === sessionId) return current.smokedCigarettes;
      if (current.smokedCigarettes >= Number.MAX_SAFE_INTEGER) return null;
      const day = localDay(now);
      const today = current.day === day ? current.todaySmoked : 0;
      const next: ProgressSaveV2 = {
        version: 2,
        smokedCigarettes: current.smokedCigarettes + 1,
        lastCompletedSessionId: sessionId,
        lastCompletedAt: now,
        day,
        todaySmoked: today === null ? null : today + 1,
      };
      const encoded = JSON.stringify(next);
      this.storage!.setItem(STORAGE_KEY_V2, encoded);
      return this.storage!.getItem(STORAGE_KEY_V2) === encoded ? next.smokedCigarettes : null;
    } catch {
      return null;
    }
  }

  private readSave(now: number): ProgressSaveV2 {
    if (!this.storage) throw new Error('LOCAL_STORAGE_UNAVAILABLE');
    const currentRaw = this.storage.getItem(STORAGE_KEY_V2);
    if (currentRaw !== null) {
      const current: unknown = JSON.parse(currentRaw);
      if (!isProgressSaveV2(current)) throw new Error('INVALID_PROGRESS_SAVE_V2');
      return current;
    }
    const previousRaw = this.storage.getItem(STORAGE_KEY_V1);
    if (previousRaw !== null) {
      const previous: unknown = JSON.parse(previousRaw);
      if (!isProgressSaveV1(previous)) throw new Error('INVALID_PROGRESS_SAVE_V1');
      const migrated: ProgressSaveV2 = {
        version: 2,
        smokedCigarettes: previous.smokedCigarettes,
        lastCompletedSessionId: previous.lastCompletedSessionId,
        lastCompletedAt: null,
        day: localDay(now),
        todaySmoked: previous.smokedCigarettes === 0 ? 0 : null,
      };
      const encoded = JSON.stringify(migrated);
      this.storage.setItem(STORAGE_KEY_V2, encoded);
      if (this.storage.getItem(STORAGE_KEY_V2) !== encoded) throw new Error('PROGRESS_MIGRATION_FAILED');
      return migrated;
    }
    return { version: 2, smokedCigarettes: 0, lastCompletedSessionId: null,
      lastCompletedAt: null, day: localDay(now), todaySmoked: 0 };
  }
}

export function createBrowserProgressStore(): ProgressStore {
  try {
    return new ProgressStore(window.localStorage);
  } catch {
    return new ProgressStore(null);
  }
}
