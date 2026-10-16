import type { KeyValueStorage } from './ProgressStore';

export const CHECK_IN_STORAGE_KEY = 'smoke.check-in.v1';

export interface TicketLedgerEntry {
  id: string;
  at: number;
  day: string;
  delta: number;
  reason: 'daily-checkin' | 'checkin-ad-bonus' | 'pack-refill';
}

interface CheckInSave {
  version: 1;
  cumulativeDays: number;
  streak: number;
  /** Optional for older saves; keeps catalogue progress after a check-in gap. */
  maxStreak?: number;
  lastCheckinDay: string | null;
  lastExtraTicketDay: string | null;
  ticketBalance: number;
  /** Makes an interrupted ticket refill safe to retry. */
  lastRefillTransactionId?: string;
  ledger?: TicketLedgerEntry[];
  historyIncomplete?: boolean;
  ledgerArchived?: boolean;
}

export interface CheckInSnapshot {
  cumulativeDays: number;
  streak: number;
  checkedToday: boolean;
  extraTicketClaimed: boolean;
  ticketBalance: number;
}

export type CheckInResult = 'checked' | 'already-checked' | 'failed';

export interface CheckInPreviewSettings {
  cumulativeDays: number;
  streak: number;
  ticketBalance: number;
  checkedToday: boolean;
}

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
    && (save.maxStreak === undefined || (Number.isSafeInteger(save.maxStreak)
      && save.maxStreak >= save.streak && save.maxStreak <= save.cumulativeDays))
    && (save.lastCheckinDay === null || validDay(save.lastCheckinDay))
    && (save.lastExtraTicketDay === null || validDay(save.lastExtraTicketDay))
    && Number.isSafeInteger(save.ticketBalance) && (save.ticketBalance ?? -1) >= 0
    && (save.lastRefillTransactionId === undefined
      || (typeof save.lastRefillTransactionId === 'string' && save.lastRefillTransactionId.length > 0))
    && (save.ledger === undefined || (Array.isArray(save.ledger) && save.ledger.length <= 200
      && save.ledger.every((entry) => entry && typeof entry.id === 'string' && entry.id.length > 0
        && Number.isFinite(entry.at) && entry.at >= 0 && validDay(entry.day)
        && ['daily-checkin', 'checkin-ad-bonus', 'pack-refill'].indexOf(entry.reason) >= 0
        && entry.delta === (entry.reason === 'pack-refill' ? -1 : 1))
      && new Set(save.ledger.map((entry) => entry.id)).size === save.ledger.length))
    && (save.historyIncomplete === undefined || typeof save.historyIncomplete === 'boolean')
    && (save.ledgerArchived === undefined || typeof save.ledgerArchived === 'boolean');
}

const EMPTY_SAVE: CheckInSave = {
  version: 1, cumulativeDays: 0, streak: 0,
  lastCheckinDay: null, lastExtraTicketDay: null, ticketBalance: 0,
};

export class CheckInStore {
  constructor(private readonly storage: KeyValueStorage | null) {}

  /** Development preview only. Never overwrite an existing save if clearing storage failed. */
  public initializePreview(settings: CheckInPreviewSettings, now = Date.now()): boolean {
    const { cumulativeDays, streak, ticketBalance, checkedToday } = settings;
    if (!this.storage || !Number.isFinite(now) || now < 0
      || ![cumulativeDays, streak, ticketBalance].every((value) => Number.isSafeInteger(value) && value >= 0)
      || streak > cumulativeDays || typeof checkedToday !== 'boolean'
      || (checkedToday && streak < 1)) return false;
    try {
      if (this.storage.getItem(CHECK_IN_STORAGE_KEY) !== null) return false;
      return this.writeSave({
        ...EMPTY_SAVE,
        cumulativeDays,
        streak,
        maxStreak: streak,
        lastCheckinDay: checkedToday ? localDay(now) : streak > 0 ? previousDay(localDay(now)) : null,
        ticketBalance,
        ledger: [],
        historyIncomplete: cumulativeDays > 0 || ticketBalance > 0,
      });
    } catch {
      return false;
    }
  }

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

  /** Historical evidence only: old saves may have lost a peak before ledger recording. */
  public readLongestKnownStreak(): number | null {
    try { return this.longestKnownStreak(this.readSave()); }
    catch { return null; }
  }

  private longestKnownStreak(save: CheckInSave): number {
    const days = Array.from(new Set((save.ledger ?? [])
      .filter((entry) => entry.reason === 'daily-checkin').map((entry) => entry.day))).sort();
    let longest = Math.max(save.maxStreak ?? 0, save.streak);
    let run = 0;
    let previous: string | null = null;
    for (const day of days) {
      run = previous === previousDay(day) ? run + 1 : 1;
      longest = Math.max(longest, run);
      previous = day;
    }
    return longest;
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
        maxStreak: Math.max(this.longestKnownStreak(save),
          save.lastCheckinDay === previousDay(today) ? save.streak + 1 : 1),
        lastCheckinDay: today,
        ticketBalance: save.ticketBalance + 1,
      };
      return this.writeSave(this.withLedger(next, save, { id: `checkin:${today}`,
        at: now, day: today, delta: 1, reason: 'daily-checkin' })) ? 'checked' : 'failed';
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
      return this.writeSave(this.withLedger({ ...save, lastExtraTicketDay: today,
        ticketBalance: save.ticketBalance + 1 }, save, { id: `extra:${today}`,
        at: now, day: today, delta: 1, reason: 'checkin-ad-bonus' }));
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
      const now = Date.now();
      return this.writeSave(this.withLedger({ ...save, ticketBalance: save.ticketBalance - 1,
        lastRefillTransactionId: transactionId }, save, { id: transactionId,
        at: now, day: localDay(now), delta: -1, reason: 'pack-refill' }));
    } catch {
      return false;
    }
  }

  public readHistory(): { ledger: TicketLedgerEntry[]; incomplete: boolean; archived: boolean } | null {
    try {
      const save = this.readSave();
      return { ledger: [...(save.ledger ?? [])].sort((a, b) => b.at - a.at),
        incomplete: save.historyIncomplete ?? (save.cumulativeDays > 0 || save.ticketBalance > 0),
        archived: save.ledgerArchived ?? false };
    } catch { return null; }
  }

  private withLedger(next: CheckInSave, previous: CheckInSave, entry: TicketLedgerEntry): CheckInSave {
    const ledger = previous.ledger ?? [];
    return { ...next, ledger: [...ledger, entry].slice(-200),
      historyIncomplete: previous.historyIncomplete
        ?? (previous.cumulativeDays > 0 || previous.ticketBalance > 0),
      ledgerArchived: previous.ledgerArchived === true || ledger.length >= 200 };
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
