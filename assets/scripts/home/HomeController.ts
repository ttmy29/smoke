import { _decorator, BlockInputEvents, Button, Component, Graphics, HorizontalTextAlignment, Label, Mask, Node, resources, screen, Sprite, SpriteFrame, UITransform, UIOpacity, Vec3, view, Widget } from 'cc';
import { AssetCatalog } from '../assets/AssetCatalog';
import { alignWidget, color, createButton, createLabel, createNode, createRect, DESIGN_HEIGHT, DESIGN_WIDTH, Palette } from '../common/UiFactory';
import { CanvasTexture } from '../session/effects/CanvasTexture';
import { countAvailableSlots, PackSnapshot } from '../persistence/PackStore';

const { ccclass } = _decorator;

export interface ExtractionSource {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  coverTop: number;
  frontOccluders: Array<{ left: number; right: number; top: number }>;
  liftRatio: number;
}

type SideCardKind = 'records' | 'lab' | 'switch' | 'today' | 'gift';

interface SideCardLayout {
  node: Node;
  frame: Graphics;
  mark: Node;
  kind: SideCardKind;
  title: Label;
  subtitle: Label | null;
  rows: Node[];
}

@ccclass('HomeController')
export class HomeController extends Component {
  public static readonly PACK_FILTER_HEIGHT = 600 * 0.52;
  private static readonly LID_SECONDS = 0.5;
  private onStart: ((slotIndex: number) => void) | null = null;
  private onSupply: (() => void) | null = null;
  private onOpenLid: ((instanceId: string) => PackSnapshot | null) | null = null;
  private contentRoot!: Node;
  private headerRoot!: Node;
  private settingsRoot!: Node;
  private quickRoot!: Node;
  private noticeRoot!: Node;
  private workspaceRoot!: Node;
  private packNavigation!: Node;
  private footerRoot!: Node;
  private sloganLabel!: Label;
  private startRoot!: Node;
  private bottomTabRoot!: Node;
  private bottomTabGraphics!: Graphics;
  private homeTabRoot!: Node;
  private worldTabRoot!: Node;
  private homeTabIcon!: Node;
  private worldTabIcon!: Node;
  private homeTabLabel!: Label;
  private worldTabLabel!: Label;
  private bottomTabUnit = 0;
  private quickLabels: Label[] = [];
  private quickIcons: Node[] = [];
  private actionTitles: Array<{ label: Label; rpx: number; minimumPx: number; copyOffsetY: number | null }> = [];
  private actionSubtitles: Label[] = [];
  private statusLabels: Label[] = [];
  private statusValues: Label[] = [];
  private sideCards: SideCardLayout[] = [];
  private packSwitchArrows: Node[] = [];
  private packSwitchCaption!: Label;
  private typographyLayoutKey = '';
  private packRoot!: Node;
  private slots: Node[] = [];
  private frontSlots: Node[] = [];
  private filterTextures: CanvasTexture[] = [];
  private backgroundTexture!: CanvasTexture;
  private backgroundHeight = 0;
  private collar!: Node;
  private secondaryNodes: Node[] = [];
  private secondaryOpacities: UIOpacity[] = [];
  private entryMode = false;
  private selectedSlot = 7;
  private smokedCountLabel!: Label;
  private packStatusLabel!: Label;
  private inventoryCaptionLabel!: Label;
  private inventoryUnitLabel!: Label;
  private announcementTagLabel!: Label;
  private announcementLabel!: Label;
  private inventorySegments: CanvasTexture[] = [];
  private startButton!: Button;
  private startButtonLabel!: Label;
  private startSweep!: CanvasTexture;
  private sweepElapsed = 0;
  private sweepDrawElapsed = 0;
  private pack: PackSnapshot | null = null;
  private extractingSlot: number | null = null;
  private closedLidOpacity!: UIOpacity;
  private openLidOpacity!: UIOpacity;
  private deckOpacity!: UIOpacity;
  private mouthOpacity!: UIOpacity;
  private collarOpacity!: UIOpacity;
  private lidProgress = 0;
  private lidAnimating = false;
  private extractAfterOpen = false;
  private displayedPackInstanceId = '';

  public initialize(onStart: (slotIndex: number) => void, onSupply: () => void,
    onOpenLid: (instanceId: string) => PackSnapshot | null): void {
    this.onStart = onStart;
    this.onSupply = onSupply;
    this.onOpenLid = onOpenLid;
    this.build();
  }

  protected update(deltaTime: number): void {
    this.refreshLayout();
    if (this.lidAnimating) this.updateLid(deltaTime);
    if (this.startSweep && !this.entryMode && this.pack) {
      this.sweepElapsed = (this.sweepElapsed + Math.max(0, deltaTime)) % 2.8;
      this.sweepDrawElapsed += Math.max(0, deltaTime);
      if (this.sweepDrawElapsed >= 1 / 30) {
        this.sweepDrawElapsed = 0;
        this.paintStartSweep();
      }
    }
  }

  protected onDestroy(): void {
    for (const texture of this.filterTextures) texture.dispose();
    this.filterTextures = [];
    for (const texture of this.inventorySegments) texture.dispose();
    this.inventorySegments = [];
    this.startSweep?.dispose();
    this.backgroundTexture?.dispose();
  }

  public refreshLayout(): void {
    if (!this.contentRoot) return;
    const visibleHeight = view.getVisibleSize().height;
    this.refreshBackground(visibleHeight);
    const unit = this.cssPixelScale();
    const tabHeight = 57 * unit;
    this.refreshBottomTabLayout(unit);
    const availableHeight = Math.max(1, visibleHeight - tabHeight);
    this.contentRoot.getComponent(UITransform)?.setContentSize(DESIGN_WIDTH, availableHeight);
    this.contentRoot.setScale(1, 1, 1);
    this.contentRoot.setPosition(0, tabHeight / 2);
    // The V1.0.8 home is a vertical flex stack: only the workbench takes the
    // remaining height. Navigation is a separate row after it, not a child.
    const headerHeight = 44 * unit;
    const quickHeight = 56 * unit;
    const noticeHeight = 112 * unit; // 44 px announcement + 8 px gap + 60 px inventory
    const navHeight = 44 * unit;
    const footerHeight = 80 * unit; // 20 px quote + 4 px gap + 56 px button
    const reservedHeight = (44 + 8 + 56 + 8 + 112 + 4 + 44 + 80 + 12) * unit;
    const workbenchHeight = Math.max(1, availableHeight - reservedHeight);
    let cursor = availableHeight / 2;
    this.headerRoot.setPosition(0, cursor - headerHeight / 2);
    const settingsScale = headerHeight / 88;
    this.settingsRoot.setScale(settingsScale, settingsScale, 1);
    this.settingsRoot.setPosition(345 - headerHeight / 2, 0);
    cursor -= headerHeight + 8 * unit;
    this.quickRoot.setPosition(0, cursor - quickHeight / 2);
    const quickScale = quickHeight / 112;
    this.quickRoot.setScale(1, quickScale, 1);
    cursor -= quickHeight + 8 * unit;
    this.noticeRoot.setPosition(0, cursor - noticeHeight / 2);
    const noticeScale = noticeHeight / 220;
    this.noticeRoot.setScale(1, noticeScale, 1);
    cursor -= noticeHeight + 4 * unit;
    this.workspaceRoot.setPosition(0, cursor - workbenchHeight / 2);
    const workspaceScale = workbenchHeight / 850;
    this.workspaceRoot.setScale(1, workspaceScale, 1);
    cursor -= workbenchHeight;
    this.packNavigation.setPosition(-133, cursor - navHeight / 2);
    this.packNavigation.getComponent(UITransform)?.setContentSize(424, navHeight);
    cursor -= navHeight;
    this.footerRoot.setPosition(0, cursor - footerHeight / 2);
    this.sloganLabel.node.setPosition(0, 30 * unit);
    this.startRoot.setPosition(0, -12 * unit);
    const startScale = 56 * unit / 112;
    this.startRoot.setScale(1, startScale, 1);
    for (const ornament of this.startRoot.children) {
      if (ornament.name.startsWith('Arrow') || ornament.name.startsWith('Bolt')) {
        ornament.setScale(1, 1 / startScale, 1);
      }
      if (ornament.name.startsWith('BoltTop')) {
        ornament.setPosition(ornament.position.x, 56 - 22.5 / startScale);
      } else if (ornament.name.startsWith('BoltBottom')) {
        ornament.setPosition(ornament.position.x, -56 + 24.5 / startScale);
      }
    }
    this.refreshTypography(workspaceScale, noticeScale, quickScale, startScale);
  }

  private refreshTypography(workspaceScale: number, noticeScale: number,
    quickScale: number, startScale: number): void {
    const cssWidth = screen.windowSize.width / (screen.devicePixelRatio || 1);
    const cssHeight = screen.windowSize.height / (screen.devicePixelRatio || 1);
    const key = `${cssWidth}:${cssHeight}:${workspaceScale}:${noticeScale}:${quickScale}:${startScale}`;
    if (this.typographyLayoutKey === key) return;
    this.typographyLayoutKey = key;
    const unitsPerCssPixel = this.cssPixelScale();
    const fontSize = (minimumPx: number, rpx: number): number =>
      Math.max(minimumPx, rpx * cssWidth / 750) * unitsPerCssPixel;
    const narrow = cssWidth <= 340;
    for (const label of this.quickLabels) {
      label.fontSize = fontSize(12, narrow ? 25 : 27);
      label.lineHeight = label.fontSize;
      label.node.setScale(1, 1 / quickScale, 1);
    }
    for (const icon of this.quickIcons) icon.setScale(1, 1 / quickScale, 1);
    for (const [label, minimumPx, rpx] of [
      [this.announcementTagLabel, 13, 26], [this.announcementLabel, 13, 26],
      [this.inventoryCaptionLabel, 12, 25], [this.packStatusLabel, 0, 54],
      [this.inventoryUnitLabel, 12, 24],
    ] as Array<[Label, number, number]>) {
      label.fontSize = fontSize(minimumPx, rpx);
      label.lineHeight = label.fontSize * (label === this.packStatusLabel ? 0.9 : 1.2);
      label.node.setScale(1, 1 / noticeScale, 1);
    }
    this.layoutInventoryValue(unitsPerCssPixel);
    this.sloganLabel.fontSize = fontSize(12, 22);
    this.sloganLabel.lineHeight = this.sloganLabel.fontSize * 1.35;
    this.sloganLabel.node.getComponent(UITransform)?.setContentSize(690, 20 * unitsPerCssPixel);
    for (const { label, rpx, minimumPx, copyOffsetY } of this.actionTitles) {
      label.fontSize = fontSize(narrow && rpx === 30 ? 12 : minimumPx,
        narrow && rpx === 30 ? 26 : rpx);
      label.lineHeight = label.fontSize * (rpx === 26 ? 1.08 : 1.1);
      label.node.setScale(1, 1 / workspaceScale, 1);
      if (copyOffsetY !== null) label.node.setPosition(label.node.position.x, copyOffsetY / workspaceScale);
    }
    for (const label of this.actionSubtitles) {
      label.fontSize = fontSize(12, narrow ? 19 : 20);
      label.lineHeight = label.fontSize * 1.35;
      label.node.setScale(1, 1 / workspaceScale, 1);
      label.node.setPosition(label.node.position.x, -20 / workspaceScale);
    }
    for (const label of this.statusLabels) {
      label.fontSize = fontSize(12, narrow ? 19 : 22);
      label.lineHeight = label.fontSize * 1.3;
      label.node.setScale(1, 1 / workspaceScale, 1);
      label.node.setPosition(label.node.position.x, 13 / workspaceScale);
    }
    for (const label of this.statusValues) {
      label.fontSize = fontSize(12, narrow ? 19 : 23);
      label.lineHeight = label.fontSize * 1.2;
      label.node.setScale(1, 1 / workspaceScale, 1);
      label.node.setPosition(label.node.position.x, -14 / workspaceScale);
    }
    this.layoutSideCards(workspaceScale, cssWidth, cssHeight, unitsPerCssPixel);
    this.packSwitchCaption.fontSize = fontSize(11, 20);
    this.packSwitchCaption.lineHeight = this.packSwitchCaption.fontSize * 1.5;
    this.packSwitchCaption.node.setScale(1, 1, 1);
    const arrowSize = 44 * unitsPerCssPixel;
    const arrowX = 424 / 2 - arrowSize / 2;
    this.packSwitchArrows.forEach((arrow, index) => {
      arrow.getComponent(UITransform)?.setContentSize(arrowSize, arrowSize);
      arrow.setPosition(index === 0 ? -arrowX : arrowX, 0);
      arrow.setScale(1, 1, 1);
    });
    this.packSwitchCaption.node.getComponent(UITransform)?.setContentSize(
      Math.max(1, 424 - 2 * arrowSize), 15 * unitsPerCssPixel);
    this.startButtonLabel.fontSize = fontSize(0, this.pack === null ? 46 : 62);
    this.startButtonLabel.lineHeight = this.startButtonLabel.fontSize * 1.05;
    this.startSweep.node.setScale(1, 1 / startScale, 1);
    this.paintStartSweep();
  }

  private layoutInventoryValue(unitsPerCssPixel: number): void {
    // CSS uses an unconstrained flex row. Measuring the actual number prevents
    // Label.Overflow.SHRINK from reducing 1/10 or 10/10 inside a 116-unit box.
    const number = this.packStatusLabel.string;
    const ctx = this.startSweep.context;
    ctx.save();
    ctx.font = `560 ${this.packStatusLabel.fontSize}px "Arial Narrow", Arial, sans-serif`;
    const numberWidth = Math.ceil(ctx.measureText(number).width
      + Math.max(0, number.length - 1) * this.packStatusLabel.spacingX + 4 * unitsPerCssPixel);
    ctx.restore();
    const left = -345 + 8;
    this.packStatusLabel.overflow = Label.Overflow.CLAMP;
    this.packStatusLabel.enableWrapText = false;
    this.packStatusLabel.horizontalAlign = HorizontalTextAlignment.LEFT;
    this.packStatusLabel.node.getComponent(UITransform)?.setContentSize(numberWidth,
      Math.max(58, this.packStatusLabel.lineHeight));
    this.packStatusLabel.node.setPosition(left + numberWidth / 2, -70);
    this.inventoryUnitLabel.horizontalAlign = HorizontalTextAlignment.LEFT;
    const unitWidth = Math.max(34, this.inventoryUnitLabel.fontSize * 1.2);
    this.inventoryUnitLabel.node.getComponent(UITransform)?.setContentSize(unitWidth,
      Math.max(34, this.inventoryUnitLabel.lineHeight));
    this.inventoryUnitLabel.node.setPosition(left + numberWidth + 10 + unitWidth / 2,
      -70 - (this.packStatusLabel.lineHeight - this.inventoryUnitLabel.lineHeight) / 2);
  }

  private layoutSideCards(workspaceScale: number,
    cssWidth: number, cssHeight: number, unitsPerCssPixel: number): void {
    const localPerCssY = unitsPerCssPixel / workspaceScale;
    const railHeight = 850 * 0.954;
    const railCssHeight = railHeight / localPerCssY;
    const ordinaryTargetCss = 44;
    const gapCss = 4;
    // Preserve room for the three status rows before allocating the four action cards.
    const ordinaryCss = Math.min(ordinaryTargetCss,
      Math.max(38, (railCssHeight - 128 - gapCss * 4) / 4));
    const ordinaryHeight = ordinaryCss * localPerCssY;
    const gap = gapCss * localPerCssY;
    const todayHeight = Math.max(1, railHeight - ordinaryHeight * 4 - gap * 4);
    let cursor = 850 / 2 - railHeight * 0.0352;
    for (const card of this.sideCards) {
      const height = card.kind === 'today' ? todayHeight : ordinaryHeight;
      card.node.setPosition(221, cursor - height / 2);
      card.node.getComponent(UITransform)?.setContentSize(248, height);
      this.paintInfoCardFrame(card.frame, height, card.kind === 'gift');
      const markScale = card.kind === 'gift' ? 22 * unitsPerCssPixel / 44 : 1;
      card.mark.setScale(markScale, markScale / workspaceScale, 1);
      if (card.kind === 'today') {
        const headerY = height / 2 - 24 * localPerCssY;
        card.mark.setPosition(card.mark.position.x, headerY);
        card.title.node.setPosition(card.title.node.position.x, headerY);
        const visibleHeightCss = height / localPerCssY;
        const rowsTop = visibleHeightCss / 2 - 40;
        const rowsBottom = -visibleHeightCss / 2 + 8;
        card.rows.forEach((row, index) => {
          row.setPosition(0, (rowsTop - (index + 0.5) * (rowsTop - rowsBottom) / 3) * localPerCssY);
          row.getChildByName('StatusIcon')?.setScale(1, 1 / workspaceScale, 1);
        });
      } else if (card.subtitle) {
        const titleCss = card.title.fontSize / unitsPerCssPixel;
        const subtitleCss = card.subtitle.fontSize / unitsPerCssPixel;
        const titleLineCss = titleCss * (card.kind === 'lab' ? 1.08 : 1.1);
        const subtitleLineCss = subtitleCss * 1.35;
        const preferredGapCss = (cssHeight <= 740 ? 4 : 8) * cssWidth / 750;
        const copyGapCss = Math.max(0, Math.min(preferredGapCss,
          ordinaryCss - titleLineCss - subtitleLineCss - 2));
        card.title.node.setPosition(card.title.node.position.x,
          (subtitleLineCss + copyGapCss) * localPerCssY / 2);
        card.subtitle.node.setPosition(card.subtitle.node.position.x,
          -(titleLineCss + copyGapCss) * localPerCssY / 2);
        card.title.node.getComponent(UITransform)?.setContentSize(146,
          titleLineCss * unitsPerCssPixel);
        card.subtitle.node.getComponent(UITransform)?.setContentSize(146,
          subtitleLineCss * unitsPerCssPixel);
      }
      cursor -= height + gap;
    }
  }

  public defaultSlot(): number {
    if (!this.pack) return -1;
    if (this.pack.slots[this.selectedSlot] === 'available') return this.selectedSlot;
    return this.pack.slots.findIndex((slot) => slot === 'available');
  }

  public setPack(pack: PackSnapshot | null): void {
    const instanceChanged = pack?.instanceId !== this.displayedPackInstanceId;
    this.pack = pack;
    this.displayedPackInstanceId = pack?.instanceId ?? '';
    if (instanceChanged || !this.lidAnimating) {
      this.lidAnimating = false;
      this.extractAfterOpen = false;
      this.lidProgress = pack?.lidOpen ? 1 : 0;
      this.renderLid();
    }
    const remaining = pack ? countAvailableSlots(pack) : 0;
    this.inventoryCaptionLabel.string = pack ? '本盒剩余' : '烟盒状态';
    this.packStatusLabel.string = pack ? `${remaining}/10` : '--';
    this.layoutInventoryValue(this.cssPixelScale());
    this.inventoryUnitLabel.string = pack ? '支' : '';
    for (let index = 0; index < this.inventorySegments.length; index += 1) {
      const segment = this.inventorySegments[index];
      const filled = index < remaining;
      segment.redraw((ctx) => {
        const width = 44;
        const height = 18;
        const radius = 7;
        ctx.beginPath();
        ctx.moveTo(-width / 2 + radius, -height / 2);
        ctx.lineTo(width / 2 - radius, -height / 2);
        ctx.quadraticCurveTo(width / 2, -height / 2, width / 2, -height / 2 + radius);
        ctx.lineTo(width / 2, height / 2 - radius);
        ctx.quadraticCurveTo(width / 2, height / 2, width / 2 - radius, height / 2);
        ctx.lineTo(-width / 2 + radius, height / 2);
        ctx.quadraticCurveTo(-width / 2, height / 2, -width / 2, height / 2 - radius);
        ctx.lineTo(-width / 2, -height / 2 + radius);
        ctx.quadraticCurveTo(-width / 2, -height / 2, -width / 2 + radius, -height / 2);
        ctx.closePath();
        if (filled) {
          const gradient = ctx.createLinearGradient(-width / 2, 0, width / 2, 0);
          gradient.addColorStop(0, '#f37c2e');
          gradient.addColorStop(1, '#efae58');
          ctx.fillStyle = gradient;
        } else {
          ctx.fillStyle = '#292927';
        }
        ctx.fill();
        if (filled) {
          ctx.fillStyle = 'rgba(255,239,202,0.24)';
          ctx.fillRect(-width / 2 + radius, height / 2 - 3, width - radius * 2, 2);
        }
      });
    }
    this.startButton.interactable = !!pack && !this.lidAnimating;
    this.startButtonLabel.string = pack === null ? '烟盒不可用' : remaining > 0 ? '来一根' : '补一盒';
    const cssWidth = screen.windowSize.width / (screen.devicePixelRatio || 1);
    this.startButtonLabel.fontSize = (pack === null ? 46 : 62)
      * cssWidth / 750 * this.cssPixelScale();
    this.startButtonLabel.lineHeight = this.startButtonLabel.fontSize * 1.05;
    this.paintStartSweep();
    this.refreshSlotVisibility();
  }

  public setSmokedCount(count: number | null): void {
    this.smokedCountLabel.string = count === null ? '本机存档不可用' : `累计已抽 ${count} 根`;
  }

  private beginOpenLid(extractAfterOpen: boolean): void {
    if (this.entryMode || this.lidAnimating || !this.pack || this.pack.lidOpen) {
      if (extractAfterOpen && this.pack?.lidOpen) this.startDefaultSlot();
      return;
    }
    const opened = this.onOpenLid?.(this.pack.instanceId);
    if (!opened) return;
    this.pack = opened;
    this.lidAnimating = true;
    this.extractAfterOpen = extractAfterOpen;
    this.startButton.interactable = false;
  }

  private updateLid(deltaTime: number): void {
    this.lidProgress = Math.min(1,
      this.lidProgress + Math.max(0, deltaTime) / HomeController.LID_SECONDS);
    this.renderLid();
    if (this.lidProgress < 1) return;
    this.lidAnimating = false;
    this.startButton.interactable = !!this.pack;
    const shouldExtract = this.extractAfterOpen;
    this.extractAfterOpen = false;
    if (shouldExtract) this.startDefaultSlot();
  }

  private renderLid(): void {
    if (!this.closedLidOpacity || !this.openLidOpacity) return;
    // Legacy pack-box cross-fades the outer lid against the inner face over 500 ms.
    const progress = Math.max(0, Math.min(1, this.lidProgress));
    const eased = progress * (2 - progress);
    this.closedLidOpacity.opacity = Math.round(255 * (1 - eased));
    this.openLidOpacity.opacity = Math.round(255 * eased);
    this.deckOpacity.opacity = Math.round(255 * eased);
    this.mouthOpacity.opacity = Math.round(255 * eased);
    this.collarOpacity.opacity = Math.round(255 * eased);
    this.refreshSlotVisibility();
  }

  private startDefaultSlot(): void {
    if (this.entryMode || this.lidAnimating || !this.pack?.lidOpen) return;
    const slot = this.defaultSlot();
    if (slot >= 0) this.onStart?.(slot);
    else this.onSupply?.();
  }

  public setEntryMode(active: boolean): void {
    this.entryMode = active;
    if (!active) this.setSecondaryOpacity(1);
  }

  /** Only non-pack chrome fades first; the pack remains fully opaque. */
  public setSecondaryOpacity(value: number): void {
    const opacity = Math.round(255 * Math.max(0, Math.min(1, value)));
    for (const node of this.secondaryNodes) node.active = opacity > 0;
    for (const target of this.secondaryOpacities) target.opacity = opacity;
  }

  private collectSecondaryOpacity(root: Node): void {
    const visit = (node: Node): void => {
      if (node.getComponent(Graphics) || node.getComponent(Sprite) || node.getComponent(Label)) {
        this.secondaryOpacities.push(node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity));
      }
      for (const child of node.children) visit(child);
    };
    visit(root);
  }

  public setExtractingSlot(index: number | null): void {
    this.extractingSlot = index;
    this.refreshSlotVisibility();
  }

  private refreshSlotVisibility(): void {
    for (let slotIndex = 0; slotIndex < this.slots.length; slotIndex += 1) {
      const opacity = this.slots[slotIndex].getComponent(UIOpacity);
      if (opacity) opacity.opacity = this.lidProgress >= 1 && this.pack?.slots[slotIndex] === 'available'
        && slotIndex !== this.extractingSlot ? 255 : 0;
    }
  }

  public getExtractionSource(slotIndex: number, target: Node): ExtractionSource | null {
    if (!this.pack?.lidOpen || this.lidAnimating || this.pack.slots[slotIndex] !== 'available') return null;
    const slot = this.slots[slotIndex];
    const targetTransform = target.getComponent(UITransform);
    const slotTransform = slot?.getComponent(UITransform);
    const collarTransform = this.collar?.getComponent(UITransform);
    if (!slotTransform || !collarTransform || !targetTransform) return null;
    const toLocal = (x: number, y: number): Vec3 => targetTransform.convertToNodeSpaceAR(new Vec3(x, y, 0));
    const rect = slotTransform.getBoundingBoxToWorld();
    const lower = toLocal(rect.xMin, rect.yMin);
    const upper = toLocal(rect.xMax, rect.yMax);
    const collarRect = collarTransform.getBoundingBoxToWorld();
    const coverTop = toLocal(collarRect.xMin, collarRect.yMax).y;
    const frontOccluders = slotIndex < 5 ? this.frontSlots.filter((_, index) =>
      this.pack?.slots[index + 5] === 'available').map((front) => {
      const bounds = front.getComponent(UITransform)!.getBoundingBoxToWorld();
      return {
        left: toLocal(bounds.xMin, bounds.yMin).x,
        right: toLocal(bounds.xMax, bounds.yMin).x,
        top: toLocal(bounds.xMin, bounds.yMax).y,
      };
    }) : [];
    return {
      centerX: (lower.x + upper.x) / 2,
      centerY: (lower.y + upper.y) / 2,
      width: upper.x - lower.x,
      height: upper.y - lower.y,
      coverTop,
      frontOccluders,
      liftRatio: slotIndex < 5 ? 0.86 : 0.95,
    };
  }

  private build(): void {
    this.backgroundTexture = new CanvasTexture('HomeBackground', this.node, DESIGN_WIDTH, Math.max(DESIGN_HEIGHT, view.getVisibleSize().height));
    this.refreshBackground(view.getVisibleSize().height);
    this.contentRoot = createNode('HomeContent', this.node, DESIGN_WIDTH, DESIGN_HEIGHT);
    this.buildBottomTabBar();
    this.headerRoot = createNode('HomeTopbar', this.contentRoot, 690, 76);
    // V1.0.8's topbar has the settings/guide controls, not a second title banner.
    this.buildSettingsButton(this.headerRoot);

    // V1.0.8 effective rule: the four-way quick bar is 56 CSS px at the
    // 375 px phone baseline, i.e. 112 units in this 750-wide design space.
    this.quickRoot = this.createChamferedPanel('HomeQuickActions', this.contentRoot,
      690, 112, 15, '#111414', '#4a4338');
    const quickActions = ['打卡', '戒烟', '收烟榜', '成就'] as const;
    quickActions.forEach((title, index) => this.buildQuickAction(title, index));

    this.noticeRoot = createNode('HomeNotices', this.contentRoot, 690, 220);
    const announcement = createRect('AnnouncementBar', this.noticeRoot, 690, 88,
      '#101211', 0, 66, 0, '#3f3b34');
    this.announcementTagLabel = createLabel('AnnouncementTag', announcement, '公告', 24, Palette.gold, 92, 52, -280);
    this.announcementLabel = createLabel('Announcement', announcement, '限定首发 · 王溪 WANG·XI', 26,
      Palette.goldMuted, 520, 60, 35);
    this.inventoryCaptionLabel = createLabel('InventoryCaption', this.noticeRoot, '本盒剩余',
      25, '#d1b38b', 150, 32, -274, -27);
    this.packStatusLabel = createLabel('InventoryNumber', this.noticeRoot, '10/10',
      54, '#e4d8c4', 116, 58, -282, -70);
    this.packStatusLabel.fontFamily = 'Arial Narrow';
    this.packStatusLabel.spacingX = -1;
    this.inventoryUnitLabel = createLabel('InventoryUnit', this.noticeRoot, '支',
      24, '#d1b38b', 34, 34, -210, -73);
    for (let index = 0; index < 10; index += 1) {
      const segment = new CanvasTexture(`InventorySegment${index}`, this.noticeRoot, 44, 18);
      segment.node.setPosition(-142 + index * 50, -70);
      this.inventorySegments.push(segment);
    }

    this.workspaceRoot = createNode('HomeWorkbench', this.contentRoot, 690, 850);
    this.buildPack();
    // 61.5% pack column + 18 rpx gap leaves a 248 rpx side rail whose right
    // edge is exactly the quick bar/achievement edge at x=345.
    const sideRailX = 221;
    // In the old pack, the 95.4%-high rail starts at the workbench top and is
    // translated down by 3.52% of its own height. On this 850-unit workbench
    // its visible top/bottom are +396/-414, matching the scaled pack artwork.
    // Four 44 px action cards keep 4 px gaps; Today's status fills the remainder.
    const sideRailTop = 850 / 2 - 850 * 0.954 * 0.0352;
    const sideRailOffset = sideRailTop - 376;
    this.smokedCountLabel = this.buildInfoCard('记录', '累计已抽 0 根', sideRailX, 332 + sideRailOffset, 'records', 88);
    this.buildInfoCard('烟雾实验室', '打卡2天解锁', sideRailX, 236 + sideRailOffset, 'lab', 88);
    this.buildInfoCard('换一盒', '选择烟盒', sideRailX, 140 + sideRailOffset, 'switch', 88);
    this.buildInfoCard('今日状态', '', sideRailX, -126 + sideRailOffset, 'today', 428);
    this.buildInfoCard('派烟', '', sideRailX, -392 + sideRailOffset, 'gift', 88);
    this.buildPackNavigation();

    this.footerRoot = createNode('HomeFooter', this.contentRoot, 690, 260);
    this.sloganLabel = createLabel('Slogan', this.footerRoot, '“每一次线下克制，都是在靠近更好的自己”',
      22, Palette.goldMuted, 620, 42, 0, 85);
    const startRoot = this.createChamferedPanel('StartButton', this.footerRoot,
      690, 112, 20, '#111214', '#4b4945');
    this.startRoot = startRoot;
    this.startButton = startRoot.addComponent(Button);
    this.startButton.transition = Button.Transition.SCALE;
    this.startButton.zoomScale = 0.96;
    const metal = new CanvasTexture('StartMetal', startRoot, 682, 104);
    this.filterTextures.push(metal);
    metal.redraw((ctx) => {
      const width = 682;
      const height = 104;
      const cut = 18;
      ctx.beginPath();
      ctx.moveTo(-width / 2 + cut, height / 2);
      ctx.lineTo(width / 2 - cut, height / 2);
      ctx.lineTo(width / 2, height / 2 - cut);
      ctx.lineTo(width / 2, -height / 2 + cut);
      ctx.lineTo(width / 2 - cut, -height / 2);
      ctx.lineTo(-width / 2 + cut, -height / 2);
      ctx.lineTo(-width / 2, -height / 2 + cut);
      ctx.lineTo(-width / 2, height / 2 - cut);
      ctx.closePath();
      ctx.clip();
      const vertical = ctx.createLinearGradient(0, height / 2, 0, -height / 2);
      vertical.addColorStop(0, '#343432');
      vertical.addColorStop(0.24, '#111214');
      vertical.addColorStop(0.53, '#070809');
      vertical.addColorStop(0.84, '#1b1d1e');
      vertical.addColorStop(1, '#2a2a28');
      ctx.fillStyle = vertical;
      ctx.fillRect(-width / 2, -height / 2, width, height);
      const shine = ctx.createLinearGradient(-width / 2, height / 2, width / 2, -height / 2);
      shine.addColorStop(0, 'rgba(255,255,255,0.11)');
      shine.addColorStop(0.17, 'rgba(255,255,255,0)');
      shine.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = shine;
      ctx.fillRect(-width / 2, -height / 2, width, height);
    });
    const inner = new CanvasTexture('StartInner', startRoot, 650, 78);
    this.filterTextures.push(inner);
    inner.redraw((ctx) => {
      const width = 650;
      const height = 78;
      const cut = 16;
      const trace = (): void => {
        ctx.beginPath();
        ctx.moveTo(-width / 2 + cut, height / 2);
        ctx.lineTo(width / 2 - cut, height / 2);
        ctx.lineTo(width / 2, height / 2 - cut);
        ctx.lineTo(width / 2, -height / 2 + cut);
        ctx.lineTo(width / 2 - cut, -height / 2);
        ctx.lineTo(-width / 2 + cut, -height / 2);
        ctx.lineTo(-width / 2, -height / 2 + cut);
        ctx.lineTo(-width / 2, height / 2 - cut);
        ctx.closePath();
      };
      trace();
      ctx.save();
      ctx.clip();
      const orange = ctx.createLinearGradient(0, height / 2, 0, -height / 2);
      orange.addColorStop(0, '#ef6415');
      orange.addColorStop(0.5, '#db4b0d');
      orange.addColorStop(1, '#a92c09');
      ctx.fillStyle = orange;
      ctx.fillRect(-width / 2, -height / 2, width, height);
      const diagonal = ctx.createLinearGradient(-width / 2, height / 2, width / 2, -height / 2);
      diagonal.addColorStop(0, 'rgba(255,226,150,0.24)');
      diagonal.addColorStop(0.28, 'rgba(255,226,150,0)');
      diagonal.addColorStop(0.69, 'rgba(91,12,3,0)');
      diagonal.addColorStop(1, 'rgba(91,12,3,0.20)');
      ctx.fillStyle = diagonal;
      ctx.fillRect(-width / 2, -height / 2, width, height);
      ctx.fillStyle = 'rgba(255,190,91,0.18)';
      ctx.fillRect(-width / 2 + 18, height / 2 - 12, width - 36, 5);
      ctx.fillStyle = 'rgba(72,9,4,0.30)';
      ctx.fillRect(-width / 2 + 18, -height / 2 + 7, width - 36, 7);
      ctx.restore();
      trace();
      ctx.strokeStyle = '#b74a0d';
      ctx.lineWidth = 3;
      ctx.stroke();
    });
    this.startButtonLabel = createLabel('Label', startRoot, '来一根', 62,
      '#ffe0a2', 620, 96);
    // Keep one string owner, but render base text and sweep into one Canvas so
    // font metrics cannot drift and create a visible doubled glyph.
    this.startButtonLabel.node.active = false;
    this.startSweep = new CanvasTexture('StartLabelSweep', startRoot, 620, 96);
    this.buildStartArrows(startRoot);
    this.buildStartBolts(startRoot);
    startRoot.on(Button.EventType.CLICK, () => {
      if (this.entryMode || this.lidAnimating || !this.pack) return;
      if (!this.pack.lidOpen) this.beginOpenLid(true);
      else this.startDefaultSlot();
    });
    this.secondaryNodes = [this.headerRoot, this.quickRoot, this.noticeRoot, this.footerRoot, this.bottomTabRoot,
      this.packNavigation, ...this.workspaceRoot.children.filter((child) => child !== this.packRoot)];
    for (const node of this.secondaryNodes) this.collectSecondaryOpacity(node);
    this.refreshLayout();
  }

  /** V1.0.8 custom tab bar: visual-only in this demo; both buttons intentionally have no handler. */
  private buildBottomTabBar(): void {
    this.bottomTabRoot = createNode('HomeBottomTabs', this.node, DESIGN_WIDTH, 57);
    this.bottomTabRoot.addComponent(BlockInputEvents);
    this.bottomTabGraphics = this.bottomTabRoot.addComponent(Graphics);
    alignWidget(this.bottomTabRoot, { left: 0, right: 0, bottom: 0 });

    this.homeTabRoot = createNode('HomeTab', this.bottomTabRoot, DESIGN_WIDTH / 2, 48);
    this.homeTabRoot.addComponent(Button).transition = Button.Transition.NONE;
    this.homeTabIcon = createNode('CigaretteIcon', this.homeTabRoot, 24, 24);
    this.paintTabCigarette(this.homeTabIcon.addComponent(Graphics), true);
    this.homeTabLabel = createLabel('Label', this.homeTabRoot, '来一根', 11,
      '#f0c58b', DESIGN_WIDTH / 2, 15);

    this.worldTabRoot = createNode('WorldTab', this.bottomTabRoot, DESIGN_WIDTH / 2, 48);
    this.worldTabRoot.addComponent(Button).transition = Button.Transition.NONE;
    this.worldTabIcon = createNode('GlobeIcon', this.worldTabRoot, 24, 24);
    this.paintTabGlobe(this.worldTabIcon.addComponent(Graphics), false);
    this.worldTabLabel = createLabel('Label', this.worldTabRoot, '全服', 11,
      '#aa9b87', DESIGN_WIDTH / 2, 15);
  }

  private refreshBottomTabLayout(unit: number): void {
    if (!this.bottomTabRoot || Math.abs(this.bottomTabUnit - unit) < 0.001) return;
    this.bottomTabUnit = unit;
    const height = 57 * unit;
    const itemHeight = 48 * unit;
    this.bottomTabRoot.getComponent(UITransform)?.setContentSize(DESIGN_WIDTH, height);
    this.bottomTabRoot.getComponent(Widget)?.updateAlignment();

    this.bottomTabGraphics.clear();
    this.bottomTabGraphics.fillColor = color('#0d1010');
    this.bottomTabGraphics.rect(-DESIGN_WIDTH / 2, -height / 2, DESIGN_WIDTH, height);
    this.bottomTabGraphics.fill();
    this.bottomTabGraphics.fillColor = color('#514739');
    this.bottomTabGraphics.rect(-DESIGN_WIDTH / 2, height / 2 - unit, DESIGN_WIDTH, unit);
    this.bottomTabGraphics.fill();
    this.bottomTabGraphics.fillColor = color('#f06013');
    this.bottomTabGraphics.rect(-DESIGN_WIDTH / 4 - 12 * unit,
      height / 2 - 2 * unit, 24 * unit, 2 * unit);
    this.bottomTabGraphics.fill();

    const itemCenterY = height / 2 - 28 * unit;
    for (const [node, x] of [[this.homeTabRoot, -DESIGN_WIDTH / 4],
      [this.worldTabRoot, DESIGN_WIDTH / 4]] as Array<[Node, number]>) {
      node.getComponent(UITransform)?.setContentSize(DESIGN_WIDTH / 2, itemHeight);
      node.setPosition(x, itemCenterY);
    }
    this.homeTabIcon.setPosition(0, 8 * unit);
    this.worldTabIcon.setPosition(0, 8 * unit);
    this.homeTabIcon.setScale(unit, unit, 1);
    this.worldTabIcon.setScale(unit, unit, 1);
    for (const label of [this.homeTabLabel, this.worldTabLabel]) {
      label.fontSize = 11 * unit;
      label.lineHeight = 15 * unit;
      label.node.getComponent(UITransform)?.setContentSize(DESIGN_WIDTH / 2, 15 * unit);
      label.node.setPosition(0, -10 * unit);
    }
  }

  private cssPixelScale(): number {
    const cssWidth = screen.windowSize.width / (screen.devicePixelRatio || 1);
    return cssWidth > 0 ? view.getVisibleSize().width / cssWidth : 1;
  }

  private paintTabCigarette(graphics: Graphics, selected: boolean): void {
    graphics.strokeColor = color('#cbb47d', selected ? 255 : 166);
    graphics.lineWidth = 1.3;
    graphics.lineCap = Graphics.LineCap.ROUND;
    graphics.lineJoin = Graphics.LineJoin.ROUND;
    graphics.rect(-9, -9, 15, 4);
    graphics.moveTo(2, -9);
    graphics.lineTo(2, -5);
    graphics.moveTo(10, -9);
    graphics.lineTo(10, -5);
    graphics.moveTo(6, -9);
    graphics.lineTo(8, -9);
    graphics.lineTo(8, -5);
    graphics.moveTo(2, 0);
    graphics.bezierCurveTo(6, 3, -2, 4, 2, 7);
    graphics.moveTo(7, 0);
    graphics.bezierCurveTo(11, 3, 3, 5, 7, 9);
    graphics.stroke();
  }

  private paintTabGlobe(graphics: Graphics, selected: boolean): void {
    graphics.strokeColor = color('#cbb47d', selected ? 255 : 166);
    graphics.lineWidth = 1.3;
    graphics.lineCap = Graphics.LineCap.ROUND;
    graphics.lineJoin = Graphics.LineJoin.ROUND;
    graphics.circle(0, 0, 9);
    graphics.ellipse(0, 0, 4, 9);
    graphics.moveTo(-9, 0);
    graphics.lineTo(9, 0);
    graphics.moveTo(-7, 5);
    graphics.lineTo(7, 5);
    graphics.moveTo(-7, -5);
    graphics.lineTo(7, -5);
    graphics.stroke();
  }

  /** Confirmed visual target: 108° gold band moving from left to right. */
  private paintStartSweep(): void {
    if (!this.startSweep || !this.startButtonLabel) return;
    const label = this.startButtonLabel.string;
    const phase = this.sweepElapsed / 2.8;
    this.startSweep.redraw((ctx) => {
      ctx.save();
      // CanvasTexture already flips Y into Cocos coordinates; flip text back upright.
      ctx.scale(1, -1);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const fontSize = this.startButtonLabel.fontSize;
      ctx.font = `780 ${fontSize}px "PingFang SC", "Microsoft YaHei UI", sans-serif`;
      const spacing = fontSize * 0.11;
      const characters = Array.from(label);
      const widths = characters.map((character) => ctx.measureText(character).width);
      const totalWidth = widths.reduce((sum, width) => sum + width, 0)
        + Math.max(0, characters.length - 1) * spacing;
      const drawText = (): void => {
        let cursor = -totalWidth / 2;
        characters.forEach((character, index) => {
          const width = widths[index];
          ctx.fillText(character, cursor + width / 2, 0);
          cursor += width + spacing;
        });
      };
      ctx.shadowColor = 'rgba(255,172,52,0.28)';
      ctx.shadowBlur = 26;
      ctx.fillStyle = '#ffe0a2';
      drawText();
      ctx.shadowColor = 'rgba(255,216,112,0.50)';
      ctx.shadowBlur = 12;
      drawText();
      ctx.shadowColor = 'rgba(0,0,0,0)';
      ctx.shadowBlur = 0;
      if (this.pack) {
        const center = -360 + 720 * phase;
        const gradient = ctx.createLinearGradient(center - 112, 20, center + 112, -20);
        gradient.addColorStop(0, 'rgba(255,251,228,0)');
        gradient.addColorStop(0.38, 'rgba(255,251,228,0)');
        gradient.addColorStop(0.46, '#fffbe4');
        gradient.addColorStop(0.51, '#fff2b2');
        gradient.addColorStop(0.55, '#ffd766');
        gradient.addColorStop(0.63, 'rgba(255,215,102,0)');
        gradient.addColorStop(1, 'rgba(255,215,102,0)');
        ctx.fillStyle = gradient;
        drawText();
      }
      ctx.restore();
    });
  }

  private buildStartArrows(parent: Node): void {
    const drawPair = (name: string, x: number, pointsRight: boolean): void => {
      const node = createNode(name, parent, 30, 30, x, 0);
      const graphic = node.addComponent(Graphics);
      graphic.strokeColor = color('#2b160c');
      graphic.lineWidth = 5;
      graphic.lineJoin = Graphics.LineJoin.MITER;
      for (const offset of [-5.5, 5.5]) {
        if (pointsRight) {
          graphic.moveTo(offset - 5.5, 10.5);
          graphic.lineTo(offset + 5, 0);
          graphic.lineTo(offset - 5.5, -10.5);
        } else {
          graphic.moveTo(offset + 5.5, 10.5);
          graphic.lineTo(offset - 5, 0);
          graphic.lineTo(offset + 5.5, -10.5);
        }
      }
      graphic.stroke();
    };
    drawPair('StartIndicator', -285, false);
    drawPair('StartGrip', 285, true);
  }

  private buildStartBolts(parent: Node): void {
    const positions = [
      ['TopLeft', -318.5, 33.5], ['TopRight', 318.5, 33.5],
      ['BottomLeft', -318.5, -31.5], ['BottomRight', 318.5, -31.5],
    ] as const;
    for (const [name, x, y] of positions) {
      const bolt = createNode(`Bolt${name}`, parent, 15, 15, x, y).addComponent(Graphics);
      bolt.fillColor = color('#5a5955');
      bolt.circle(0, 0, 7.5);
      bolt.fill();
      bolt.fillColor = color('#090a0b');
      bolt.circle(0, 0, 5.3);
      bolt.fill();
      bolt.fillColor = color('#74736d');
      bolt.circle(-1.7, 1.8, 1.5);
      bolt.fill();
    }
  }

  private buildPack(): void {
    const boxWidth = 330;
    const boxHeight = 600;
    const packRoot = createNode('PackRoot', this.workspaceRoot, boxWidth, boxHeight, -133, 0);
    this.packRoot = packRoot;
    packRoot.on(Node.EventType.TOUCH_END, () => this.beginOpenLid(false));
    // Legacy pack-box is 86% of the 61.5% left column, then the active pack is
    // enlarged by 1.06. That yields about 387/690 rendered width. Its 48vh
    // workbench also makes the opened pack noticeably taller than the first pass.
    packRoot.setScale(1.17, 1.5, 1);
    const yFromTop = (fraction: number): number => boxHeight * (0.5 - fraction);
    const bodyWidth = boxWidth * 0.84;
    const bodyX = boxWidth * (0.13 + 0.84 / 2 - 0.5);
    const bodyTop = yFromTop(0.30);
    const bodyBottom = yFromTop(0.96);
    const bodyHeight = bodyTop - bodyBottom;
    const bodyY = (bodyTop + bodyBottom) / 2;

    const groundShadow = new CanvasTexture('PackShadow', packRoot,
      Math.round(boxWidth * 0.96), Math.round(boxHeight * 0.15));
    this.filterTextures.push(groundShadow);
    groundShadow.node.setPosition(-5, yFromTop(0.96) - boxHeight * 0.015);
    groundShadow.redraw((ctx) => {
      ctx.save();
      ctx.filter = 'blur(16px)';
      ctx.fillStyle = 'rgba(0,0,0,0.66)';
      ctx.beginPath();
      ctx.ellipse(-boxWidth * 0.01, 0, boxWidth * 0.40, boxHeight * 0.035,
        Math.PI / 90, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
    const lidTop = yFromTop(0.06);
    const lidBottom = yFromTop(0.30);
    const lidY = (lidTop + lidBottom) / 2;
    const closedLid = createNode('ClosedLid', packRoot, boxWidth, lidTop - lidBottom, 0, lidY);
    this.closedLidOpacity = closedLid.addComponent(UIOpacity);
    createRect('LidSide', closedLid, boxWidth * 0.08, lidTop - lidBottom,
      '#111a1a', -boxWidth * 0.41, 0, 3);
    const lidHeight = lidTop - lidBottom;
    const lidFrame = createRect('LidFrame', closedLid, bodyWidth, lidHeight,
      Palette.gold, bodyX, 0, 5, '#70664f');
    // The closed lid uses the same WangXi artwork as the body. Legacy CSS enlarges it
    // to 122% x 375%, clips it to the lid, and aligns the artwork to the top-left.
    this.addPackSkin(lidFrame, bodyWidth - 4, lidHeight - 4, 1.22, 3.75, 'LidSkin', 'top');
    const lidCode = createLabel('LidCode', closedLid, 'WANG·XI', 18,
      Palette.green, bodyWidth - 30, 36, bodyX, 0);
    this.applyPackCopyShadow(lidCode);
    const openLid = createNode('OpenLidInterior', packRoot, boxWidth, lidTop - lidBottom, 0, lidY);
    this.openLidOpacity = openLid.addComponent(UIOpacity);
    // Open-lid rear face: green structural edge, beige lining, inset seam and bottom lip.
    // These are one continuous lid assembly; there is no standalone switch/bar.
    const innerSideWidth = boxWidth * 0.08;
    const innerSide = new CanvasTexture('LidInnerSide', openLid,
      Math.round(innerSideWidth), Math.round(lidHeight));
    innerSide.node.setPosition(-boxWidth * 0.41, 0);
    innerSide.redraw((ctx) => {
      ctx.fillStyle = Palette.green;
      ctx.fillRect(-innerSideWidth / 2, -lidHeight / 2, innerSideWidth, lidHeight);
      const sideShade = ctx.createLinearGradient(-innerSideWidth / 2, 0, innerSideWidth / 2, 0);
      sideShade.addColorStop(0, 'rgba(0,0,0,0.46)');
      sideShade.addColorStop(1, 'rgba(255,255,255,0.06)');
      ctx.fillStyle = sideShade;
      ctx.fillRect(-innerSideWidth / 2, -lidHeight / 2, innerSideWidth, lidHeight);
      ctx.fillStyle = 'rgba(8,18,16,0.92)';
      ctx.fillRect(-innerSideWidth / 2, lidHeight / 2 - 5, innerSideWidth, 5);
      ctx.fillStyle = 'rgba(8,18,16,0.84)';
      ctx.fillRect(-innerSideWidth / 2, -lidHeight / 2, innerSideWidth, 3);
    });
    createRect('LidInnerEdge', openLid, bodyWidth, lidHeight,
      Palette.green, bodyX, 0, 3, '#0d2924');
    const innerWidth = bodyWidth - 8;
    const innerHeight = lidHeight - 12;
    const inner = createRect('LidInterior', openLid, innerWidth, innerHeight,
      '#d4c39d', bodyX, -1.5, 3, '#817765');
    const seam = createNode('LidInsetSeam', inner, innerWidth * 0.90, innerHeight * 0.79,
      0, -innerHeight * 0.005).addComponent(Graphics);
    seam.lineWidth = 2;
    seam.strokeColor = color('#8e846e', 165);
    seam.rect(-innerWidth * 0.45, -innerHeight * 0.395, innerWidth * 0.90, innerHeight * 0.79);
    seam.stroke();
    createRect('LidInnerBottomEdge', inner, innerWidth * 0.92, 7,
      '#817765', 0, -innerHeight / 2 + 5, 4);

    const mouthHeight = boxHeight * 0.08;
    const mouth = new CanvasTexture('PackMouth', packRoot, Math.round(bodyWidth), Math.round(mouthHeight));
    mouth.node.setPosition(bodyX, yFromTop(0.278) - mouthHeight / 2);
    this.mouthOpacity = mouth.node.addComponent(UIOpacity);
    mouth.redraw((ctx) => {
      const gradient = ctx.createLinearGradient(0, mouthHeight / 2, 0, -mouthHeight / 2);
      gradient.addColorStop(0, '#aaa69d');
      gradient.addColorStop(0.12, '#aaa69d');
      gradient.addColorStop(0.14, '#32312e');
      gradient.addColorStop(0.46, '#121313');
      gradient.addColorStop(1, '#080909');
      ctx.fillStyle = gradient;
      ctx.fillRect(-bodyWidth / 2, -mouthHeight / 2, bodyWidth, mouthHeight);
    });
    this.filterTextures.push(mouth);

    // Old pack-box percentages: deck top 9%, height 52%; rear/front slot tops 2%/18% of deck.
    const deckWidth = boxWidth * 0.65;
    const deckHeight = HomeController.PACK_FILTER_HEIGHT;
    const deck = createNode('CigaretteDeck', packRoot, deckWidth, deckHeight,
      boxWidth * (0.22 + 0.65 / 2 - 0.5), yFromTop(0.09) - deckHeight / 2);
    this.deckOpacity = deck.addComponent(UIOpacity);
    for (let index = 0; index < 10; index += 1) {
      const rear = index < 5;
      const column = index % 5;
      const columnWidth = deckWidth / 5;
      const x = -deckWidth / 2 + (column + 0.5) * columnWidth
        + (rear ? -0.125 : 0.125) * columnWidth;
      const y = -deckHeight * (rear ? 0.02 : 0.18);
      const stick = createNode(`Slot${index}`, deck, 45, deckHeight, x, y);
      stick.addComponent(UIOpacity);
      const material = new CanvasTexture(`FilterMaterial${index}`, stick, 45, deckHeight);
      material.redraw((ctx) => HomeController.paintWangXiFilter(ctx, rear, deckHeight));
      this.filterTextures.push(material);
      this.slots[index] = stick;
      if (!rear) this.frontSlots.push(stick);
      stick.on(Node.EventType.TOUCH_END, () => {
        if (this.entryMode || this.lidAnimating || !this.pack?.lidOpen
          || this.pack.slots[index] !== 'available') return;
        this.selectedSlot = index;
        this.onStart?.(index);
      });
    }

    const sideWidth = boxWidth * 0.08;
    const side = createRect('PackSide', packRoot, sideWidth, bodyHeight,
      '#111a1a', -boxWidth * 0.41, bodyY, 0, '#4a4a42');
    // Legacy side is not a flat swatch: it crops the same skin at 560% width,
    // aligns it to the lower-right, then darkens/desaturates it.
    this.addPackSkin(side, sideWidth - 4, bodyHeight - 4,
      5.6, 1.36364, 'SideSkin', 'bottom', 'right');
    const sideShade = new CanvasTexture('SideShade', side,
      Math.round(sideWidth - 4), Math.round(bodyHeight - 4));
    this.filterTextures.push(sideShade);
    sideShade.redraw((ctx) => {
      const width = sideWidth - 4;
      const height = bodyHeight - 4;
      const shade = ctx.createLinearGradient(-width / 2, 0, width / 2, 0);
      shade.addColorStop(0, 'rgba(3,8,8,0.58)');
      shade.addColorStop(1, 'rgba(3,8,8,0.24)');
      ctx.fillStyle = shade;
      ctx.fillRect(-width / 2, -height / 2, width, height);
    });
    // Keep the green front face as the bottom material layer beneath the clipped skin.
    const front = createRect('PackFront', packRoot, bodyWidth, bodyHeight,
      Palette.green, bodyX, bodyY, 0, '#70664f');
    this.addPackSkin(front, bodyWidth - 4, bodyHeight - 4, 1.22, 1.36364, 'BodySkin', 'bottom');

    // Legacy pack-body-copy is independent from skin.jpg and remains visible in both lid states.
    const packName = createLabel('PackName', front, '王溪', 46, Palette.green,
      bodyWidth * 0.76, 62, -bodyWidth * 0.055, bodyHeight * 0.285);
    this.applyPackCopyShadow(packName);
    const packCode = createLabel('PackCode', front, 'WANG·XI', 17, Palette.green,
      bodyWidth * 0.76, 30, -bodyWidth * 0.055, bodyHeight * 0.205);
    this.applyPackCopyShadow(packCode);
    const footerCode = createLabel('PackFooterCode', front, 'WANG·XI', 15, Palette.green,
      bodyWidth * 0.55, 28, -bodyWidth * 0.18, -bodyHeight * 0.405);
    this.applyPackCopyShadow(footerCode);
    createRect('PackSignal', front, 8, 8, Palette.orange,
      bodyWidth * 0.37, -bodyHeight * 0.405, 4);

    const collarGroup = createNode('InnerCollar', packRoot, bodyWidth, boxHeight * 0.08,
      bodyX, yFromTop(0.22) - boxHeight * 0.04);
    this.collarOpacity = collarGroup.addComponent(UIOpacity);
    const collarTop = boxHeight * 0.04;
    const collarHeight = boxHeight * 0.08;
    const railHeight = collarHeight * 0.375;
    this.collar = createRect('CollarRail', collarGroup, bodyWidth, railHeight, '#e7dfd2',
      0, collarTop - collarHeight + railHeight / 2, 2);
    const wingWidth = bodyWidth * 0.08;
    const wingHeight = collarHeight * 0.625;
    createRect('CollarWingLeft', collarGroup, wingWidth, wingHeight, '#f4efe6',
      -(bodyWidth - wingWidth) / 2, collarTop - wingHeight / 2, 2);
    createRect('CollarWingRight', collarGroup, wingWidth, wingHeight, '#f4efe6',
      (bodyWidth - wingWidth) / 2, collarTop - wingHeight / 2, 2);
    this.renderLid();
  }

  private addPackSkin(parent: Node, viewportWidth: number, viewportHeight: number,
    widthScale: number, heightScale: number, name: string, align: 'top' | 'bottom',
    horizontalAlign: 'left' | 'right' = 'left'): void {
    const viewport = createNode(`${name}Viewport`, parent, viewportWidth, viewportHeight);
    const skinMask = viewport.addComponent(Mask);
    skinMask.type = Mask.Type.GRAPHICS_STENCIL;
    const stencil = skinMask.subComp as Graphics;
    stencil.rect(-viewportWidth / 2, -viewportHeight / 2, viewportWidth, viewportHeight);
    stencil.fill();
    const skinWidth = viewportWidth * widthScale;
    const skinHeight = viewportHeight * heightScale;
    const skinY = align === 'bottom'
      ? (skinHeight - viewportHeight) / 2
      : (viewportHeight - skinHeight) / 2;
    const skinX = horizontalAlign === 'left'
      ? (skinWidth - viewportWidth) / 2
      : (viewportWidth - skinWidth) / 2;
    const spriteNode = createNode(name, viewport, skinWidth, skinHeight, skinX, skinY);
    const sprite = spriteNode.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    resources.load(AssetCatalog.wangXiSkin, SpriteFrame, (error, frame) => {
      if (!error && frame && sprite.isValid) sprite.spriteFrame = frame;
    });
  }

  private applyPackCopyShadow(label: Label): void {
    label.enableShadow = true;
    label.shadowColor = color('#f0dfb5', 185);
    label.shadowOffset.set(0, -2);
    label.shadowBlur = 5;
  }

  /** WangXi/life pack's visible filter, transcribed from pack-box.wxss materials. */
  public static paintWangXiFilter(ctx: CanvasRenderingContext2D, rear: boolean,
    height = HomeController.PACK_FILTER_HEIGHT): void {
    const left = -22.5;
    const right = 22.5;
    const width = right - left;
    const bottom = -height / 2;
    const top = height / 2;
    const traceBody = (): void => {
      ctx.beginPath();
      ctx.moveTo(left, bottom + 8);
      ctx.lineTo(left, top - 7);
      ctx.quadraticCurveTo(left, top, 0, top);
      ctx.quadraticCurveTo(right, top, right, top - 7);
      ctx.lineTo(right, bottom + 8);
      ctx.quadraticCurveTo(right, bottom, right - 8, bottom);
      ctx.lineTo(left + 8, bottom);
      ctx.quadraticCurveTo(left, bottom, left, bottom + 8);
      ctx.closePath();
    };

    ctx.save();
    // pack-slot-rear filters the complete static stick, including cap and motif.
    if (rear) ctx.filter = 'brightness(0.93) saturate(0.96)';
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = -4;
    traceBody();
    ctx.fillStyle = '#b47f3f';
    ctx.fill();
    ctx.restore();

    ctx.save();
    traceBody();
    ctx.clip();
    const cylinder = ctx.createLinearGradient(left, 0, right, 0);
    cylinder.addColorStop(0, 'rgba(8,10,11,0.30)');
    cylinder.addColorStop(0.52, 'rgba(255,255,255,0.08)');
    cylinder.addColorStop(1, 'rgba(8,10,11,0.28)');
    ctx.fillStyle = cylinder;
    ctx.fillRect(left, bottom, width, height);

    // Preserve the legacy photographed impression: the lower filter is only
    // slightly deeper than the upper half, without turning it into two bands.
    const verticalShade = ctx.createLinearGradient(0, top, 0, bottom);
    verticalShade.addColorStop(0, 'rgba(255,255,255,0.045)');
    verticalShade.addColorStop(0.48, 'rgba(255,255,255,0)');
    verticalShade.addColorStop(1, 'rgba(8,10,11,0.13)');
    ctx.fillStyle = verticalShade;
    ctx.fillRect(left, bottom, width, height);

    // CSS repeats two small radial-gradient flecks at 43%×13% and 37%×17% tile sizes.
    const fleckLayer = (tileWidth: number, tileHeight: number, u: number, v: number, alpha: number): void => {
      for (let tileLeft = left; tileLeft < right; tileLeft += tileWidth) {
        for (let tileTop = top; tileTop > bottom; tileTop -= tileHeight) {
          const x = tileLeft + tileWidth * u;
          const y = tileTop - tileHeight * v;
          const radius = Math.max(0.55, Math.min(tileWidth, tileHeight) * 0.045);
          const spot = ctx.createRadialGradient(x, y, 0, x, y, radius);
          spot.addColorStop(0, `rgba(255,255,255,${alpha})`);
          spot.addColorStop(0.6, `rgba(255,255,255,${alpha * 0.4})`);
          spot.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = spot;
          ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
        }
      }
    };
    fleckLayer(width * 0.37, height * 0.17, 0.68, 0.62, 0.10);
    fleckLayer(width * 0.43, height * 0.13, 0.22, 0.28, 0.14);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(left + 1, bottom + 8, 1, height - 17);
    ctx.fillStyle = 'rgba(8,10,11,0.30)';
    ctx.fillRect(right - 2, bottom + 8, 1, height - 17);

    const bandTop = top - height * 0.264;
    const bandHeight = Math.max(2, height * 0.015);
    ctx.fillStyle = 'rgba(23,63,55,0.9)';
    ctx.fillRect(left, bandTop - bandHeight, right - left, bandHeight);

    // CSS ::after: left 36%, width 28%, top 12%, height 7%, rotated 18deg.
    ctx.save();
    const leafWidth = width * 0.28;
    const leafHeight = height * 0.07;
    ctx.translate(0, top - height * (0.12 + 0.035));
    ctx.rotate(-Math.PI / 10);
    ctx.beginPath();
    ctx.moveTo(-leafWidth / 2, -leafHeight / 2);
    ctx.bezierCurveTo(-leafWidth / 2, leafHeight * 0.38,
      leafWidth * 0.30, leafHeight * 0.52, leafWidth / 2, leafHeight / 2);
    ctx.bezierCurveTo(leafWidth / 2, -leafHeight * 0.38,
      -leafWidth * 0.30, -leafHeight * 0.52, -leafWidth / 2, -leafHeight / 2);
    ctx.closePath();
    ctx.strokeStyle = 'rgba(224,192,151,0.68)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    ctx.restore();

    // Legacy cap is a subtle 8 rpx ellipse. Its middle stop is transparent over the
    // filter base; replacing it with an opaque base creates the incorrect dark ring.
    ctx.save();
    ctx.translate(0, top - 4);
    ctx.scale(1, 4 / 21);
    ctx.beginPath();
    ctx.arc(0, 0, 21, 0, Math.PI * 2);
    ctx.fillStyle = '#b47f3f';
    ctx.fill();
    const cap = ctx.createRadialGradient(0, 0.8, 0, 0, 0.8, 21);
    cap.addColorStop(0, 'rgba(255,255,255,0.12)');
    cap.addColorStop(0.56, 'rgba(255,255,255,0)');
    cap.addColorStop(1, 'rgba(8,10,11,0.52)');
    ctx.fillStyle = cap;
    ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  private refreshBackground(visibleHeight: number): void {
    if (!this.backgroundTexture) return;
    const height = Math.max(DESIGN_HEIGHT, Math.ceil(visibleHeight));
    if (this.backgroundHeight === height) return;
    this.backgroundHeight = height;
    this.backgroundTexture.resize(DESIGN_WIDTH, height);
    this.backgroundTexture.redraw((ctx) => {
      const top = height / 2;
      const vertical = ctx.createLinearGradient(0, top, 0, -top);
      vertical.addColorStop(0, '#060809');
      vertical.addColorStop(0.52, '#090c0d');
      vertical.addColorStop(1, '#050708');
      ctx.fillStyle = vertical;
      ctx.fillRect(-DESIGN_WIDTH / 2, -top, DESIGN_WIDTH, height);
      const warmUpper = ctx.createRadialGradient(-30, top - height * 0.22, 0,
        -30, top - height * 0.22, DESIGN_WIDTH * 0.24);
      warmUpper.addColorStop(0, 'rgba(98,56,24,0.12)');
      warmUpper.addColorStop(1, 'rgba(98,56,24,0)');
      ctx.fillStyle = warmUpper;
      ctx.fillRect(-DESIGN_WIDTH / 2, -top, DESIGN_WIDTH, height);
      const warmRight = ctx.createRadialGradient(DESIGN_WIDTH * 0.26, top - height * 0.58, 0,
        DESIGN_WIDTH * 0.26, top - height * 0.58, DESIGN_WIDTH * 0.28);
      warmRight.addColorStop(0, 'rgba(113,64,25,0.06)');
      warmRight.addColorStop(1, 'rgba(113,64,25,0)');
      ctx.fillStyle = warmRight;
      ctx.fillRect(-DESIGN_WIDTH / 2, -top, DESIGN_WIDTH, height);
      const vignette = ctx.createRadialGradient(0, 0, DESIGN_WIDTH * 0.36,
        0, 0, Math.max(DESIGN_WIDTH, height) * 0.75);
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,0,0.42)');
      ctx.fillStyle = vignette;
      ctx.fillRect(-DESIGN_WIDTH / 2, -top, DESIGN_WIDTH, height);
    });
  }

  private createChamferedPanel(name: string, parent: Node, width: number, height: number,
    cut: number, fillHex: string, strokeHex: string): Node {
    const node = createNode(name, parent, width, height);
    const graphic = node.addComponent(Graphics);
    graphic.moveTo(-width / 2 + cut, height / 2);
    graphic.lineTo(width / 2 - cut, height / 2);
    graphic.lineTo(width / 2, height / 2 - cut);
    graphic.lineTo(width / 2, -height / 2 + cut);
    graphic.lineTo(width / 2 - cut, -height / 2);
    graphic.lineTo(-width / 2 + cut, -height / 2);
    graphic.lineTo(-width / 2, -height / 2 + cut);
    graphic.lineTo(-width / 2, height / 2 - cut);
    graphic.close();
    graphic.fillColor = color(fillHex);
    graphic.fill();
    graphic.strokeColor = color(strokeHex);
    graphic.lineWidth = 2;
    graphic.stroke();
    return node;
  }

  private buildSettingsButton(parent: Node): void {
    // Right edge follows the quick bar/side-rail edge at x=345.
    const node = createNode('Settings', parent, 88, 88, 301, 0);
    this.settingsRoot = node;
    node.addComponent(Button).transition = Button.Transition.NONE;
    const graphic = node.addComponent(Graphics);
    graphic.strokeColor = color('#c6b69f');
    graphic.fillColor = color('#c6b69f');
    graphic.lineWidth = 4;
    for (let index = 0; index < 8; index += 1) {
      const angle = index * Math.PI / 4;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      const tx = -dy * 3.5;
      const ty = dx * 3.5;
      graphic.moveTo(dx * 25 + tx, dy * 25 + ty);
      graphic.lineTo(dx * 34 + tx, dy * 34 + ty);
      graphic.lineTo(dx * 34 - tx, dy * 34 - ty);
      graphic.lineTo(dx * 25 - tx, dy * 25 - ty);
      graphic.close();
      graphic.fill();
    }
    graphic.circle(0, 0, 22);
    graphic.circle(0, 0, 8);
    graphic.stroke();
  }

  private buildQuickAction(title: string, index: number): void {
    const width = 690 / 4;
    const x = -690 / 2 + width * (index + 0.5);
    const action = createNode(`Quick${title}`, this.quickRoot, width, 112, x, 0);
    action.addComponent(Button).transition = Button.Transition.NONE;
    if (index > 0) createRect('Divider', action, 1, 80, '#514839', -width / 2, 0);
    const iconNode = createNode('Icon', action, 50, 50, 0, 18);
    this.quickIcons.push(iconNode);
    const icon = iconNode.addComponent(Graphics);
    icon.strokeColor = color('#c9aa7e');
    icon.fillColor = color('#c9aa7e');
    icon.lineWidth = 3;
    if (index === 0) {
      // Legacy quick-icon-checkin: bound calendar with two top tabs.
      icon.roundRect(-16, -15, 32, 30, 6);
      icon.stroke();
      icon.roundRect(-11, 14, 4, 12, 2);
      icon.roundRect(5, 14, 4, 12, 2);
      icon.fill();
      icon.lineWidth = 4;
      icon.moveTo(-8, -1); icon.lineTo(-2, -7); icon.lineTo(10, 6); icon.stroke();
    } else if (index === 1) {
      // Legacy quick-icon-quit: prohibition ring, cigarette and slash.
      icon.circle(0, 0, 16); icon.stroke();
      icon.lineWidth = 2;
      icon.rect(-12, -4, 18, 7); icon.stroke();
      icon.rect(-12, -4, 5, 7); icon.fill();
      icon.lineWidth = 3;
      icon.moveTo(-12, -13); icon.lineTo(12, 13); icon.stroke();
    } else if (index === 2) {
      // Legacy quick-icon-ranking: three ascending bars over one baseline.
      icon.rect(-13, -14, 6, 11);
      icon.rect(-3, -14, 6, 17);
      icon.rect(7, -14, 6, 24);
      icon.fill();
      icon.moveTo(-16, -15); icon.lineTo(16, -15); icon.stroke();
    } else {
      // Legacy quick-icon-achievement: round medal, star and twin ribbons.
      icon.circle(0, 4, 16); icon.stroke();
      const points: Array<[number, number]> = [];
      for (let point = 0; point < 10; point += 1) {
        const angle = Math.PI / 2 + point * Math.PI / 5;
        const radius = point % 2 === 0 ? 7 : 3;
        points.push([Math.cos(angle) * radius, 4 + Math.sin(angle) * radius]);
      }
      icon.moveTo(points[0][0], points[0][1]);
      for (const [px, py] of points.slice(1)) icon.lineTo(px, py);
      icon.close(); icon.fill();
      icon.moveTo(-12, -8); icon.lineTo(-12, -24); icon.lineTo(-5, -20);
      icon.lineTo(0, -25); icon.lineTo(0, -13);
      icon.moveTo(12, -8); icon.lineTo(12, -24); icon.lineTo(5, -20);
      icon.lineTo(0, -25); icon.stroke();
    }
    const label = createLabel('Title', action, title, 27, '#d3bea0', width - 12, 40, 0, -34);
    label.lineHeight = 27;
    label.isBold = true;
    this.quickLabels.push(label);
  }

  private buildPackNavigation(): void {
    const navigation = createNode('PackSwitchNavigation', this.contentRoot, 424, 88, -133, 0);
    this.packNavigation = navigation;
    const drawArrow = (name: string, x: number, previous: boolean): void => {
      const arrow = createNode(name, navigation, 88, 88, x);
      arrow.addComponent(Button).transition = Button.Transition.NONE;
      this.packSwitchArrows.push(arrow);
      const mark = arrow.addComponent(Graphics);
      mark.strokeColor = color('#c2b590');
      mark.lineWidth = 2;
      mark.moveTo(previous ? 5 : -5, 10);
      mark.lineTo(previous ? -5 : 5, 0);
      mark.lineTo(previous ? 5 : -5, -10);
      mark.stroke();
    };
    drawArrow('PreviousPack', -168, true);
    this.packSwitchCaption = createLabel('PackSwitchCaption', navigation,
      '左右滑动换一盒 · 1 / 1', 22, '#b0b6ab', 248, 44);
    // Keep the old single-line hint inside the flexible space between 44px arrows.
    this.packSwitchCaption.overflow = Label.Overflow.SHRINK;
    this.packSwitchCaption.enableWrapText = false;
    drawArrow('NextPack', 168, false);
  }

  private buildInfoCard(title: string, value: string, x: number, y: number,
    iconKind: SideCardKind, height = 84): Label {
    const cardWidth = 248;
    const card = createNode(title, this.workspaceRoot, cardWidth, height, x, y);
    if (iconKind !== 'today') card.addComponent(Button).transition = Button.Transition.NONE;
    const frame = card.addComponent(Graphics);
    this.paintInfoCardFrame(frame, height, iconKind === 'gift');
    const todayHeaderY = height / 2 - 46;
    const mark = createNode('Mark', card, 49, 55, iconKind === 'gift' ? -34 : -82,
      iconKind === 'today' ? todayHeaderY : 0).addComponent(Graphics);
    mark.strokeColor = color('#d8a85f');
    mark.fillColor = color('#d8a85f');
    mark.lineWidth = 3;
    if (iconKind === 'records') {
      mark.lineWidth = 4;
      mark.roundRect(-19, -24, 38, 48, 7); mark.stroke();
      mark.lineWidth = 3;
      mark.moveTo(-12, -16); mark.lineTo(-12, 16);
      for (const yy of [-8, 0, 8]) { mark.moveTo(-5, yy); mark.lineTo(12, yy); }
      mark.stroke();
    } else if (iconKind === 'lab') {
      this.paintSmokeLabIcon(mark.node);
    } else if (iconKind === 'switch') {
      this.paintSwitchArrows(mark);
    } else if (iconKind === 'today') {
      this.paintStatusPulse(mark);
    } else {
      this.paintGiftIcon(mark.node);
    }
    if (iconKind === 'gift') {
      const giftTitle = createLabel('Title', card, title, 28, Palette.gold,
        64, 38, 26, 0, HorizontalTextAlignment.LEFT);
      giftTitle.isBold = true;
      this.actionTitles.push({ label: giftTitle, rpx: 28, minimumPx: 14, copyOffsetY: 0 });
      this.sideCards.push({ node: card, frame, mark: mark.node, kind: iconKind,
        title: giftTitle, subtitle: null, rows: [] });
      return giftTitle;
    }
    const titleSize = iconKind === 'lab' ? 26 : 30;
    const titleLabel = createLabel('Title', card, title, titleSize, '#e6d6c0',
      146, 38, 33, iconKind === 'today' ? todayHeaderY : 20,
      HorizontalTextAlignment.LEFT);
    titleLabel.isBold = true;
    this.actionTitles.push({ label: titleLabel, rpx: titleSize,
      minimumPx: iconKind === 'lab' ? 13 : 0, copyOffsetY: iconKind === 'today' ? null : 20 });
    if (iconKind === 'today') {
      const rows = [
        this.buildTodayStatusRow(card, 'LastSmoke', '上次抽烟', 76),
        this.buildTodayStatusRow(card, 'TodaySmoked', '今日已抽', -30),
        this.buildTodayStatusRow(card, 'CheckinStreak', '连续打卡', -136),
      ];
      this.sideCards.push({ node: card, frame, mark: mark.node, kind: iconKind,
        title: titleLabel, subtitle: null, rows });
      return titleLabel;
    }
    const subtitle = createLabel('Value', card, value, 24, '#a58f74',
      146, 34, 33, -20, HorizontalTextAlignment.LEFT);
    this.actionSubtitles.push(subtitle);
    this.sideCards.push({ node: card, frame, mark: mark.node, kind: iconKind,
      title: titleLabel, subtitle, rows: [] });
    return subtitle;
  }

  private paintSwitchArrows(mark: Graphics): void {
    // V1.0.8 switch-pack-mark uses two filled 43 × 16 rpx arrows.
    const arrow = (cy: number, right: boolean): void => {
      const points: Array<[number, number]> = [
        [-21.5, -2], [8.5, -2], [8.5, -8], [21.5, 0],
        [8.5, 8], [8.5, 2], [-21.5, 2],
      ];
      const mapped = points.map(([px, py]): [number, number] =>
        [right ? px : -px, py + cy]);
      mark.moveTo(mapped[0][0], mapped[0][1]);
      for (const [px, py] of mapped.slice(1)) mark.lineTo(px, py);
      mark.close();
      mark.fill();
    };
    arrow(10, true);
    arrow(-10, false);
  }

  private paintStatusPulse(mark: Graphics): void {
    // Filled CSS pulse polygon, reduced to its centerline at 49 × 36 rpx.
    const points: Array<[number, number]> = [
      [-24, 0], [-16, 0], [-12, 11], [-7, -6], [-3, 17],
      [3, 2], [6, 9], [12, -3], [16, 0], [24, 0],
    ];
    mark.lineWidth = 4;
    mark.lineJoin = Graphics.LineJoin.ROUND;
    mark.moveTo(points[0][0], points[0][1]);
    for (const [px, py] of points.slice(1)) mark.lineTo(px, py);
    mark.stroke();
    mark.moveTo(-24, -2);
    for (const [px, py] of points.slice(1)) mark.lineTo(px, py - 2);
    mark.stroke();
  }

  private paintSmokeLabIcon(parent: Node): void {
    // The original /assets/icons/smoke-lab.svg has three translucent plumes,
    // not the flask used by the first Cocos approximation.
    const texture = new CanvasTexture('SmokeLabSvg', parent, 49, 55);
    this.filterTextures.push(texture);
    texture.redraw((ctx) => {
      const scale = Math.min(49 / 36, 55 / 40);
      ctx.save();
      ctx.translate(-18 * scale, 20 * scale);
      ctx.scale(scale, -scale);
      const center = ctx.createLinearGradient(18, 3, 18, 35);
      center.addColorStop(0, 'rgba(173,150,204,.95)');
      center.addColorStop(.55, 'rgba(173,150,204,.8)');
      center.addColorStop(1, 'rgba(173,150,204,0)');
      ctx.fillStyle = center;
      ctx.fill(new Path2D('M16.7 35c-3.3-4-4.3-9-3-13.7-3.5-.9-5-4-2.7-7.3-3.2-2.8-1.2-7.5 2.5-7.8.5-3.6 4.7-4.8 7.1-1.9 4-1.3 7.4 2.8 5.1 6.3 3.3 3.3 1.1 7.6-2.3 8.3C25 23.2 23 29.2 19.2 35Z'));
      const left = ctx.createLinearGradient(8, 10, 16, 36);
      left.addColorStop(0, 'rgba(140,184,208,.95)');
      left.addColorStop(.5, 'rgba(140,184,208,.8)');
      left.addColorStop(1, 'rgba(140,184,208,0)');
      ctx.fillStyle = left;
      ctx.fill(new Path2D('M15.5 36c-3.3-3-6-6.5-6.3-10.8-3.8 1-7.4-1.4-7-5.1-2.1-2.8-.1-6.5 3.2-6.8-.1-3.5 4-5.3 6.6-3 4-1.1 6.4 2.9 4.3 6.2 3.2 2.1 2.7 6.3-.2 8.1-1.7 3.7 2.1 7.2 2.6 11.4Z'));
      const right = ctx.createLinearGradient(28, 12, 21, 36);
      right.addColorStop(0, 'rgba(211,155,171,.95)');
      right.addColorStop(.5, 'rgba(211,155,171,.8)');
      right.addColorStop(1, 'rgba(211,155,171,0)');
      ctx.fillStyle = right;
      ctx.fill(new Path2D('M18.5 36c.7-4.2 3.9-6.7 3.2-10.7-3.4-1.7-3.9-5.5-1.2-7.8-.6-3.3 2.7-6.1 5.8-4.6 3-2 7.3.3 6.7 3.9 3.5 2.2 2.1 7-1.3 7.5.3 3.5-3 5.6-5.8 4.7-.9 2.7-2.7 5.2-4.4 7Z'));
      ctx.restore();
    });
  }

  private paintGiftIcon(parent: Node): void {
    // Original /assets/icons/session-share.svg path in its 24 × 24 viewBox.
    const texture = new CanvasTexture('GiftSvg', parent, 44, 44);
    this.filterTextures.push(texture);
    texture.redraw((ctx) => {
      const scale = 44 / 24;
      ctx.save();
      ctx.translate(-12 * scale, 12 * scale);
      ctx.scale(scale, -scale);
      ctx.strokeStyle = '#d9bc8d';
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke(new Path2D('M3 5h17v3H3zM16 5v3M3 18l4-5h5c2 0 2 3 0 3h-2m-3-3 4-3h7c2 0 3 2 1 4l-5 5H8l-2 2M1 16l5 5'));
      ctx.restore();
    });
  }

  private paintInfoCardFrame(frame: Graphics, height: number, gift: boolean): void {
    const halfWidth = 124;
    const cut = 12;
    frame.clear();
    frame.moveTo(-halfWidth + cut, height / 2);
    frame.lineTo(halfWidth - cut, height / 2);
    frame.lineTo(halfWidth, height / 2 - cut);
    frame.lineTo(halfWidth, -height / 2 + cut);
    frame.lineTo(halfWidth - cut, -height / 2);
    frame.lineTo(-halfWidth + cut, -height / 2);
    frame.lineTo(-halfWidth, -height / 2 + cut);
    frame.lineTo(-halfWidth, height / 2 - cut);
    frame.close();
    frame.fillColor = color(gift ? '#171713' : '#111310');
    frame.fill();
    frame.strokeColor = color(gift ? '#6b573c' : '#554831');
    frame.lineWidth = 2;
    frame.stroke();
  }

  private buildTodayStatusRow(parent: Node, name: string, caption: string, y: number): Node {
    const row = createNode(name, parent, 220, 72, 0, y);
    const mark = createNode('StatusIcon', row, 31, 31, -90, 0).addComponent(Graphics);
    mark.strokeColor = color('#d8a85f');
    mark.lineWidth = 2;
    if (name === 'LastSmoke') {
      mark.circle(0, 0, 13);
      mark.moveTo(0, 8); mark.lineTo(0, 0); mark.lineTo(6, -4);
    } else if (name === 'TodaySmoked') {
      mark.circle(0, 0, 13); mark.circle(0, 0, 6); mark.circle(0, 0, 2);
    } else {
      mark.roundRect(-11, -10, 22, 21, 2);
      mark.moveTo(-7, 1); mark.lineTo(-1, -5); mark.lineTo(8, 6);
    }
    mark.stroke();
    const label = createLabel('StatusLabel', row, caption, 24, '#c6af90',
      164, 30, 18, 13, HorizontalTextAlignment.LEFT);
    const value = createLabel('StatusValue', row, '—', 24, '#c9b89f',
      164, 30, 18, -14, HorizontalTextAlignment.LEFT);
    this.statusLabels.push(label);
    this.statusValues.push(value);
    return row;
  }
}
