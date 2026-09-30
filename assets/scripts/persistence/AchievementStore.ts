import type { KeyValueStorage } from './ProgressStore';
import { ACHIEVEMENT_GROUPS, SPECIAL_ACHIEVEMENT } from '../achievement/AchievementCatalog';
import type { AchievementResult, AchievementSource } from '../achievement/AchievementController';

export const ACHIEVEMENT_STORAGE_KEY = 'smoke.achievements.v1';
const IDS = new Set([...ACHIEVEMENT_GROUPS.flatMap((group) =>
  group.items.map((item) => item.id)), SPECIAL_ACHIEVEMENT.id]);

interface StoredResult {
  id: string;
  progressCurrent: number;
  progressTarget: number;
  firstAchievedAt: number | null;
  unread: boolean;
  /** Separate from the unread red dot: the achievement toast is shown once. */
  noticePending?: boolean;
}
interface QualifiedSession {
  id: string;
  packInstanceId: string;
  slotIndex: number;
}
interface AchievementSave {
  version: 1;
  results: StoredResult[];
  /** Added after V1 launch; old saves without per-session evidence remain readable. */
  qualifiedSessions?: QualifiedSession[];
}

export interface QualifiedAchievementMetrics {
  validEndedSessions: number;
  qualifiedPublicSettlements: number;
}

function validResult(value: unknown): value is StoredResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as Partial<StoredResult>;
  return typeof result.id === 'string' && IDS.has(result.id)
    && Number.isFinite(result.progressCurrent) && result.progressCurrent! >= 0
    && Number.isFinite(result.progressTarget) && result.progressTarget! > 0
    && result.progressCurrent! <= result.progressTarget!
    && (result.firstAchievedAt === null ||
      (Number.isSafeInteger(result.firstAchievedAt) && result.firstAchievedAt! > 0))
    && typeof result.unread === 'boolean'
    && (result.noticePending === undefined || typeof result.noticePending === 'boolean')
    && (result.firstAchievedAt !== null) ===
      (result.progressCurrent === result.progressTarget);
}

function validSave(value: unknown): value is AchievementSave {
  if (!value || typeof value !== 'object') return false;
  const save = value as Partial<AchievementSave>;
  return save.version === 1 && Array.isArray(save.results)
    && save.results.every(validResult)
    && new Set(save.results.map((item) => item.id)).size === save.results.length
    && (save.qualifiedSessions === undefined ||
      (Array.isArray(save.qualifiedSessions)
        && save.qualifiedSessions.every((item) => item
          && typeof item.id === 'string' && item.id.length > 0
          && typeof item.packInstanceId === 'string' && item.packInstanceId.length > 0
          && Number.isInteger(item.slotIndex) && item.slotIndex >= 0 && item.slotIndex < 10)
        && new Set(save.qualifiedSessions.map((item) => item.id)).size
          === save.qualifiedSessions.length));
}

function timeLabel(at: number): string {
  const date = new Date(at);
  const two = (value: number): string => value < 10 ? `0${value}` : String(value);
  return `${date.getFullYear()}.${two(date.getMonth() + 1)}.${two(date.getDate())}`;
}

/** Completion is monotonic; each achievement keeps its first unlock time. */
export class AchievementStore implements AchievementSource {
  private listeners = new Set<() => void>();
  constructor(private readonly storage: KeyValueStorage | null) {}

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public hasUnread(): boolean {
    return this.readResults()?.some((result) => result.unread) ?? false;
  }

  public readQualifiedMetrics(): QualifiedAchievementMetrics | null {
    try {
      const sessions = this.read().qualifiedSessions ?? [];
      const packs = new Map<string, Set<number>>();
      for (const session of sessions) {
        if (!packs.has(session.packInstanceId)) packs.set(session.packInstanceId, new Set());
        packs.get(session.packInstanceId)!.add(session.slotIndex);
      }
      return { validEndedSessions: sessions.length,
        qualifiedPublicSettlements: [...packs.values()].filter((slots) => slots.size === 10).length };
    } catch { return null; }
  }

  /** A legacy qualified end requires at least one puff. The caller checks that condition. */
  public recordQualifiedSession(id: string, packInstanceId: string,
    slotIndex: number): boolean {
    if (!id || !packInstanceId || !Number.isInteger(slotIndex)
      || slotIndex < 0 || slotIndex >= 10) return false;
    try {
      const save = this.read();
      const sessions = save.qualifiedSessions ?? [];
      if (sessions.some((session) => session.id === id)) return true;
      save.qualifiedSessions = [...sessions, { id, packInstanceId, slotIndex }];
      return this.write(save);
    } catch { return false; }
  }

  public nextPendingNotice(): string | null {
    try {
      return this.read().results.find((item) => item.firstAchievedAt !== null
        && item.noticePending)?.id ?? null;
    } catch { return null; }
  }

  public markNoticeShown(id: string): boolean {
    try {
      const save = this.read();
      const result = save.results.find((item) => item.id === id);
      if (!result || !result.noticePending) return !!result;
      result.noticePending = false;
      return this.write(save);
    } catch { return false; }
  }

  public readResults(): ReadonlyArray<AchievementResult> | null {
    try {
      return this.read().results.map((item) => ({
        id: item.id,
        completed: item.firstAchievedAt !== null,
        progressText: item.firstAchievedAt === null
          ? `${item.progressCurrent}/${item.progressTarget}` : undefined,
        firstAchievedLabel: item.firstAchievedAt === null
          ? undefined : timeLabel(item.firstAchievedAt),
        unread: item.unread,
      }));
    } catch { return null; }
  }

  /** Set an observed cumulative metric; repeated or older observations do not regress progress. */
  public recordProgress(id: string, current: number, target: number,
    at = Date.now()): boolean {
    if (!IDS.has(id) || !Number.isFinite(current) || current < 0
      || !Number.isFinite(target) || target <= 0
      || !Number.isSafeInteger(at) || at <= 0) return false;
    try {
      const save = this.read();
      const existing = save.results.find((item) => item.id === id);
      const value = Math.min(current, target);
      if (existing && (existing.firstAchievedAt !== null ||
        (existing.progressCurrent >= value && existing.progressTarget === target))) return true;
      const progressCurrent = Math.max(existing?.progressCurrent ?? 0, value);
      const newlyCompleted = existing?.firstAchievedAt == null
        && progressCurrent >= target;
      const next: StoredResult = {
        id,
        progressCurrent,
        progressTarget: target,
        firstAchievedAt: existing?.firstAchievedAt ?? (newlyCompleted ? at : null),
        unread: newlyCompleted || (existing?.unread ?? false),
        noticePending: newlyCompleted || (existing?.noticePending ?? false),
      };
      if (existing) Object.assign(existing, next);
      else save.results.push(next);
      return this.write(save);
    } catch { return false; }
  }

  public markRead(id: string): boolean {
    try {
      const save = this.read();
      const result = save.results.find((item) => item.id === id);
      if (!result || !result.unread) return !!result;
      result.unread = false;
      return this.write(save);
    } catch { return false; }
  }

  private read(): AchievementSave {
    if (!this.storage) throw new Error('ACHIEVEMENT_STORAGE_UNAVAILABLE');
    const raw = this.storage.getItem(ACHIEVEMENT_STORAGE_KEY);
    if (raw === null) return { version: 1, results: [] };
    const parsed: unknown = JSON.parse(raw);
    if (!validSave(parsed)) throw new Error('INVALID_ACHIEVEMENT_SAVE');
    return parsed;
  }

  private write(save: AchievementSave): boolean {
    if (!this.storage) return false;
    const encoded = JSON.stringify(save);
    this.storage.setItem(ACHIEVEMENT_STORAGE_KEY, encoded);
    const saved = this.storage.getItem(ACHIEVEMENT_STORAGE_KEY) === encoded;
    if (saved) for (const listener of this.listeners) {
      try { listener(); } catch (error) {
        console.warn('Achievement listener failed', error);
      }
    }
    return saved;
  }
}

export function createBrowserAchievementStore(): AchievementStore {
  try { return new AchievementStore(window.localStorage); }
  catch { return new AchievementStore(null); }
}
