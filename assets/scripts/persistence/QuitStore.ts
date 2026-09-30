import type { KeyValueStorage } from './ProgressStore';

export const QUIT_STORAGE_KEY = 'smoke.quit-day.v1';

export interface RealRecord { id: string; at: number; undone: boolean;
  priceCents?: number | null; sticksPerPack?: number }
export interface QuitDay { day: string; feeling: string; confirmedAt: number;
  cancelled: boolean; revision?: number; firstConfirmedAt?: number }
interface QuitSave { version: 1; real: RealRecord[]; quit: QuitDay[];
  packPriceCents?: number | null; sticksPerPack?: number; light?: boolean }

export interface QuitSnapshot {
  today: string;
  records: ReadonlyArray<RealRecord>;
  lastRealAt: number | null;
  confirmed: boolean;
  quitConfirmedAt: number | null;
  feeling: string;
  totalDays: number;
  currentStreak: number;
  longestStreak: number;
  todayCostCents: number | null;
  packPriceCents: number | null;
  sticksPerPack: number;
  light: boolean;
}
export type QuitWriteResult = 'saved' | 'conflict' | 'unchanged' | 'missing' | 'failed';

function localDay(at: number): string {
  const date = new Date(at);
  const two = (value: number): string => value < 10 ? `0${value}` : String(value);
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
}

function validSave(value: unknown): value is QuitSave {
  if (!value || typeof value !== 'object') return false;
  const save = value as Partial<QuitSave>;
  const shapeValid = save.version === 1 && Array.isArray(save.real) && Array.isArray(save.quit)
    && save.real.every((item) => item && typeof item.id === 'string' && item.id.length > 0
      && Number.isSafeInteger(item.at) && item.at > 0 && typeof item.undone === 'boolean'
      && (item.priceCents === undefined || item.priceCents === null
        || (Number.isSafeInteger(item.priceCents) && item.priceCents >= 0))
      && (item.sticksPerPack === undefined || (Number.isSafeInteger(item.sticksPerPack)
        && item.sticksPerPack > 0 && item.sticksPerPack <= 100)))
    && save.quit.every((item) => item && /^\d{4}-\d{2}-\d{2}$/.test(item.day)
      && typeof item.feeling === 'string' && item.feeling.length <= 200
      && Number.isSafeInteger(item.confirmedAt) && item.confirmedAt > 0
      && typeof item.cancelled === 'boolean'
      && (item.revision === undefined || (Number.isSafeInteger(item.revision)
        && item.revision >= 1))
      && (item.firstConfirmedAt === undefined || (Number.isSafeInteger(item.firstConfirmedAt)
        && item.firstConfirmedAt > 0 && item.firstConfirmedAt <= item.confirmedAt)))
    && (save.packPriceCents === undefined || save.packPriceCents === null
      || (Number.isSafeInteger(save.packPriceCents) && save.packPriceCents >= 0))
    && (save.sticksPerPack === undefined || (Number.isSafeInteger(save.sticksPerPack)
      && save.sticksPerPack > 0 && save.sticksPerPack <= 100))
    && (save.light === undefined || typeof save.light === 'boolean');
  if (!shapeValid) return false;
  const ids = new Set(save.real!.map((item) => item.id));
  if (ids.size !== save.real!.length) return false;
  const activeDays = save.quit!.filter((item) => !item.cancelled).map((item) => item.day);
  if (new Set(activeDays).size !== activeDays.length) return false;
  const active = new Set(activeDays);
  return !save.real!.some((item) => !item.undone && active.has(localDay(item.at)));
}

export class QuitStore {
  constructor(private readonly storage: KeyValueStorage | null) {}

  public readSnapshot(now = Date.now()): QuitSnapshot | null {
    try {
      const save = this.read();
      const today = localDay(now);
      const records = save.real.filter((record) => !record.undone && localDay(record.at) === today);
      const lastRealAt = save.real.reduce((latest, record) => record.undone
        ? latest : Math.max(latest, record.at), 0) || null;
      const activeDays = [...new Set(save.quit.filter((item) => !item.cancelled).map((item) => item.day))].sort();
      let longest = 0;
      let run = 0;
      let previous = '';
      for (const day of activeDays) {
        const yesterday = new Date(`${day}T12:00:00`);
        yesterday.setDate(yesterday.getDate() - 1);
        run = previous === localDay(yesterday.getTime()) ? run + 1 : 1;
        longest = Math.max(longest, run);
        previous = day;
      }
      let current = 0;
      let cursor = new Date(now);
      if (activeDays.indexOf(today) < 0) cursor.setDate(cursor.getDate() - 1);
      const activeSet = new Set(activeDays);
      while (activeSet.has(localDay(cursor.getTime()))) {
        current += 1;
        cursor.setDate(cursor.getDate() - 1);
      }
      const quit = save.quit.find((item) => item.day === today && !item.cancelled);
      const packPriceCents = save.packPriceCents ?? null;
      const sticksPerPack = save.sticksPerPack ?? 20;
      const priced = records.map((item) => ({ price: item.priceCents ?? packPriceCents,
        sticks: item.priceCents === null || item.priceCents === undefined
          ? sticksPerPack : item.sticksPerPack ?? sticksPerPack }));
      const todayCostCents = priced.every((item) => item.price !== null)
        ? Math.round(priced.reduce((sum, item) => sum + (item.price ?? 0) / item.sticks, 0)) : null;
      return { today, records, lastRealAt, confirmed: !!quit,
        quitConfirmedAt: quit?.confirmedAt ?? null,
        feeling: quit?.feeling ?? '',
        totalDays: activeDays.length, currentStreak: current, longestStreak: longest,
        todayCostCents, packPriceCents, sticksPerPack, light: save.light ?? false };
    } catch { return null; }
  }

  public recordReal(id: string, allowReplaceQuit = false, now = Date.now(),
    expectedQuitAt?: number): QuitWriteResult {
    if (!id || !Number.isSafeInteger(now) || now <= 0) return 'failed';
    try {
      const save = this.read();
      if (save.real.some((item) => item.id === id)) return 'unchanged';
      const quit = save.quit.find((item) => item.day === localDay(now) && !item.cancelled);
      if (quit && (!allowReplaceQuit || (expectedQuitAt !== undefined
        && quit.confirmedAt !== expectedQuitAt))) return 'conflict';
      if (quit) quit.cancelled = true;
      save.real.push({ id, at: now, undone: false, priceCents: save.packPriceCents ?? null,
        sticksPerPack: save.sticksPerPack ?? 20 });
      save.light = !(save.light ?? false);
      return this.write(save) ? 'saved' : 'failed';
    } catch { return 'failed'; }
  }

  public undoReal(id: string, now = Date.now()): QuitWriteResult {
    try {
      const save = this.read();
      const record = save.real.find((item) => item.id === id && localDay(item.at) === localDay(now));
      if (!record) return 'missing';
      if (record.undone) return 'unchanged';
      record.undone = true;
      return this.write(save) ? 'saved' : 'failed';
    } catch { return 'failed'; }
  }

  public confirmQuit(feeling: string, now = Date.now()): QuitWriteResult {
    const normalized = feeling.trim();
    if (normalized.length > 200 || !Number.isSafeInteger(now) || now <= 0) return 'failed';
    try {
      const save = this.read();
      const today = localDay(now);
      if (save.real.some((item) => !item.undone && localDay(item.at) === today)) return 'conflict';
      const active = save.quit.find((item) => item.day === today && !item.cancelled);
      if (active?.feeling === normalized) return 'unchanged';
      if (active && now < (active.firstConfirmedAt ?? active.confirmedAt)) return 'failed';
      if (active) {
        active.feeling = normalized;
        active.firstConfirmedAt = active.firstConfirmedAt ?? active.confirmedAt;
        active.confirmedAt = now;
        active.revision = (active.revision ?? 1) + 1;
      } else save.quit.push({ day: today, feeling: normalized, confirmedAt: now,
        cancelled: false, revision: 1, firstConfirmedAt: now });
      save.light = !(save.light ?? false);
      return this.write(save) ? 'saved' : 'failed';
    } catch { return 'failed'; }
  }

  public cancelQuit(now = Date.now()): QuitWriteResult {
    try {
      const save = this.read();
      const active = save.quit.find((item) => item.day === localDay(now) && !item.cancelled);
      if (!active) return 'missing';
      active.cancelled = true;
      return this.write(save) ? 'saved' : 'failed';
    } catch { return 'failed'; }
  }

  public savePrice(packPriceCents: number | null, sticksPerPack: number): QuitWriteResult {
    if ((packPriceCents !== null && (!Number.isSafeInteger(packPriceCents)
      || packPriceCents < 0 || packPriceCents > 1000000))
      || !Number.isSafeInteger(sticksPerPack) || sticksPerPack < 1 || sticksPerPack > 100) return 'failed';
    try {
      const save = this.read();
      if ((save.packPriceCents ?? null) === packPriceCents
        && (save.sticksPerPack ?? 20) === sticksPerPack) return 'unchanged';
      save.packPriceCents = packPriceCents;
      save.sticksPerPack = sticksPerPack;
      return this.write(save) ? 'saved' : 'failed';
    } catch { return 'failed'; }
  }

  public readHistory(): { real: ReadonlyArray<RealRecord>; quit: ReadonlyArray<QuitDay>;
    packPriceCents: number | null; sticksPerPack: number } | null {
    try {
      const save = this.read();
      return { real: save.real.filter((item) => !item.undone).slice().sort((a, b) => b.at - a.at),
        quit: save.quit.filter((item) => !item.cancelled).slice().sort((a, b) => b.day.localeCompare(a.day)),
        packPriceCents: save.packPriceCents ?? null, sticksPerPack: save.sticksPerPack ?? 20 };
    } catch { return null; }
  }

  private read(): QuitSave {
    if (!this.storage) throw new Error('LOCAL_STORAGE_UNAVAILABLE');
    const raw = this.storage.getItem(QUIT_STORAGE_KEY);
    if (raw === null) return { version: 1, real: [], quit: [] };
    const parsed: unknown = JSON.parse(raw);
    if (!validSave(parsed)) throw new Error('INVALID_QUIT_SAVE');
    return parsed;
  }

  private write(save: QuitSave): boolean {
    if (!this.storage) return false;
    const encoded = JSON.stringify(save);
    this.storage.setItem(QUIT_STORAGE_KEY, encoded);
    return this.storage.getItem(QUIT_STORAGE_KEY) === encoded;
  }
}

export function createBrowserQuitStore(): QuitStore {
  try { return new QuitStore(window.localStorage); }
  catch { return new QuitStore(null); }
}
