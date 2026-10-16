import { _decorator, Color, Component, Enum, Label, Mask, Node, UIOpacity, UITransform } from 'cc';
import { CanvasTexture } from '../session/effects/CanvasTexture';
import { createNode } from './UiFactory';

const { ccclass, property, requireComponent, disallowMultiple, menu } = _decorator;
export enum TextSweepDirection { LeftToRight, RightToLeft }

/** Native Label highlights for authored text, or the existing Canvas base/highlight mode. */
@ccclass('TextSweep')
@requireComponent(Label)
@disallowMultiple
@menu('UI/TextSweep')
export class TextSweep extends Component {
  @property public duration = 2.8;
  @property({ type: Enum(TextSweepDirection) }) public direction = TextSweepDirection.LeftToRight;
  @property public baseColor = new Color(255, 224, 162, 255);
  @property public highlightColor = new Color(255, 251, 228, 255);
  @property public accentColor = new Color(255, 215, 102, 255);
  @property public glowColor = new Color(255, 172, 52, 255);
  @property public glowBlur = 26;
  @property public bandWidth = 224;
  @property public letterSpacingRatio = 0.11;
  @property public framesPerSecond = 30;
  @property public playOnEnable = true;
  @property({ tooltip: '原 Label 持续绘制底字，本组件只叠加扫光亮带' }) public renderBaseWithLabel = false;

  private label: Label | null = null;
  private texture: CanvasTexture | null = null;
  private originalLabelEnabled = true;
  private active = false;
  private elapsed = 0;
  private drawElapsed = 0;
  private playingOverride: boolean | null = null;
  private layoutKey = '';
  private font = '';
  private characters: string[] = [];
  private widths: number[] = [];
  private totalWidth = 0;
  private spacing = 0;
  private nativeRoot: Node | null = null;
  private nativeBands: Array<{ clip: Node; label: Label; offset: number; width: number }> = [];

  public get playing(): boolean { return this.playingOverride ?? this.playOnEnable; }
  public setPlaying(playing: boolean): void {
    if (this.playingOverride === playing) return;
    this.playingOverride = playing;
    if (this.enabledInHierarchy) this.refresh(true);
  }
  public setText(text: string): void {
    const label = this.label ?? this.node.getComponent(Label);
    if (label) label.string = text;
    this.refresh();
  }
  public restart(): void { this.elapsed = 0; this.drawElapsed = 0; this.refresh(true); }

  protected onLoad(): void {
    this.label = this.node.getComponent(Label)!;
    this.originalLabelEnabled = this.label.enabled;
    try {
      if (this.renderBaseWithLabel) { this.ensureNativeHighlight(); return; }
      this.texture = new CanvasTexture('TextSweepCanvas', this.node, 64, 64);
      this.texture.node.layer = this.node.layer;
      this.texture.node.active = false;
    } catch (error) {
      this.restoreLabel(error);
    }
  }
  protected onEnable(): void {
    if (!this.label || (!this.renderBaseWithLabel && !this.texture)) return;
    // Cocos assigns enabledInHierarchy only after this callback returns.
    this.active = true;
    this.layoutKey = '';
    this.refresh(true);
  }
  protected onDisable(): void {
    this.active = false;
    if (this.texture?.node.isValid) this.texture.node.active = false;
    if (this.nativeRoot?.isValid) this.nativeRoot.active = false;
    if (this.label?.isValid) this.label.enabled = this.renderBaseWithLabel || this.originalLabelEnabled;
  }
  protected onDestroy(): void {
    this.texture?.dispose(); this.texture = null;
    if (this.nativeRoot?.isValid) this.nativeRoot.destroy();
    this.nativeRoot = null; this.nativeBands = [];
  }
  protected update(deltaTime: number): void {
    this.refresh();
    if (!this.active || !this.playing) return;
    const delta = Math.max(0, deltaTime);
    this.elapsed = (this.elapsed + delta) % Math.max(0.01, this.duration);
    this.drawElapsed += delta;
    if (this.drawElapsed >= 1 / Math.max(1, Math.min(60, this.framesPerSecond))) {
      this.drawElapsed = 0;
      this.paint();
    }
  }

  /** Refresh after changing Label text/style or effect settings at runtime. */
  public refresh(force = false): void {
    if (!this.active || !this.label) return;
    try {
      if (this.renderBaseWithLabel) this.refreshNativeLayout(force);
      else if (this.texture) this.refreshLayout(force);
    } catch (error) {
      this.restoreLabel(error);
    }
  }

  private refreshLayout(force: boolean): void {
    if (!this.label || !this.texture) return;
    const label = this.label;
    const transform = this.node.getComponent(UITransform)!;
    const { width, height } = transform.contentSize;
    const anchor = transform.anchorPoint;
    const fontSize = label.fontSize;
    const key = [label.string, label.fontFamily, fontSize, label.lineHeight, this.renderBaseWithLabel,
      label.isBold, label.isItalic, label.spacingX, width, height, anchor.x, anchor.y, this.duration,
      this.direction, this.bandWidth, this.letterSpacingRatio, this.glowBlur, this.playing,
      this.baseColor.toCSS(), this.highlightColor.toCSS(), this.accentColor.toCSS(),
      this.glowColor.toCSS(), this.node.layer].join('|');
    if (key === this.layoutKey) { if (force) this.paint(); return; }
    this.layoutKey = key;
    this.font = `${label.isItalic ? 'italic ' : ''}${label.isBold ? 'bold' : 'normal'} ${fontSize}px "${label.fontFamily}", "PingFang SC", "Microsoft YaHei UI", sans-serif`;
    const ctx = this.texture.context;
    ctx.save();
    ctx.font = this.font;
    this.characters = Array.from(label.string);
    this.widths = this.characters.map((character) => ctx.measureText(character).width);
    ctx.restore();
    this.spacing = fontSize * Math.max(0, this.letterSpacingRatio) + label.spacingX;
    this.totalWidth = this.widths.reduce((sum, value) => sum + value, 0)
      + Math.max(0, this.characters.length - 1) * this.spacing;
    const padding = Math.max(8, this.glowBlur * 2 + 8);
    this.texture.resize(Math.max(width, this.totalWidth) + padding * 2,
      Math.max(height, label.lineHeight, label.fontSize * 1.4) + padding * 2);
    this.texture.node.layer = this.node.layer;
    this.texture.node.setPosition((0.5 - anchor.x) * width, (0.5 - anchor.y) * height, 0);
    this.paint();
  }

  private paint(): void {
    if (this.renderBaseWithLabel) { this.paintNative(); return; }
    if (!this.active || !this.texture) return;
    try {
      this.texture.redraw((ctx) => {
        ctx.save();
        ctx.scale(1, -1);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = this.font;
        const drawText = (): void => {
          let cursor = -this.totalWidth / 2;
          this.characters.forEach((character, index) => {
            ctx.fillText(character, cursor + this.widths[index] / 2, 0);
            cursor += this.widths[index] + this.spacing;
        });
      };
      const rgba = (color: Color, alpha: number): string =>
        `rgba(${color.r},${color.g},${color.b},${color.a / 255 * alpha})`;
      if (!this.renderBaseWithLabel) {
        ctx.shadowColor = rgba(this.glowColor, 0.28);
        ctx.shadowBlur = Math.max(0, this.glowBlur);
        ctx.fillStyle = this.baseColor.toCSS();
        drawText();
        ctx.shadowColor = rgba(this.highlightColor, 0.5);
        ctx.shadowBlur = Math.max(0, this.glowBlur * 0.46);
        drawText();
      }
      ctx.shadowColor = 'rgba(0,0,0,0)';
      ctx.shadowBlur = 0;
      if (this.playing) {
        const halfBand = Math.max(1, this.bandWidth) / 2;
        const extent = this.totalWidth / 2 + halfBand;
        const progress = this.elapsed / Math.max(0.01, this.duration);
        const phase = this.direction === TextSweepDirection.RightToLeft ? 1 - progress : progress;
        const center = -extent + 2 * extent * phase;
        const gradient = ctx.createLinearGradient(center - halfBand, 20, center + halfBand, -20);
        gradient.addColorStop(0, rgba(this.highlightColor, 0));
        gradient.addColorStop(0.38, rgba(this.highlightColor, 0));
        gradient.addColorStop(0.46, this.highlightColor.toCSS());
        gradient.addColorStop(0.51, rgba(this.highlightColor, 1));
        gradient.addColorStop(0.55, this.accentColor.toCSS());
        gradient.addColorStop(0.63, rgba(this.accentColor, 0));
        gradient.addColorStop(1, rgba(this.accentColor, 0));
        ctx.fillStyle = gradient;
        drawText();
      }
      ctx.restore();
      });
      // Hand over only after the first complete draw and texture upload succeeds.
      this.texture.node.active = true;
      if (this.label) this.label.enabled = this.renderBaseWithLabel;
    } catch (error) {
      this.restoreLabel(error);
    }
  }

  private restoreLabel(error: unknown): void {
    this.active = false;
    if (this.texture?.node.isValid) this.texture.node.active = false;
    if (this.nativeRoot?.isValid) this.nativeRoot.active = false;
    if (this.label?.isValid) this.label.enabled = this.renderBaseWithLabel || this.originalLabelEnabled;
    console.warn('[TextSweep] 绘制失败，保留原 Label 文字。', error);
  }

  private ensureNativeHighlight(): void {
    if (this.nativeRoot) return;
    this.nativeRoot = createNode('TextSweepHighlight', this.node, 1, 1);
    this.nativeRoot.active = false;
    for (const [index, opacity] of [72, 255, 100].entries()) {
      const clip = createNode(`Band${index}`, this.nativeRoot, 1, 1);
      clip.addComponent(Mask);
      clip.addComponent(UIOpacity).opacity = opacity;
      const label = createNode('Text', clip, 1, 1).addComponent(Label);
      this.nativeBands.push({ clip, label, offset: (index - 1) * .1, width: .1 });
    }
  }

  private refreshNativeLayout(force: boolean): void {
    const source = this.label!;
    source.enabled = true;
    if (this.texture?.node.isValid) this.texture.node.active = false;
    this.ensureNativeHighlight();
    const transform = this.node.getComponent(UITransform)!;
    const { width, height } = transform.contentSize, anchor = transform.anchorPoint;
    const key = [source.string, source.font?.uuid, source.useSystemFont, source.fontFamily, source.fontSize,
      source.lineHeight, source.spacingX, source.isBold, source.isItalic, source.overflow, source.enableWrapText,
      source.horizontalAlign, source.verticalAlign, source.isUnderline, source.underlineHeight,
      source.enableOutline, source.outlineWidth, width, height, anchor.x, anchor.y, this.bandWidth,
      this.highlightColor.toCSS(), this.accentColor.toCSS(), source.color.a, this.node.layer, this.playing].join('|');
    if (key === this.layoutKey) { if (force) this.paintNative(); return; }
    this.layoutKey = key;
    source.updateRenderData(true);
    this.nativeRoot!.layer = this.node.layer;
    this.nativeRoot!.getComponent(UITransform)!.setContentSize(width, height);
    this.nativeBands.forEach((band, index) => {
      const label = band.label, ink = index === 2 ? this.accentColor : this.highlightColor;
      band.clip.layer = label.node.layer = this.node.layer;
      label.font = source.font; label.useSystemFont = source.useSystemFont; label.fontFamily = source.fontFamily;
      label.fontSize = source.fontSize; label.lineHeight = source.lineHeight; label.spacingX = source.spacingX;
      label.isBold = source.isBold; label.isItalic = source.isItalic;
      label.overflow = source.overflow; label.enableWrapText = source.enableWrapText;
      label.horizontalAlign = source.horizontalAlign; label.verticalAlign = source.verticalAlign;
      label.isUnderline = source.isUnderline; label.underlineHeight = source.underlineHeight;
      label.enableOutline = source.enableOutline; label.outlineWidth = source.outlineWidth; label.outlineColor = ink;
      label.color = new Color(ink.r, ink.g, ink.b, ink.a * source.color.a / 255);
      label.string = source.string;
      const target = label.node.getComponent(UITransform)!;
      target.setAnchorPoint(anchor.x, anchor.y); target.setContentSize(width, height);
      band.clip.getComponent(UITransform)!.setContentSize(Math.max(1, this.bandWidth * band.width),
        Math.max(height, source.lineHeight, source.fontSize * 1.4) + 16);
      label.updateRenderData(true);
    });
    this.paintNative();
  }

  private paintNative(): void {
    if (!this.active || !this.nativeRoot || !this.label) return;
    this.label.enabled = true;
    this.nativeRoot.active = this.playing;
    if (!this.playing) return;
    const transform = this.node.getComponent(UITransform)!;
    const { width, height } = transform.contentSize, anchor = transform.anchorPoint;
    const progress = this.elapsed / Math.max(.01, this.duration);
    const phase = this.direction === TextSweepDirection.RightToLeft ? 1 - progress : progress;
    const center = (phase - .5) * (width + Math.max(1, this.bandWidth));
    for (const band of this.nativeBands) {
      const x = (.5 - anchor.x) * width + center + band.offset * this.bandWidth;
      const y = (.5 - anchor.y) * height;
      band.clip.setPosition(x, y);
      // Counter-translate the clone: only the mask moves; glyphs share the original Label origin.
      band.label.node.setPosition(-x, -y);
    }
  }
}
