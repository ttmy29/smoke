import { _decorator, BlockInputEvents, Component, Label, Node, screen, ScrollView, Mask,
  UITransform, UIOpacity, view, HorizontalTextAlignment } from 'cc';
import { createLabel, createNode, createRect } from '../common/UiFactory';
import { UIButton } from '../common/UIButton';
import { CanvasTexture } from '../session/effects/CanvasTexture';
import type { CatalogPackState } from './PackSelectController';
import { PackActionOrigin, resolvePackLockedAction } from './PackLockedAction';

const { ccclass } = _decorator;
export interface PackLockedActions {
  readTickets(): number | null;
  readState(id: string): CatalogPackState | null;
  onCheckIn(origin: PackActionOrigin): void;
  onConfirmExchange?: () => boolean | Promise<boolean>;
  onChanged?: () => void;
  onModalChanged?: (open: boolean, origin: PackActionOrigin) => void;
}

/** Shared UI for home and catalogue; actual exchange is an optional transaction adapter. */
@ccclass('PackLockedController')
export class PackLockedController extends Component {
  private actions!: PackLockedActions;
  private overlay!: Node;
  private toast!: Node;
  private origin: PackActionOrigin = 'home';
  private open = false;
  private busy = false;
  private epoch = 0;
  private toastTime = 0;
  private layoutKey = '';
  private materials: CanvasTexture[] = [];
  private disposed = false;
  public get modalOpen(): boolean { return this.open; }

  public initialize(actions: PackLockedActions): void {
    this.actions = actions;
    this.overlay = createNode('ExchangeOverlay', this.node, 941, 1672);
    this.overlay.addComponent(BlockInputEvents); this.overlay.active = false;
    this.toast = createNode('Toast', this.node, 941, 150); this.toast.active = false;
    this.node.active = false;
  }
  public present(id: string, origin: PackActionOrigin): void {
    if (this.open || this.busy) return;
    let state: CatalogPackState | null = null, tickets: number | null = null;
    try { state = this.actions.readState(id); } catch { /* Unknown state cannot grant unlocks. */ }
    try { tickets = this.actions.readTickets(); } catch { /* Report the original read-error copy. */ }
    const action = resolvePackLockedAction(id, state, tickets);
    if (action.kind === 'none') return;
    if (action.kind === 'checkin') { this.dismiss(); this.actions.onCheckIn(origin); return; }
    this.dismiss(); this.origin = origin; this.node.active = true; this.raise();
    if (action.kind === 'toast') { this.showToast(action.text); return; }
    this.open = true; this.overlay.active = true; this.actions.onModalChanged?.(true, origin);
    this.layoutKey = ''; this.resize();
  }
  public dismiss(): void {
    const wasOpen = this.open;
    this.epoch++; this.busy = false; this.open = false; this.toastTime = 0;
    if (this.overlay) { this.overlay.active = false; this.clear(this.overlay); }
    if (this.toast) { this.toast.active = false; this.clear(this.toast); }
    this.release(); this.node.active = false;
    if (wasOpen) this.actions.onModalChanged?.(false, this.origin);
  }
  private raise(): void { if (this.node.parent) this.node.setSiblingIndex(this.node.parent.children.length - 1); }
  private clear(node: Node): void { for (const child of [...node.children]) { child.removeFromParent(); child.destroy(); } }
  private release(): void { for (const material of this.materials) material.dispose(); this.materials = []; }
  protected update(dt: number): void {
    if (this.open) this.resize();
    if (this.toastTime > 0) { this.toastTime -= Math.max(0, dt); if (this.toastTime <= 0 && !this.open) this.dismiss(); }
  }
  private showToast(text: string): void {
    this.clear(this.toast); this.toast.active = true; this.toastTime = 2.2;
    const unit = view.getVisibleSize().width / 750;
    const box = createRect('Message', this.toast, 590, 120, '#202222', 0, 0, 12);
    box.setScale(unit, unit, 1);
    createLabel('Text', box, text, 26, '#eee2cf', 550, 96);
  }
  private resize(): void {
    const size = view.getVisibleSize(), wide = screen.windowSize.width / (screen.devicePixelRatio || 1) >= 600;
    const key = `${size.width}:${size.height}:${wide}:${this.busy}`;
    if (key === this.layoutKey) return; this.layoutKey = key;
    this.clear(this.overlay); this.release();
    this.overlay.getComponent(UITransform)!.setContentSize(size.width, size.height);
    const shade = createRect('Scrim', this.overlay, size.width, size.height, '#020404'); shade.addComponent(UIOpacity).opacity = 219;
    const unit = size.width / 750, localHeight = size.height / unit;
    const stage = createNode('ExchangeStage', this.overlay, 750, localHeight); stage.setScale(unit, unit, 1);
    const width = 680, copyWidth = width - 64;
    const measuring = createNode('Copy', stage, copyWidth, 1);
    const title = createLabel('Title', measuring, '用 2 张烟票兑换华孑？', 31, '#f3e7d5', copyWidth, 48);
    title.isBold = true; title.lineHeight = 31 * 1.3; title.horizontalAlign = HorizontalTextAlignment.LEFT;
    title.overflow = Label.Overflow.RESIZE_HEIGHT; title.updateRenderData(true);
    const content = createLabel('Content', measuring, '兑换后永久解锁这款烟盒，并获得首盒 10 根赛博烟。',
      24, '#b8ac9d', copyWidth, 80);
    content.lineHeight = 24 * 1.65; content.horizontalAlign = HorizontalTextAlignment.LEFT;
    content.overflow = Label.Overflow.RESIZE_HEIGHT; content.updateRenderData(true);
    const titleHeight = title.node.getComponent(UITransform)!.height, contentHeight = content.node.getComponent(UITransform)!.height;
    const bodyHeight = 34 + titleHeight + 15 + contentHeight + 28;
    const height = Math.min(bodyHeight + 5 + 96, localHeight - 52);
    const panel = createNode('ExchangePanel', stage, width, height, 0, wide ? 0 : -localHeight / 2 + 28 + height / 2);
    const background = new CanvasTexture('ThemedConfirm', panel, width, Math.ceil(height)); this.materials.push(background);
    background.redraw(ctx => {
      const x = -width / 2, y = -height / 2, cut = 18;
      const outline = (): void => {
        ctx.beginPath(); ctx.moveTo(x + cut, y); ctx.lineTo(x + width - cut, y); ctx.lineTo(x + width, y + cut);
        ctx.lineTo(x + width, y + height - cut); ctx.lineTo(x + width - cut, y + height); ctx.lineTo(x + cut, y + height);
        ctx.lineTo(x, y + height - cut); ctx.lineTo(x, y + cut); ctx.closePath();
      };
      outline();
      ctx.save(); ctx.clip();
      const fill = ctx.createLinearGradient(0, height / 2, 0, -height / 2);
      fill.addColorStop(0, '#1b1d1c'); fill.addColorStop(1, '#0f1212'); ctx.fillStyle = fill; ctx.fill();
      const glow = ctx.createRadialGradient(width * .38, height / 2, 0, width * .38, height / 2, width * .34);
      glow.addColorStop(0, 'rgba(185,92,39,.16)'); glow.addColorStop(1, 'rgba(185,92,39,0)');
      ctx.fillStyle = glow; ctx.fillRect(x, y, width, height);
      const accent = ctx.createLinearGradient(x, 0, width / 2, 0);
      accent.addColorStop(0, '#ed651b'); accent.addColorStop(.58, '#d39b61'); accent.addColorStop(1, 'rgba(211,155,97,0)');
      ctx.fillStyle = accent; ctx.fillRect(x, height / 2 - 5, width, 5);
      ctx.fillStyle = this.busy ? '#252322' : '#151818'; ctx.fillRect(x, y, width / 2, 96);
      const button = ctx.createLinearGradient(0, y + 96, 0, y);
      button.addColorStop(0, '#e39054'); button.addColorStop(1, '#c76736');
      ctx.fillStyle = this.busy ? '#252322' : button; ctx.fillRect(0, y, width / 2, 96);
      ctx.strokeStyle = 'rgba(111,101,89,.42)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y + 96); ctx.lineTo(width / 2, y + 96); ctx.moveTo(0, y); ctx.lineTo(0, y + 96); ctx.stroke();
      ctx.restore(); outline(); ctx.strokeStyle = 'rgba(205,145,88,.62)'; ctx.stroke();
    });
    const viewportHeight = Math.max(1, height - 101);
    const viewport = createNode('CopyViewport', panel, width, viewportHeight, 0, height / 2 - 5 - viewportHeight / 2);
    viewport.addComponent(Mask); const scroll = viewport.addComponent(ScrollView);
    scroll.horizontal = false; scroll.vertical = true; scroll.elastic = false;
    measuring.setParent(viewport); measuring.getComponent(UITransform)!.setContentSize(copyWidth, Math.max(bodyHeight, viewportHeight));
    measuring.getComponent(UITransform)!.setAnchorPoint(.5, 1); measuring.setPosition(0, viewportHeight / 2); scroll.content = measuring;
    title.node.setPosition(0, -34 - titleHeight / 2); content.node.setPosition(0, -34 - titleHeight - 15 - contentHeight / 2);
    for (const [name, copy, x] of [['Cancel', '先等等', -width / 4], ['Confirm', '兑换烟盒', width / 4]] as const) {
      const button = createNode(name, panel, width / 2, 96, x, -height / 2 + 48);
      createLabel('Text', button, copy, 28, this.busy ? '#a89e91' : name === 'Confirm' ? '#251208' : '#bdb3a7', width / 2 - 40, 76).isBold = true;
      const control = UIButton.bind(button, () => { if (this.busy) return; if (name === 'Cancel') this.dismiss(); else void this.confirm(); });
      control.interactable = !this.busy;
    }
  }
  private async confirm(): Promise<void> {
    if (!this.open || this.busy) return;
    let tickets: number | null = null;
    try { tickets = this.actions.readTickets(); } catch { /* Keep original error copy below. */ }
    const action = resolvePackLockedAction('flowing-gold', null, tickets);
    if (action.kind !== 'exchange') {
      const origin = this.origin; this.dismiss();
      if (action.kind === 'checkin') this.actions.onCheckIn(origin);
      else if (action.kind === 'toast') { this.node.active = true; this.raise(); this.showToast(action.text); }
      return;
    }
    if (!this.actions.onConfirmExchange) return;
    const epoch = this.epoch; this.busy = true; this.resize();
    try {
      const accepted = await this.actions.onConfirmExchange();
      if (this.disposed || epoch !== this.epoch || !this.open) return;
      if (accepted === true) { this.dismiss(); this.actions.onChanged?.(); }
    } catch (error) { console.warn('[PackLocked] exchange callback failed', error); }
    finally { if (epoch === this.epoch && this.open) { this.busy = false; this.resize(); } }
  }
  protected onDestroy(): void { this.disposed = true; this.epoch++; this.release(); }
}
