/** V1.0.8 domain/social-gift.js; five-stick gifts occupy five capacity slots. */
export const LOOSE_BOX_TIERS = [
  { level: 1, capacity: 1, rows: [1], visual: 'tube' },
  { level: 2, capacity: 5, rows: [5], visual: 'pack' },
  { level: 3, capacity: 7, rows: [7], visual: 'steel' },
  { level: 4, capacity: 10, rows: [5, 5], visual: 'silver' },
  { level: 5, capacity: 15, rows: [7, 8], visual: 'gold' },
  { level: 6, capacity: 20, rows: [5, 5, 5, 5], visual: 'diamond' },
] as const;

export interface LooseCigaretteItem {
  id: string;
  senderName: string;
  receivedAt: number;
  quantity: 1 | 5;
  avatarUrl?: string;
  badge?: { id: string; title: string; description: string };
  themeName?: string;
  filterVariant?: string;
  filterBase?: string;
  filterBand?: string;
  filterInk?: string;
  funText?: string;
  environmentName?: string;
  effectSummary?: string;
  effects?: ReadonlyArray<{ label: string; value: string }>;
}

export interface LooseBoxSnapshot {
  level: number;
  items: ReadonlyArray<LooseCigaretteItem>;
}

export interface LooseBoxSource { readSnapshot(): LooseBoxSnapshot | null; }
export const emptyLooseBoxSource: LooseBoxSource = { readSnapshot: () => null };

export function readLooseBox(source: LooseBoxSource) {
  let snapshot: LooseBoxSnapshot | null = null;
  try { snapshot = source.readSnapshot(); } catch { /* Missing source is not a fabricated inventory. */ }
  const valid = snapshot && Number.isInteger(snapshot.level) && snapshot.level >= 1 && snapshot.level <= 6
    && Array.isArray(snapshot.items) && snapshot.items.every((item) => item && typeof item.id === 'string'
      && item.id.length > 0 && typeof item.senderName === 'string' && Number.isFinite(item.receivedAt)
      && item.receivedAt > 0 && (item.quantity === 1 || item.quantity === 5))
    && new Set(snapshot.items.map((item) => item.id)).size === snapshot.items.length;
  const tier = LOOSE_BOX_TIERS[valid ? snapshot!.level - 1 : 0];
  const count = valid ? snapshot!.items.reduce((sum, item) => sum + item.quantity, 0) : null;
  const known = !!valid && count! <= tier.capacity;
  return { known, tier: known ? tier : LOOSE_BOX_TIERS[0],
    items: known ? [...snapshot!.items] : [], count: known ? count : null,
    capacity: known ? tier.capacity : null,
    nextTier: known && tier.level < 6 ? LOOSE_BOX_TIERS[Number(tier.level)] : null,
    maxLevel: known && tier.level === 6 };
}

export function looseDate(at: number, time = false): string {
  const date = new Date(at);
  const two = (value: number): string => value < 10 ? `0${value}` : String(value);
  return time ? `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())} ${two(date.getHours())}:${two(date.getMinutes())}`
    : `${date.getMonth() + 1}月${date.getDate()}日`;
}
