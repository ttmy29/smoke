import { PACK_CATALOG } from './PackCatalog';
import type { CatalogPackState } from './PackSelectController';

export type PackActionOrigin = 'home' | 'catalog';
/** V1.0.8 handleLockedPackTap / choosePack. Ordinary locks are a toast, not a new page. */
export function resolvePackLockedAction(id: string, state: CatalogPackState | null, tickets: number | null) {
  const pack = PACK_CATALOG.find(entry => entry.id === id);
  if (!pack || state?.unlocked === true) return { kind: 'none' as const };
  if (id !== 'flowing-gold') return { kind: 'toast' as const, text: pack.rule };
  if (!Number.isSafeInteger(tickets) || tickets! < 0) return { kind: 'toast' as const, text: '烟票暂时读不到，请再试一次' };
  return tickets! < 2 ? { kind: 'checkin' as const } : { kind: 'exchange' as const };
}
