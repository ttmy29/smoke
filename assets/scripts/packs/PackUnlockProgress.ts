import type { CatalogPackState } from './PackSelectController';

type Metric = 'completedAchievements' | 'maxCheckinStreak' | 'completedSessions' | 'shareCount';

/** V1.0.8 domain/tasks.js. Exchange and special packs have no numerical task line. */
export const PACK_UNLOCK_TASKS: Readonly<Record<string, { metric: Metric; target: number }>> = {
  'night-voyage': { metric: 'maxCheckinStreak', target: 2 },
  'fog-harbor': { metric: 'shareCount', target: 10 },
  'zero-hour': { metric: 'completedSessions', target: 50 },
  'neon-bridge': { metric: 'completedAchievements', target: 30 },
  'slow-tide': { metric: 'maxCheckinStreak', target: 7 },
  'red-equator': { metric: 'maxCheckinStreak', target: 14 },
};

export interface PackProgressSources {
  readCompletedAchievements(): number | null;
  readMaxCheckinStreak(): number | null;
  readCompletedSessions(): number | null;
  readShareCount?: () => number | null;
}

/** Reads fresh values on each page entry; reaching a target does not grant a box. */
export function createPackUnlockProgressReader(sources: PackProgressSources): (id: string) => CatalogPackState | null {
  const readers: Record<Metric, (() => number | null) | undefined> = {
    completedAchievements: () => sources.readCompletedAchievements(),
    maxCheckinStreak: () => sources.readMaxCheckinStreak(),
    completedSessions: () => sources.readCompletedSessions(),
    shareCount: sources.readShareCount ? () => sources.readShareCount!() : undefined,
  };
  return (id) => {
    if (!Object.prototype.hasOwnProperty.call(PACK_UNLOCK_TASKS, id)) return null;
    const { metric, target } = PACK_UNLOCK_TASKS[id];
    let value: number | null = null;
    try { value = readers[metric]?.() ?? null; } catch { /* Unknown is not zero. */ }
    return { unlocked: false, target,
      progress: Number.isSafeInteger(value) && value! >= 0 ? Math.min(value!, target) : undefined };
  };
}
