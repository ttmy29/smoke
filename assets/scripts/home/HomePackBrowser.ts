import { _decorator, Component, EventTouch, Graphics, isValid, Label, Mask, Node,
  resources, SpriteFrame, UITransform, UIOpacity, view } from 'cc';
import { AssetCatalog } from '../assets/AssetCatalog';
import { BundleLoader } from '../assets/BundleLoader';
import { color, createLabel, createNode } from '../common/UiFactory';
import { PackBoxView } from '../packs/PackBoxView';
import { CanvasTexture } from '../session/effects/CanvasTexture';
import { HomePackEntry, HomePackGesture, HomePackReader, readHomePacks } from './HomePackBrowserModel';

const { ccclass } = _decorator;
export interface HomePackBrowserHooks {
  readState: HomePackReader;
  blocked(): boolean;
  onChanged(entry: HomePackEntry, index: number, count: number): void;
  onPreviewAction?: (id: string) => void;
}

/** Homepage viewport; the real WangXi box remains the original interactive instance. */
@ccclass('HomePackBrowser')
export class HomePackBrowser extends Component {
  private hooks!: HomePackBrowserHooks;
  private entries: HomePackEntry[] = [];
  private id = 'life';
  private viewport!: Node;
  private life!: Node;
  private pages = new Map<string, { node: Node; view: PackBoxView; materials: CanvasTexture[]; key: string }>();
  private frames = new Map<string, SpriteFrame>();
  private pending = new Set<string>();
  private gesture = new HomePackGesture();
  private motion: { from: string; direction: number; elapsed: number } | null = null;
  private disposed = false;
  private columnWidth = 550;
  public get current(): HomePackEntry { return this.entries.find(entry => entry.pack.id === this.id)!; }
  public get animating(): boolean { return this.motion !== null; }
  public get isLife(): boolean { return this.id === 'life'; }

  public initialize(realPack: Node, hooks: HomePackBrowserHooks): void {
    this.hooks = hooks;
    this.viewport = createNode('PackViewport', this.node, 550, 760);
    this.viewport.addComponent(Mask);
    this.life = createNode('LifePage', this.viewport, 550, 760);
    realPack.setParent(this.life); realPack.setPosition(0, 0);
    realPack.setScale(502 / 330, 728 / 600, 1);
    this.node.on(Node.EventType.TOUCH_START, this.touchStart, this, true);
    this.node.on(Node.EventType.TOUCH_MOVE, this.touchMove, this, true);
    this.node.on(Node.EventType.TOUCH_END, this.touchEnd, this, true);
    this.node.on(Node.EventType.TOUCH_CANCEL, this.touchCancel, this, true);
    this.refresh();
  }
  public configure(hooks: Partial<HomePackBrowserHooks>): void { this.hooks = { ...this.hooks, ...hooks }; this.refresh(); }
  public resize(width: number): void {
    this.columnWidth = width;
    for (const node of [this.node, this.viewport]) node.getComponent(UITransform)!.setContentSize(width, 760);
    if (this.motion) this.positionPages();
  }
  public refresh(): void {
    this.entries = readHomePacks(this.hooks.readState);
    if (!this.entries.some(entry => entry.pack.id === this.id)) this.id = 'life';
    if (!this.motion) this.showCurrent();
    this.notify();
  }
  public browse(direction: number): void {
    if (this.motion || this.hooks.blocked() || !this.node.activeInHierarchy) return;
    this.refresh();
    const index = this.entries.findIndex(entry => entry.pack.id === this.id);
    const next = this.entries[(index + (direction < 0 ? -1 : 1) + this.entries.length) % this.entries.length];
    if (next.pack.id === this.id) return;
    const toast = this.node.getChildByName('RuleToast'); if (toast) { toast.removeFromParent(); toast.destroy(); }
    const previous = this.id; this.id = next.pack.id;
    this.ensurePage(this.id); this.motion = { from: previous, direction: direction < 0 ? -1 : 1, elapsed: 0 };
    this.positionPages(); this.notify();
  }
  public activate(): void {
    if (this.motion || this.hooks.blocked() || this.isLife) return;
    if (this.hooks.onPreviewAction) { this.hooks.onPreviewAction(this.id); return; }
    // Original locked-pack tap copy. No developer-status message or fabricated grant.
    const old = this.node.getChildByName('RuleToast'); if (old) { old.removeFromParent(); old.destroy(); }
    const label = createLabel('RuleToast', this.node, this.current.pack.rule, 26, '#e0d6bf', this.columnWidth - 30, 100, 0, -270);
    label.node.addComponent(UIOpacity);
    this.scheduleOnce(() => { if (isValid(label.node, true)) label.node.destroy(); }, 2.2);
  }
  private notify(): void { this.hooks.onChanged(this.current, this.entries.findIndex(entry => entry.pack.id === this.id), this.entries.length); }
  private page(id: string): Node { return id === 'life' ? this.life : this.pages.get(id)!.node; }
  private showCurrent(): void {
    this.ensurePage(this.id);
    this.life.active = this.id === 'life'; this.life.setPosition(0, 0);
    for (const [id, page] of this.pages) { page.node.active = id === this.id; page.node.setPosition(0, 0); }
  }
  private ensurePage(id: string): void {
    if (id === 'life') return;
    const entry = this.entries.find(item => item.pack.id === id)!;
    const prior = this.pages.get(id);
    // State changes can affect the locked geometry and text; rebuild only the affected page.
    const key = JSON.stringify(entry.state);
    if (prior && prior.key === key) {
      if (!this.frames.has(id)) this.loadFrame(id);
      return;
    }
    if (prior) { for (const material of prior.materials) material.dispose(); prior.node.removeFromParent(); prior.node.destroy(); }
    const node = createNode(`Pack-${id}`, this.viewport, this.columnWidth, 760);
    const visual = createNode('Visual', node, 584, 728);
    const locked = !entry.state.unlocked;
    const materials: CanvasTexture[] = [];
    const box = new PackBoxView(visual, entry.pack, 502 / .86 / (locked ? 1.06 : 1), 728 * (locked ? .78 : 1), materials, 'home');
    if (locked) { box.setLocked(true); visual.addComponent(UIOpacity).opacity = 204;
      const lock = createNode('Lock', node, 60, 76, 0, 25).addComponent(Graphics);
      lock.strokeColor = color('#d8c7a7'); lock.fillColor = color('#1c1e1c'); lock.lineWidth = 3;
      lock.roundRect(-22, -24, 44, 36, 6); lock.fill(); lock.stroke();
      lock.roundRect(-13, 12, 26, 27, 13); lock.stroke();
      createLabel('Rule', node, entry.pack.rule, 25, '#e0d6bf', this.columnWidth - 40, 80, 0, -65);
      if (Number.isSafeInteger(entry.state.target) && entry.state.target! > 1) createLabel('Progress', node,
        `${Number.isSafeInteger(entry.state.progress) && entry.state.progress! >= 0 ? Math.min(entry.state.progress!, entry.state.target!) : '—'} / ${entry.state.target}`,
        24, entry.pack.accent, this.columnWidth - 40, 42, 0, -120);
    }
    if (id === 'shadowless') createLabel('ShadowlessCopy', node, '无影烟\n无形 · 随烟而散', 25, '#c7ccc9', this.columnWidth, 100, 0, -250);
    this.pages.set(id, { node, view: box, materials, key });
    const cached = this.frames.get(id); if (cached) box.setFrame(cached); else this.loadFrame(id);
  }
  private loadFrame(id: string): void {
    if (id === 'shadowless' || this.pending.has(id)) return;
    this.pending.add(id);
    const done = (error: Error | null, frame?: SpriteFrame): void => {
      this.pending.delete(id);
      if (this.disposed || !isValid(this, true)) return;
      if (error || !frame) { console.warn(`[HomePackBrowser] ${id}`, error); return; }
      frame.addRef(); this.frames.set(id, frame); this.pages.get(id)?.view.setFrame(frame);
    };
    if (id === 'life') { resources.load(AssetCatalog.wangXiSkin, SpriteFrame, done); return; }
    void BundleLoader.loadBundle('legacy-temp').then(bundle => {
      if (!this.disposed && isValid(this, true)) bundle.load(`pack-skins/assets/${id}/spriteFrame`, SpriteFrame, done);
    }).catch(error => done(error));
  }
  private positionPages(): void {
    const motion = this.motion!;
    for (const [id, page] of this.pages) page.node.active = id === this.id || id === motion.from;
    this.life.active = this.id === 'life' || motion.from === 'life';
    const p = Math.min(1, motion.elapsed / .28), offset = (1 - (1 - p) ** 3) * this.columnWidth;
    this.page(motion.from).setPosition(-motion.direction * offset, 0);
    this.page(this.id).setPosition(motion.direction * (this.columnWidth - offset), 0);
  }
  protected update(dt: number): void {
    if (!this.motion) return;
    if (this.hooks.blocked()) { this.motion = null; this.showCurrent(); this.notify(); return; }
    this.motion.elapsed = Math.min(.28, this.motion.elapsed + Math.max(0, dt)); this.positionPages();
    if (this.motion.elapsed >= .28) { this.motion = null; this.showCurrent(); this.notify(); }
  }
  private point(event: EventTouch): { id: number; x: number; y: number; count: number } {
    const point = event.getUILocation(), factor = 375 / view.getVisibleSize().width;
    return { id: event.touch?.getID() ?? -1, x: point.x * factor, y: point.y * factor, count: event.getAllTouches().length };
  }
  private stop(event: EventTouch): void { event.propagationStopped = true; event.propagationImmediateStopped = true; }
  private touchStart(event: EventTouch): void {
    if (this.hooks.blocked() || this.motion) { this.gesture.cancel(); this.stop(event); return; }
    const p = this.point(event); this.gesture.begin(p.id, p.x, p.y, p.count);
  }
  private touchMove(event: EventTouch): void { const p = this.point(event); this.gesture.move(p.id, p.x, p.y, p.count); }
  private touchCancel(event: EventTouch): void { this.gesture.cancel(); this.stop(event); }
  private touchEnd(event: EventTouch): void {
    const p = this.point(event), result = this.gesture.end(p.id, p.x, p.y, Math.max(1, p.count));
    if (result !== 'tap' || !this.isLife || this.motion || this.hooks.blocked()) this.stop(event);
    if (result === 'next' || result === 'previous') this.browse(result === 'next' ? 1 : -1);
    else if (result === 'tap' && !this.isLife) this.activate();
  }
  protected onDisable(): void { this.gesture.reset(); if (this.motion) { this.motion = null; this.showCurrent(); this.notify(); } }
  protected onDestroy(): void {
    this.disposed = true;
    for (const page of this.pages.values()) for (const material of page.materials) material.dispose();
    for (const frame of this.frames.values()) frame.decRef();
    this.frames.clear(); this.pages.clear();
  }
}
