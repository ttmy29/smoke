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

const STORAGE_KEY = 'smoke.progress.v1';

function isProgressSaveV1(value: unknown): value is ProgressSaveV1 {
  if (!value || typeof value !== 'object') return false;
  const save = value as Partial<ProgressSaveV1>;
  return save.version === 1 && Number.isSafeInteger(save.smokedCigarettes)
    && (save.smokedCigarettes ?? -1) >= 0
    && (save.lastCompletedSessionId === null
      || (typeof save.lastCompletedSessionId === 'string' && save.lastCompletedSessionId.length > 0));
}

export class ProgressStore {
  constructor(private readonly storage: KeyValueStorage | null) {}

  /** Null means storage is unavailable or invalid, not that the count is zero. */
  public readSmokedCount(): number | null {
    try {
      return this.readSave().smokedCigarettes;
    } catch {
      return null;
    }
  }

  /** Completed natural and extinguished sessions both count; repeat delivery is idempotent. */
  public recordCompletedCigarette(sessionId: string): number | null {
    if (!sessionId) return null;
    try {
      const current = this.readSave();
      if (current.lastCompletedSessionId === sessionId) return current.smokedCigarettes;
      if (current.smokedCigarettes >= Number.MAX_SAFE_INTEGER) return null;
      const next: ProgressSaveV1 = {
        version: 1,
        smokedCigarettes: current.smokedCigarettes + 1,
        lastCompletedSessionId: sessionId,
      };
      const encoded = JSON.stringify(next);
      this.storage!.setItem(STORAGE_KEY, encoded);
      return this.storage!.getItem(STORAGE_KEY) === encoded ? next.smokedCigarettes : null;
    } catch {
      return null;
    }
  }

  private readSave(): ProgressSaveV1 {
    if (!this.storage) throw new Error('LOCAL_STORAGE_UNAVAILABLE');
    const raw = this.storage.getItem(STORAGE_KEY);
    if (raw === null) return { version: 1, smokedCigarettes: 0, lastCompletedSessionId: null };
    const parsed: unknown = JSON.parse(raw);
    if (!isProgressSaveV1(parsed)) throw new Error('INVALID_PROGRESS_SAVE');
    return parsed;
  }
}

export function createBrowserProgressStore(): ProgressStore {
  try {
    return new ProgressStore(window.localStorage);
  } catch {
    return new ProgressStore(null);
  }
}
