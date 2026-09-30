import type { KeyValueStorage } from './ProgressStore';

export const CHECK_IN_STORAGE_KEY = 'smoke.check-in.v1';

interface CheckInSave {
  version: 1;
  cumulativeDays: number;
  streak: number;
  lastCheckinDay: string | null;
  lastExtraTicketDay: string | null;
  ticketBalance: number;
  /** Makes an interrupted ticket refill safe to retry. */
  lastRefillTransactionId?: string;
}

export interface CheckInSnapshot {
  cumulativeDays: number;
  streak: number;
  checkedToday: boolean;
  extraTicketClaimed: boolean;
  ticketBalance: number;
}

export type CheckInResult = 'checked' | 'already-checked' | 'failed';

function localDay(now: number): string {
  const date = new Date(now);
  const two = (value: number): string => value < 10 ? `0${value}` : String(value);
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
}

function previousDay(day: string): string {
  const [year, month, date] = day.split('-').map(Number);
  return localDay(new Date(year, month - 1, date - 1).getTime());
}

function validDay(day: unknown): day is string {
  return typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day);
}

function validSave(value: unknown): value is CheckInSave {
  if (!value || typeof value !== 'object') return false;
  const save = value as Partial<CheckInSave>;
  return save.version === 1
    && Number.isSafeInteger(save.cumulativeDays) && (save.cumulativeDays ?? -1) >= 0
    && Number.isSafeInteger(save.streak) && (save.streak ?? -1) >= 0
    && save.streak <= save.cumulativeDays
    && (save.lastCheckinDay === null || validDay(save.lastCheckinDay))
    && (save.lastExtraTicketDay === null || validDay(save.lastExtraTicketDay))
    && Number.isSafeInteger(save.ticketBalance) && (save.ticketBalance ?? -1) >= 0
    && (save.lastRefillTransactionId === undefined
      || (typeof save.lastRefillTransactionId === 'string' && save.lastRefillTransactionId.length > 0));
}

const EMPTY_SAVE: CheckInSave = {
  version: 1, cumulativeDays: 0, streak: 0,
  lastCheckinDay: null, lastExtraTicketDay: null, ticketBalance: 0,
};

export class CheckInStore {
  constructor(private readonly storage: KeyValueStorage | null) {}

  public readSnapshot(now = Date.now()): CheckInSnapshot | null {
    try {
      const save = this.readSave();
      const today = localDay(now);
      return {
        cumulativeDays: save.cumulativeDays,
        streak: save.lastCheckinDay === today || save.lastCheckinDay === previousDay(today)
          ? save.streak : 0,
        checkedToday: save.lastCheckinDay === today,
        extraTicketClaimed: save.lastExtraTicketDay === today,
        ticketBalance: save.ticketBalance,
      };
    } catch {
      return null;
    }
  }

  public checkInToday(now = Date.now()): CheckInResult {
    try {
      const save = this.readSave();
      const today = localDay(now);
      if (save.lastCheckinDay === today) return 'already-checked';
      if (save.ticketBalance >= Number.MAX_SAFE_INTEGER
        || save.cumulativeDays >= Number.MAX_SAFE_INTEGER) return 'failed';
      const next: CheckInSave = {
        ...save,
        cumulativeDays: save.cumulativeDays + 1,
        streak: save.lastCheckinDay === previousDay(today) ? save.streak + 1 : 1,
        lastCheckinDay: today,
        ticketBalance: save.ticketBalance + 1,
      };
      return this.writeSave(next) ? 'checked' : 'failed';
    } catch {
      return 'failed';
    }
  }

  /** Only call this after the rewarded-ad adapter reports completion. */
  public claimExtraTicket(now = Date.now()): boolean {
    try {
      const save = this.readSave();
      const today = localDay(now);
      if (save.lastCheckinDay !== today || save.lastExtraTicketDay === today
        || save.ticketBalance >= Number.MAX_SAFE_INTEGER) return false;
      return this.writeSave({ ...save, lastExtraTicketDay: today,
        ticketBalance: save.ticketBalance + 1 });
    } catch {
      return false;
    }
  }

  /** Replaying the same refill transaction never spends a second ticket. */
  public spendTicketForRefill(transactionId: string): boolean {
    if (!transactionId) return false;
    try {
      const save = this.readSave();
      if (save.lastRefillTransactionId === transactionId) return true;
      if (save.ticketBalance < 1) return false;
      return this.writeSave({ ...save, ticketBalance: save.ticketBalance - 1,
        lastRefillTransactionId: transactionId });
    } catch {
      return false;
    }
  }

  private readSave(): CheckInSave {
    if (!this.storage) throw new Error('LOCAL_STORAGE_UNAVAILABLE');
    const raw = this.storage.getItem(CHECK_IN_STORAGE_KEY);
    if (raw === null) return { ...EMPTY_SAVE };
    const parsed: unknown = JSON.parse(raw);
    if (!validSave(parsed)) throw new Error('INVALID_CHECK_IN_SAVE');
    return parsed;
  }

  private writeSave(save: CheckInSave): boolean {
    if (!this.storage) return false;
    const encoded = JSON.stringify(save);
    this.storage.setItem(CHECK_IN_STORAGE_KEY, encoded);
    return this.storage.getItem(CHECK_IN_STORAGE_KEY) === encoded;
  }
}

export function createBrowserCheckInStore(): CheckInStore {
  try {
    return new CheckInStore(window.localStorage);
  } catch {
    return new CheckInStore(null);
  }
}
