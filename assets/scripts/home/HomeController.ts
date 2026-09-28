import { _decorator, Button, Component, Graphics, Label, Mask, Node, resources, Sprite, SpriteFrame, UITransform, UIOpacity, Vec3, view } from 'cc';
import { AssetCatalog } from '../assets/AssetCatalog';
import { color, createButton, createLabel, createNode, createRect, DESIGN_HEIGHT, DESIGN_WIDTH, Palette } from '../common/UiFactory';
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

@ccclass('HomeController')
export class HomeController extends Component {
  public static readonly PACK_FILTER_HEIGHT = 600 * 0.52;
  private onStart: ((slotIndex: number) => void) | null = null;
  private onSupply: (() => void) | null = null;
  private contentRoot!: Node;
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
  private inventorySegments: Graphics[] = [];
  private startButton!: Button;
  private startButtonLabel!: Label;
  private startSweep!: CanvasTexture;
  private sweepElapsed = 0;
  private sweepDrawElapsed = 0;
  private pack: PackSnapshot | null = null;
  private extractingSlot: number | null = null;

  public initialize(onStart: (slotIndex: number) => void, onSupply: () => void): void {
    this.onStart = onStart;
    this.onSupply = onSupply;
    this.build();
  }

  protected update(deltaTime: number): void {
    this.refreshLayout();
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
    this.backgroundTexture?.dispose();
    this.startSweep?.dispose();
  }

  public refreshLayout(): void {
    if (!this.contentRoot) return;
    const visibleHeight = view.getVisibleSize().height;
    this.refreshBackground(visibleHeight);
    const scale = Math.min(1, visibleHeight / DESIGN_HEIGHT);
    this.contentRoot.setScale(scale, scale, 1);
  }

  public defaultSlot(): number {
    if (!this.pack) return -1;
    if (this.pack.slots[this.selectedSlot] === 'available') return this.selectedSlot;
    return this.pack.slots.findIndex((slot) => slot === 'available');
  }

  public setPack(pack: PackSnapshot | null): void {
    this.pack = pack;
    const remaining = pack ? countAvailableSlots(pack) : 0;
    this.packStatusLabel.string = pack ? `本盒剩余 ${remaining}/10 支` : '烟盒存档不可用';
    for (let index = 0; index < this.inventorySegments.length; index += 1) {
      const segment = this.inventorySegments[index];
      segment.clear();
      segment.fillColor = color(index < remaining ? Palette.goldMuted : '#38372f');
      segment.roundRect(-16, -3, 32, 6, 3);
      segment.fill();
    }
    this.startButton.interactable = !!pack;
    this.startButtonLabel.string = pack === null ? '烟盒不可用' : remaining > 0 ? '来一根' : '补一盒';
    this.paintStartSweep();
    this.refreshSlotVisibility();
  }

  public setSmokedCount(count: number | null): void {
    this.smokedCountLabel.string = count === null ? '本机存档不可用' : `累计已抽 ${count} 根`;
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
      if (opacity) opacity.opacity = this.pack?.slots[slotIndex] === 'available'
        && slotIndex !== this.extractingSlot ? 255 : 0;
    }
  }

  public getExtractionSource(slotIndex: number, target: Node): ExtractionSource | null {
    if (this.pack?.slots[slotIndex] !== 'available') return null;
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
    createLabel('Brand', this.contentRoot, '来 一 根 再 说', 24, Palette.gold, 500, 50, 0, 700);
    createLabel('RewardHint', this.contentRoot, '今日也要照顾好自己', 20, Palette.goldMuted, 420, 40, -110, 655);
    createLabel('Menu', this.contentRoot, '打卡    戒烟    收烟榜    成就', 22, Palette.goldMuted, 610, 48, 0, 605);
    createRect('Divider', this.contentRoot, 650, 2, Palette.goldMuted, 0, 568);
    createLabel('Announcement', this.contentRoot, '限定首发 · 王溪 WANG·XI', 20, Palette.gold, 600, 40, 0, 530);
    this.packStatusLabel = createLabel('PackStatus', this.contentRoot, '本盒剩余 10/10 支', 21, Palette.gold, 600, 38, 0, 482);
    for (let index = 0; index < 10; index += 1) {
      const segment = createNode(`InventorySegment${index}`, this.contentRoot, 32, 6,
        -180 + index * 40, 450).addComponent(Graphics);
      this.inventorySegments.push(segment);
    }

    this.buildPack();

    createLabel('PackName', this.contentRoot, '王 溪', 42, Palette.gold, 235, 60, 225, 390);
    createLabel('PackCode', this.contentRoot, 'WANG · XI', 20, Palette.goldMuted, 235, 35, 225, 345);
    createLabel('Flavor', this.contentRoot, '清甜回甘 · 雪松香', 17, Palette.muted, 250, 35, 225, 303);

    this.smokedCountLabel = this.buildInfoCard('抽烟记录', '累计已抽 0 根', 225, 218, true);
    this.buildInfoCard('烟雾实验室', '暂未开放', 225, 118, true);
    this.buildInfoCard('换一盒', '暂未开放', 225, 18, true);
    this.buildInfoCard('今日状态', '演示中', 225, -82, false);
    this.buildInfoCard('派烟', '暂未开放', 225, -182, true);
    createLabel('PackSwitchHint', this.contentRoot, '‹    王溪烟盒 · 演示    ›', 19, Palette.goldMuted, 440, 40, -145, -395);
    createLabel('Slogan', this.contentRoot, '每一次线下克制，都是在靠近更好的自己', 21, Palette.goldMuted, 620, 45, 0, -475);

    const startRoot = createRect('StartButton', this.contentRoot, 470, 106,
      '#111214', 0, -560, 0, '#4b4945');
    this.startButton = startRoot.addComponent(Button);
    this.startButton.transition = Button.Transition.SCALE;
    this.startButton.zoomScale = 0.96;
    this.startButtonLabel = createLabel('Label', startRoot, '来一根', 48,
      '#ffe0a2', 420, 90);
    this.startButtonLabel.enableShadow = true;
    this.startButtonLabel.shadowColor = color('#ffac34', 85);
    this.startButtonLabel.shadowBlur = 12;
    this.startSweep = new CanvasTexture('StartLabelSweep', startRoot, 420, 90);
    for (const [name, x, y] of [
      ['TopLeft', -219, 43], ['TopRight', 219, 43],
      ['BottomLeft', -219, -43], ['BottomRight', 219, -43],
    ] as const) createRect(`Bolt${name}`, startRoot, 5, 5, '#8e7d59', x, y);
    startRoot.on(Button.EventType.CLICK, () => {
      if (this.entryMode || !this.pack) return;
      const slot = this.defaultSlot();
      if (slot >= 0) this.onStart?.(slot);
      else this.onSupply?.();
    });
    createLabel('Footer', this.contentRoot, '鼠标长按画面进行点火与吸入', 17, Palette.muted, 560, 35, 0, -650);
    this.secondaryNodes = this.contentRoot.children.filter((child) => child.name !== 'PackRoot');
    for (const node of this.secondaryNodes) this.collectSecondaryOpacity(node);
  }

  /** CSS's second text layer, with the same 2.8 s right-to-left gold sweep. */
  private paintStartSweep(): void {
    if (!this.startSweep || !this.startButtonLabel) return;
    const label = this.startButtonLabel.string;
    const phase = this.sweepElapsed / 2.8;
    this.startSweep.redraw((ctx) => {
      if (!this.pack) return;
      ctx.save();
      ctx.scale(1, -1);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '780 48px "Microsoft YaHei UI", sans-serif';
      const center = 300 - 600 * phase;
      const gradient = ctx.createLinearGradient(center - 105, 0, center + 105, 0);
      gradient.addColorStop(0, 'rgba(255,251,228,0)');
      gradient.addColorStop(0.38, 'rgba(255,251,228,0)');
      gradient.addColorStop(0.46, '#fffbe4');
      gradient.addColorStop(0.51, '#fff2b2');
      gradient.addColorStop(0.55, '#ffd766');
      gradient.addColorStop(0.63, 'rgba(255,215,102,0)');
      gradient.addColorStop(1, 'rgba(255,215,102,0)');
      ctx.fillStyle = gradient;
      ctx.fillText(label, 0, 0);
      ctx.restore();
    });
  }

  private buildPack(): void {
    const boxWidth = 330;
    const boxHeight = 600;
    const packRoot = createNode('PackRoot', this.contentRoot, boxWidth, boxHeight, -160, -55);
    // The old pack is anchored in a 48vh workbench; grow downward while keeping its top near the header.
    packRoot.setScale(1.5, 1.42, 1);
    const yFromTop = (fraction: number): number => boxHeight * (0.5 - fraction);
    const bodyWidth = boxWidth * 0.84;
    const bodyX = boxWidth * (0.13 + 0.84 / 2 - 0.5);
    const bodyTop = yFromTop(0.30);
    const bodyBottom = yFromTop(0.96);
    const bodyHeight = bodyTop - bodyBottom;
    const bodyY = (bodyTop + bodyBottom) / 2;

    createRect('PackShadow', packRoot, boxWidth * 0.86, boxHeight * 0.09, '#030403', -5, yFromTop(0.96), 26);
    const lidTop = yFromTop(0.06);
    const lidBottom = yFromTop(0.30);
    const lidY = (lidTop + lidBottom) / 2;
    createRect('LidSide', packRoot, boxWidth * 0.08, lidTop - lidBottom, '#111a1a', -boxWidth * 0.41, lidY, 3);
    createRect('LidFrame', packRoot, bodyWidth, lidTop - lidBottom, Palette.green, bodyX, lidY, 5, Palette.goldMuted);
    createRect('LidInterior', packRoot, bodyWidth - 15, lidTop - lidBottom - 14, '#d4c39d', bodyX, lidY - 2, 3);

    const mouthHeight = boxHeight * 0.08;
    const mouth = new CanvasTexture('PackMouth', packRoot, Math.round(bodyWidth), Math.round(mouthHeight));
    mouth.node.setPosition(bodyX, yFromTop(0.278) - mouthHeight / 2);
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
        if (this.entryMode || this.pack?.slots[index] !== 'available') return;
        this.selectedSlot = index;
        this.onStart?.(index);
      });
    }

    createRect('PackSide', packRoot, boxWidth * 0.08, bodyHeight, '#111a1a', -boxWidth * 0.41, bodyY);
    const front = createRect('PackFront', packRoot, bodyWidth, bodyHeight, Palette.green, bodyX, bodyY, 0, Palette.goldMuted);
    const viewport = createNode('SkinViewport', front, bodyWidth - 4, bodyHeight - 4);
    const skinMask = viewport.addComponent(Mask);
    skinMask.type = Mask.Type.GRAPHICS_STENCIL;
    const stencil = skinMask.subComp as Graphics;
    stencil.rect(-(bodyWidth - 4) / 2, -(bodyHeight - 4) / 2, bodyWidth - 4, bodyHeight - 4);
    stencil.fill();
    // Legacy .pack-body-texture is oversized (122% x 136.364%) and clipped by the front face.
    const skinWidth = bodyWidth * 1.22;
    const skinHeight = bodyHeight * 1.36364;
    const spriteNode = createNode('Skin', viewport, skinWidth, skinHeight,
      (skinWidth - bodyWidth) / 2, (skinHeight - bodyHeight) / 2);
    const sprite = spriteNode.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    resources.load(AssetCatalog.wangXiSkin, SpriteFrame, (error, frame) => {
      if (!error && frame && sprite.isValid) sprite.spriteFrame = frame;
    });

    const collarTop = yFromTop(0.22);
    const collarHeight = boxHeight * 0.08;
    const railHeight = collarHeight * 0.375;
    this.collar = createRect('CollarRail', packRoot, bodyWidth, railHeight, '#e7dfd2',
      bodyX, collarTop - collarHeight + railHeight / 2, 2);
    const wingWidth = bodyWidth * 0.08;
    const wingHeight = collarHeight * 0.625;
    createRect('CollarWingLeft', packRoot, wingWidth, wingHeight, '#f4efe6',
      bodyX - (bodyWidth - wingWidth) / 2, collarTop - wingHeight / 2, 2);
    createRect('CollarWingRight', packRoot, wingWidth, wingHeight, '#f4efe6',
      bodyX + (bodyWidth - wingWidth) / 2, collarTop - wingHeight / 2, 2);
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

    // The cap's radial gradient is elliptical, not a circular glow cropped to an oval.
    ctx.save();
    ctx.translate(0, top - 4);
    ctx.scale(1, 4 / 21);
    const cap = ctx.createRadialGradient(0, 0.8, 0, 0, 0.8, 21);
    cap.addColorStop(0, 'rgba(255,255,255,0.12)');
    cap.addColorStop(0.56, '#b47f3f');
    cap.addColorStop(1, 'rgba(8,10,11,0.52)');
    ctx.beginPath();
    ctx.arc(0, 0, 21, 0, Math.PI * 2);
    ctx.fillStyle = cap;
    ctx.fill();
    ctx.strokeStyle = 'rgba(8,10,11,0.30)';
    ctx.lineWidth = 0.7;
    ctx.stroke();
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

  private buildInfoCard(title: string, value: string, x: number, y: number, disabled: boolean): Label {
    const card = createRect(title, this.contentRoot, 238, 82,
      disabled ? '#111310' : Palette.surface, x, y, 12, disabled ? '#34342b' : '#554831');
    createLabel('Title', card, title, 18, disabled ? Palette.goldMuted : Palette.gold, 210, 28, 0, 17);
    return createLabel('Value', card, value, 18, disabled ? Palette.muted : Palette.gold, 210, 30, 0, -16);
  }
}
