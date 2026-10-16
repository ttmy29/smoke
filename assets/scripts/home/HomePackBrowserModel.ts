import { PACK_CATALOG, PackCatalogItem } from '../packs/PackCatalog';
import type { CatalogPackState } from '../packs/PackSelectController';

export interface HomePackState extends CatalogPackState { capacity?: number; owned?: boolean; }
export interface HomePackEntry { pack: PackCatalogItem; state: HomePackState; }
export type HomePackReader = (id: string) => HomePackState | null;

/** Same filtering/order as V1.0.8 getCyberGameSnapshot; unknown does not unlock a pack. */
export function readHomePacks(read: HomePackReader): HomePackEntry[] {
  const entries = PACK_CATALOG.map(pack => {
    let state: HomePackState | null = null;
    try { state = read(pack.id); } catch { /* Keep unknown inventory unknown. */ }
    return { pack, state: state ?? { unlocked: false } };
  }).filter(({ pack, state }) => pack.id === 'shadowless' ? state.unlocked === true
    : pack.id === 'zuguo' ? state.owned === true : true);
  return entries.sort((a, b) => Number(b.pack.id === 'shadowless') - Number(a.pack.id === 'shadowless'));
}

export function homePackAction(entry: HomePackEntry, busy = false): string {
  if (busy) return '正在抽出';
  if (!entry.state.unlocked) return entry.pack.id === 'flowing-gold' ? '用 2 张烟票解锁' : '查看解锁条件';
  return entry.state.remaining === 0 ? '补一盒' : '来一根';
}

/** CSS-pixel distances, not screen pixels. Vertical/multi-touch/cancel gestures cannot become taps. */
export class HomePackGesture {
  private start: { id: number; x: number; y: number } | null = null;
  private cancelled = false;
  private moved = false;
  private axis: 'horizontal' | 'vertical' | null = null;
  public begin(id: number, x: number, y: number, count: number): void {
    if (this.start || count !== 1) { this.cancelled = true; return; }
    this.start = { id, x, y }; this.cancelled = false; this.moved = false; this.axis = null;
  }
  public move(id: number, x: number, y: number, count: number): void {
    if (!this.start) return;
    if (id !== this.start.id || count !== 1) this.cancelled = true;
    const dx = Math.abs(x - this.start.x), dy = Math.abs(y - this.start.y);
    if (Math.max(dx, dy) > 10) {
      this.moved = true;
      if (!this.axis && dx > dy * 1.2) this.axis = 'horizontal';
      else if (!this.axis && dy > dx * 1.2) { this.axis = 'vertical'; this.cancelled = true; }
    }
  }
  public end(id: number, x: number, y: number, count: number): 'previous' | 'next' | 'tap' | 'cancel' {
    if (!this.start) return 'cancel';
    this.move(id, x, y, count);
    const dx = x - this.start.x, dy = y - this.start.y;
    const result = this.cancelled ? 'cancel' : Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.2
      ? dx < 0 ? 'next' : 'previous' : this.moved ? 'cancel' : 'tap';
    this.reset(); return result;
  }
  public cancel(): void { this.start = null; this.cancelled = true; }
  public reset(): void { this.start = null; this.cancelled = false; this.moved = false; this.axis = null; }
}
