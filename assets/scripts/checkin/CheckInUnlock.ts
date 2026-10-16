import { _decorator, BlockInputEvents, Component, Graphics, HorizontalTextAlignment,
  Label, Mask, Node, ScrollView, Sprite, UITransform, UIOpacity, VerticalTextAlignment, view } from 'cc';
import { color, createLabel, createNode, DESIGN_WIDTH } from '../common/UiFactory';
import { UIButton } from '../common/UIButton';
import { CanvasTexture } from '../session/effects/CanvasTexture';
import { CheckInUnlockFeature } from './CheckInUnlockCatalog';

const { ccclass } = _decorator;
const SCALE = DESIGN_WIDTH / 750;

/** V1.0.8 check-in-unlock: one modal can contain several newly unlocked features. */
@ccclass('CheckInUnlock')
export class CheckInUnlock extends Component {
  private onSettings!: () => void;
  private stage: Node | null = null;
  private card: Node | null = null;
  private cardOpacity: UIOpacity | null = null;
  private emblem: CanvasTexture | null = null;
  private textures: CanvasTexture[] = [];
  private features: readonly CheckInUnlockFeature[] = [];
  private days = 0;
  private elapsed = 0;
  private layoutKey = '';
  private reduceMotion = false;

  public get isOpen(): boolean { return this.node.active; }

  public initialize(onSettings: () => void): void {
    this.onSettings = onSettings;
    this.node.addComponent(BlockInputEvents);
    this.node.addComponent(Graphics);
    this.node.active = false;
  }

  public present(days: number, features: readonly CheckInUnlockFeature[]): void {
    if (!features.length) return;
    this.days = days;
    this.features = features;
    this.elapsed = 0;
    this.reduceMotion = typeof window !== 'undefined'
      && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.node.active = true;
    this.layoutKey = '';
    this.resize();
    this.animate();
  }

  public dismiss(): void {
    this.node.active = false;
    this.clearCard();
    this.features = [];
    this.layoutKey = '';
  }

  protected onDestroy(): void { this.clearCard(); }

  protected update(dt: number): void {
    this.resize();
    if (this.elapsed >= 2) return;
    this.elapsed = Math.min(2, this.elapsed + Math.max(0, dt));
    this.animate();
  }

  private clearCard(): void {
    for (const texture of this.textures) texture.dispose();
    this.textures = [];
    // Destroy is deferred by Cocos; detach immediately before rebuilding the layout.
    if (this.stage) { this.stage.removeFromParent(); this.stage.destroy(); }
    this.stage = this.card = null;
    this.cardOpacity = null;
    this.emblem = null;
  }

  private texture(name: string, parent: Node, width: number, height: number): CanvasTexture {
    const texture = new CanvasTexture(name, parent, width, height);
    this.textures.push(texture);
    return texture;
  }

  private resize(): void {
    const size = view.getVisibleSize();
    const key = `${size.width}:${size.height}`;
    if (key === this.layoutKey) return;
    this.layoutKey = key;
    this.clearCard();
    this.node.getComponent(UITransform)!.setContentSize(size.width, size.height);
    const mask = this.node.getComponent(Graphics)!;
    mask.clear();
    // Graphics uploads vertex alpha when filling; UIOpacity alone cannot tint this mesh.
    mask.fillColor = color('#050707', Math.round(255 * 0.84));
    mask.rect(-size.width / 2, -size.height / 2, size.width, size.height);
    mask.fill();

    const width = Math.min(600, size.width / SCALE - 72);
    const screenHeight = size.height / SCALE;
    const compact = screenHeight <= 1280; // Legacy @media (max-height:640px).
    this.stage = createNode('UnlockStage', this.node, size.width / SCALE, screenHeight);
    this.stage.setScale(SCALE, SCALE, 1);
    this.card = createNode('UnlockCard', this.stage, width, 1);
    this.cardOpacity = this.card.addComponent(UIOpacity);
    const background = this.texture('UnlockCardBackground', this.card, width + 180, 1);
    const contentWidth = width - 64;
    let y = -(compact ? 24 : 36);
    const putLabel = (name: string, text: string, font: number, tint: string, height: number): Label => {
      const label = createLabel(name, this.card!, text, font, tint, contentWidth, height, 0, y - height / 2);
      label.overflow = Label.Overflow.CLAMP;
      y -= height;
      return label;
    };
    putLabel('UnlockEyebrow', `累计打卡 · 第 ${this.days} 天`, 24, '#cdb181', 32).spacingX = 3;
    y -= compact ? 0 : 12;
    const emblemHeight = compact ? 112 : 144;
    this.emblem = this.texture('UnlockEmblem', this.card, contentWidth, emblemHeight);
    this.emblem.node.setPosition(0, y - emblemHeight / 2);
    y -= emblemHeight + 10;
    putLabel('UnlockTitle', '新的体验，已解锁', 40, '#f0e4d0', 52).isBold = true;
    y -= 14;
    putLabel('UnlockSubtitle', '烟票 +1 · 这些功能现在可以探索了', 24, '#bfb39f', 36);
    const gap = compact ? 20 : 28;
    y -= gap;

    const settingsAction = this.features.some((feature) => feature.id === 'shakeAsh');
    const actionsHeight = settingsAction ? 96 + 12 + 88 : 96;
    const viewport = createNode('UnlockFeatures', this.card, contentWidth, 1);
    viewport.addComponent(Mask);
    const scroll = viewport.addComponent(ScrollView);
    scroll.horizontal = false;
    scroll.vertical = true;
    scroll.elastic = false;
    const content = createNode('UnlockFeatureContent', viewport, contentWidth, 1);
    content.getComponent(UITransform)!.setAnchorPoint(0.5, 1);
    scroll.content = content;
    let featureHeight = 0;
    this.features.forEach((feature, index) => {
      const row = createNode(feature.id, content, contentWidth, 1, 0, -featureHeight);
      const divider = this.texture('FeatureDivider', row, contentWidth, 2);
      divider.redraw((ctx) => { ctx.fillStyle = '#4d4435'; ctx.fillRect(-contentWidth / 2, -0.5, contentWidth, 1); });
      const heading = createLabel('Title', row, feature.title, 30, '#e8d6b4',
        contentWidth - 110, 41, -55, -22 - 20.5, HorizontalTextAlignment.LEFT);
      heading.isBold = true;
      heading.overflow = Label.Overflow.CLAMP;
      createLabel('Status', row, '已解锁', 24, '#cdb181', 96, 41,
        contentWidth / 2 - 48, -22 - 20.5, HorizontalTextAlignment.RIGHT);
      const description = createLabel('Description', row, feature.description, 26,
        '#c1b8a8', contentWidth, 1, 0, -75, HorizontalTextAlignment.LEFT);
      description.node.getComponent(UITransform)!.setAnchorPoint(0.5, 1);
      description.verticalAlign = VerticalTextAlignment.TOP;
      description.lineHeight = 43;
      description.overflow = Label.Overflow.RESIZE_HEIGHT;
      description.updateRenderData(true);
      const rowHeight = 75 + description.node.getComponent(UITransform)!.height
        + (index === this.features.length - 1 ? 0 : 22);
      row.getComponent(UITransform)!.setContentSize(contentWidth, rowHeight);
      featureHeight += rowHeight;
    });
    const available = screenHeight * 0.9 + y - gap - actionsHeight - 28;
    const listHeight = Math.max(1, Math.min(featureHeight,
      screenHeight * (compact ? 0.32 : 0.38), available));
    viewport.getComponent(UITransform)!.setContentSize(contentWidth, listHeight);
    viewport.setPosition(0, y - listHeight / 2);
    content.getComponent(UITransform)!.setContentSize(contentWidth, featureHeight);
    content.setPosition(0, listHeight / 2);
    scroll.vertical = featureHeight > listHeight;
    scroll.scrollToTop(0);
    y -= listHeight + gap;
    this.action(settingsAction ? '去设置开启' : '知道了', contentWidth, 96, y - 48, true, () => {
      if (!this.isOpen) return;
      this.dismiss();
      if (settingsAction) this.onSettings();
    });
    y -= 96;
    if (settingsAction) {
      y -= 12;
      this.action('稍后再说', contentWidth, 88, y - 44, false, () => this.dismiss());
      y -= 88;
    }
    const height = -y + 28;
    this.card.getComponent(UITransform)!.setContentSize(width, height);
    // Children were laid out from top=0; center their parent without changing the card pivot.
    for (const child of this.card.children) child.setPosition(child.position.x, child.position.y + height / 2);
    background.node.setPosition(0, 0);
    background.resize(width + 180, height + 180);
    background.redraw((ctx) => {
      ctx.shadowColor = '#00000088'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 24;
      ctx.fillStyle = '#191c1b';
      this.roundRect(ctx, -width / 2, -height / 2, width, height, 28);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.save();
      ctx.clip();
      // Elliptical radial gradient centered on the upper card edge.
      ctx.translate(0, height / 2); ctx.scale(width / height, 1);
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, height * 0.62);
      gradient.addColorStop(0, '#342c20'); gradient.addColorStop(1, '#191c1b');
      ctx.fillStyle = gradient;
      ctx.fillRect(-height / 2, -height, height, height);
      ctx.restore();
      ctx.strokeStyle = '#8b7149'; ctx.lineWidth = 1;
      this.roundRect(ctx, -width / 2, -height / 2, width, height, 28);
      ctx.stroke();
    });
    this.animate();
  }

  private action(text: string, width: number, height: number, y: number,
    primary: boolean, callback: () => void): void {
    const hit = createNode(primary ? 'UnlockConfirm' : 'UnlockLater', this.card!, width, height, 0, y);
    const surface = this.texture('ButtonSurface', hit, width, height);
    surface.redraw((ctx) => {
      ctx.fillStyle = primary ? '#d7b77f' : 'rgba(215,183,127,0)';
      this.roundRect(ctx, -width / 2, -height / 2, width, height, 14);
      ctx.fill();
    });
    const control = UIButton.bind(hit, callback);
    control.pressedTint = color('#e8e2d4');
    control.setTintTarget(surface.node.getComponent(Sprite));
    const label = createLabel('Label', hit, text, primary ? 28 : 26,
      primary ? '#211d16' : '#c1b8a8', width - 24, height - 8);
    label.isBold = primary;
  }

  private animate(): void {
    if (!this.card || !this.cardOpacity || !this.emblem) return;
    const arrival = this.reduceMotion ? 1 : this.ease(Math.min(1, this.elapsed / 0.26));
    this.card.setScale(0.97 + arrival * 0.03, 0.97 + arrival * 0.03, 1);
    this.card.setPosition(0, -16 * (1 - arrival));
    this.cardOpacity.opacity = Math.round(255 * arrival);
    const progress = (duration: number): number => this.reduceMotion ? 1
      : this.ease(Math.max(0, Math.min(1, ((this.elapsed - 0.24) / duration - 0.25) / 0.75)));
    const shackle = progress(1.68);
    const chain = progress(1.76);
    this.emblem.redraw((ctx) => {
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.globalAlpha = 1 - chain;
        ctx.translate(side * (side < 0 ? 91 : 99) + side * 40 * chain, -17);
        ctx.rotate(side * -12 * chain * Math.PI / 180);
        ctx.strokeStyle = '#b29767'; ctx.lineWidth = 3;
        for (let i = -1; i <= 1; i++) {
          this.roundRect(ctx, i * 40 - 24, -14, 48, 28, 14);
          ctx.stroke();
        }
        ctx.restore();
      }
      ctx.save();
      ctx.translate(26, -7 + 12 * shackle);
      ctx.rotate(-24 * shackle * Math.PI / 180);
      ctx.strokeStyle = '#e4c58c'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(-48, 0); ctx.lineTo(-48, 27);
      ctx.bezierCurveTo(-48, 59, 0, 59, 0, 27); ctx.lineTo(0, 0); ctx.stroke();
      ctx.restore();
      const gradient = ctx.createLinearGradient(-35, 12, 35, -44);
      gradient.addColorStop(0, '#5c4930'); gradient.addColorStop(1, '#28231c');
      ctx.fillStyle = gradient; ctx.strokeStyle = '#d6b477'; ctx.lineWidth = 2;
      this.roundRect(ctx, -35, -44, 70, 56, 10); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ead2a0';
      this.roundRect(ctx, -4, -25.5, 8, 19, 4); ctx.fill();
    });
  }

  private ease(progress: number): number { return 1 - (1 - progress) ** 3; }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number,
    width: number, height: number, radius: number): void {
    ctx.beginPath(); ctx.moveTo(x + radius, y); ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius); ctx.quadraticCurveTo(x, y, x + radius, y); ctx.closePath();
  }
}
