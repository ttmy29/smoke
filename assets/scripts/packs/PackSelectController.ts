import { _decorator, BlockInputEvents, Component, Graphics, HorizontalTextAlignment,
  isValid, Label, Mask, Node, resources, screen, ScrollView, SpriteFrame,
  UIOpacity, UITransform, view } from 'cc';
import { BundleLoader } from '../assets/BundleLoader';
import { AssetCatalog } from '../assets/AssetCatalog';
import { color, createLabel, createNode, createRect } from '../common/UiFactory';
import { UIButton } from '../common/UIButton';
import { countAvailableSlots, PackSnapshot } from '../persistence/PackStore';
import { CanvasTexture } from '../session/effects/CanvasTexture';
import { PACK_CATALOG, PackCatalogItem } from './PackCatalog';
import { PackBoxView } from './PackBoxView';

const { ccclass } = _decorator;
const BG = '#101214';

export interface CatalogPackState {
  unlocked: boolean;
  selected?: boolean;
  remaining?: number;
  sealState?: 'sealed' | 'opened';
  sequence?: number;
  progress?: number;
  target?: number;
}

export interface PackSelectActions {
  onBack(): void;
  readPack(): PackSnapshot | null;
  readTickets(): number | null;
  readLooseBox?: () => { available: number; capacity: number } | null;
  readPackState?: (id: string) => CatalogPackState | null;
  onEnterLooseBox?: () => void;
  onSelectPack?: (id: string) => void;
  onLockedPack?: (id: string) => void;
  onUnlockAd?: (id: string) => void;
  onGift?: (id: string) => void;
  onNationalDetail?: () => void;
}

/** Catalogue UI and read-only data. Unwired actions are intentionally silent hooks. */
@ccclass('PackSelectController')
export class PackSelectController extends Component {
  private actions!: PackSelectActions;
  private page!: Node;
  private background!: Node;
  private viewport!: Node;
  private content!: Node;
  private nav!: Node;
  private scroll!: ScrollView;
  private readonly frames = new Map<string, SpriteFrame>();
  private readonly views = new Map<string, PackBoxView>();
  private materials: CanvasTexture[] = [];
  private readonly pendingImages = new Set<string>();
  private disposed = false;
  private layoutKey = '';
  private unit = 1;
  private slide: 'in' | 'out' | null = null;
  private slideTime = 0;
  private covered = false;

  /** Replaces optional hooks without reconstructing the page or changing any save. */
  public setActions(actions: PackSelectActions): void { this.actions = { ...actions }; }

  public initialize(actions: PackSelectActions): void {
    this.setActions(actions);
    this.node.addComponent(BlockInputEvents);
    this.page = createNode('PackSelectPage', this.node, 941, 1672);
    this.background = createRect('Background', this.page, 941, 1672, BG);
    this.viewport = createNode('PackSelectViewport', this.page, 941, 1500);
    this.viewport.addComponent(Mask);
    this.scroll = this.viewport.addComponent(ScrollView);
    this.scroll.horizontal = false;
    this.scroll.vertical = true;
    this.scroll.elastic = false;
    this.scroll.cancelInnerEvents = true;
    this.content = createNode('PackSelectContent', this.viewport, 941, 1500);
    this.content.getComponent(UITransform)!.setAnchorPoint(0.5, 1);
    this.scroll.content = this.content;
    this.nav = createNode('PackSelectNavigation', this.page, 941, 110);
    this.node.active = false;
  }

  public present(): void {
    this.covered = false;
    this.scroll.enabled = true;
    this.node.active = true;
    this.layoutKey = '';
    this.resize();
    this.loadImages();
    this.page.setPosition(view.getVisibleSize().width, 0);
    this.slide = 'in'; this.slideTime = 0;
  }

  public dismiss(): void { this.slide = null; this.covered = false; this.node.active = false; }

  public refresh(): void {
    const offset = this.scroll.getScrollOffset();
    this.layoutKey = ''; this.resize(); this.loadImages(); this.scroll.scrollToOffset(offset, 0);
  }

  /** Keep the parent painted beneath a child push/pop, while freezing its input and scroll. */
  public suspend(keepVisible = false): void {
    this.slide = null; this.covered = true;
    this.scroll.stopAutoScroll(); this.scroll.enabled = false;
    this.node.active = keepVisible;
  }
  public resume(): void {
    this.covered = false; this.scroll.enabled = true;
    this.node.active = true; this.page.setPosition(0, 0); this.resize();
  }

  protected update(dt: number): void {
    if (this.covered) return;
    this.resize();
    if (!this.slide) return;
    this.slideTime = Math.min(0.3, this.slideTime + Math.max(0, dt));
    const p = this.slideTime / 0.3;
    const eased = 1 - (1 - p) ** 3;
    this.page.setPosition(view.getVisibleSize().width * (this.slide === 'in' ? 1 - eased : eased), 0);
    if (p >= 1) {
      const leaving = this.slide === 'out'; this.slide = null;
      if (leaving) { this.dismiss(); this.actions.onBack(); }
    }
  }

  private close(): void {
    if (this.slide || this.covered) return;
    this.slide = 'out'; this.slideTime = 0;
  }

  private bind(node: Node, action: () => void, stopParent = false): void {
    if (stopParent) node.addComponent(BlockInputEvents);
    const button = UIButton.bind(node, () => { if (!this.slide && !this.covered) action(); });
    const size = node.getComponent(UITransform)!;
    const pressed = createNode('PressedFeedback', node, size.width, size.height);
    const g = pressed.addComponent(Graphics);
    g.fillColor = color('#ffffff', 16);
    g.rect(-size.width / 2, -size.height / 2, size.width, size.height); g.fill();
    pressed.active = false;
    node.on(Node.EventType.TOUCH_START, () => { pressed.active = button.interactable; });
    const release = (): void => { pressed.active = false; };
    node.on(Node.EventType.TOUCH_END, release); node.on(Node.EventType.TOUCH_CANCEL, release);
  }

  private label(parent: Node, name: string, copy: string, font: number, width: number,
    height: number, x: number, y: number, ink = '#d8d1c5', bold = false): Label {
    const label = createLabel(name, parent, copy, font, ink, width, height, x, y);
    label.isBold = bold;
    return label;
  }

  private clear(node: Node): void {
    for (const child of [...node.children]) { child.removeFromParent(); child.destroy(); }
  }

  private releaseMaterials(): void {
    for (const texture of this.materials) texture.dispose();
    this.materials = []; this.views.clear();
  }

  private resize(): void {
    const size = view.getVisibleSize();
    const cssWidth = screen.windowSize.width / (screen.devicePixelRatio || 1) || 375;
    const narrow = cssWidth <= 340;
    const key = `${size.width}:${size.height}:${narrow}`;
    if (this.layoutKey === key) return;
    this.layoutKey = key; this.unit = size.width / 750;
    const g = this.background.getComponent(Graphics)!;
    g.clear(); g.fillColor = color(BG); g.rect(-size.width / 2, -size.height / 2, size.width, size.height); g.fill();
    this.background.getComponent(UITransform)!.setContentSize(size.width, size.height);
    const navHeight = 88 * this.unit;
    this.clear(this.nav);
    this.nav.setPosition(0, size.height / 2 - navHeight / 2);
    createRect('NavBackground', this.nav, size.width, navHeight, BG);
    const back = createNode('Back', this.nav, navHeight, navHeight, -size.width / 2 + navHeight / 2);
    this.label(back, 'Arrow', '‹', 60 * this.unit, navHeight, navHeight, 0, 0);
    this.bind(back, () => this.close());
    this.label(this.nav, 'Title', '选一盒', 34 * this.unit, 350 * this.unit, navHeight, 0, 0);
    const viewportHeight = Math.max(1, size.height - navHeight);
    this.viewport.getComponent(UITransform)!.setContentSize(size.width, viewportHeight);
    this.viewport.setPosition(0, -navHeight / 2);
    this.buildBody(narrow, viewportHeight);
    this.scroll.stopAutoScroll(); this.scroll.scrollToTop(0);
  }

  private buildBody(narrow: boolean, viewportHeight: number): void {
    this.releaseMaterials(); this.clear(this.content);
    const shell = createNode('CatalogShell', this.content, 750, 1);
    shell.setScale(this.unit, this.unit, 1);
    const padding = narrow ? 20 : 28;
    const width = 750 - padding * 2;
    const left = -375 + padding;
    this.label(shell, 'Heading', '选一盒', 58, 300, 76, left + 160, -80, '#d8d1c5', true)
      .horizontalAlign = HorizontalTextAlignment.LEFT;
    let tickets: number | null = null;
    let pack: PackSnapshot | null = null;
    try { tickets = this.actions.readTickets(); } catch { /* Unknown values stay unknown. */ }
    try { pack = this.actions.readPack(); } catch { /* Never synthesize inventory. */ }
    const balance = Number.isSafeInteger(tickets) && tickets! >= 0 ? String(tickets) : '—';
    const walletWidth = Math.max(116, 36 + 41 + balance.length * 16);
    const wallet = createRect('TicketBalance', shell, walletWidth, 60, '#17191a',
      375 - padding - 10 - walletWidth / 2, -80, 0, '#424343');
    const ticket = createRect('TicketMark', wallet, 31, 21, '#27211d', -walletWidth / 2 + 33.5, 0, 0, '#b76838');
    const mark = ticket.getComponent(Graphics)!;
    mark.strokeColor = color('#b76838'); mark.lineWidth = 2;
    for (const x of [-7.5, 7.5]) for (const y of [-5, 0, 5]) {
      mark.moveTo(x, y - 1); mark.lineTo(x, y + 1); mark.stroke();
    }
    for (const x of [-16, 16]) {
      mark.fillColor = color('#17191a'); mark.circle(x, 0, 3.5); mark.fill();
    }
    this.label(wallet, 'Balance', balance, 24, walletWidth - 67, 56, 20, 0, '#b5ada1');
    this.label(shell, 'Copy', '每盒都有自己的拟味与包装性格。', 28, width - 20, 56, 0, -155, '#8f8b84')
      .horizontalAlign = HorizontalTextAlignment.LEFT;
    this.label(shell, 'GiftNote', '普通派烟扣1根，战列舰扣5根 · 取消不退', 24, width - 20, 42, 0, -204, '#c5b59e')
      .horizontalAlign = HorizontalTextAlignment.LEFT;
    this.buildLooseBox(shell, width);
    const gapX = narrow ? 14 : 20;
    const gapY = narrow ? 18 : 24;
    const cardWidth = (width - gapX) / 2;
    const visualHeight = narrow ? 334 : 374;
    const cardHeight = visualHeight + 186;
    const start = 430;
    PACK_CATALOG.forEach((item, index) => {
      const x = left + cardWidth / 2 + (index % 2) * (cardWidth + gapX);
      const top = start + Math.floor(index / 2) * (cardHeight + gapY);
      this.buildCard(shell, item, pack, x, -top - cardHeight / 2, cardWidth, cardHeight, visualHeight, narrow);
    });
    const end = start + Math.ceil(PACK_CATALOG.length / 2) * (cardHeight + gapY) + 18;
    createRect('Rule', shell, width - 20, 2, '#3d3f40', 0, -end);
    this.label(shell, 'Footnote', '点已解锁款设为当前；都是虚拟烟盒，不对应真实商品。', 24,
      width - 20, 80, 0, -end - 62, '#817d77');
    const height = Math.max(viewportHeight, (end + 160) * this.unit);
    this.content.getComponent(UITransform)!.setContentSize(view.getVisibleSize().width, height);
    this.content.setPosition(0, viewportHeight / 2);
  }

  private buildLooseBox(parent: Node, width: number): void {
    let data: { available: number; capacity: number } | null = null;
    try { data = this.actions.readLooseBox?.() ?? null; } catch { /* Optional future source. */ }
    const known = data && Number.isSafeInteger(data.available) && Number.isSafeInteger(data.capacity)
      && data.capacity > 0 && data.available >= 0 && data.available <= data.capacity;
    const loose = createRect('LooseBox', parent, width, 144, '#1c1b19', 0, -326, 9, '#73583f');
    const tray = createRect('Tray', loose, 144, 88, '#121415', -width / 2 + 98, 0, 0, '#464747');
    const filled = known ? Math.min(5, Math.ceil(data!.available / data!.capacity * 5)) : 0;
    const slotWidth = (144 - 26 - 28) / 5;
    for (let i = 0; i < 5; i++) createRect(`Slot${i}`, tray, slotWidth, 53,
      i < filled ? '#c8ab7f' : '#17191a', -72 + 13 + slotWidth / 2 + i * (slotWidth + 7), 6.5, 7, '#454543');
    createRect('TrayFront', tray, 130, 25, '#28221d', 0, -26.5, 0, '#9a633d');
    this.label(loose, 'Name', '散烟盒', 34, 108, 50, -width / 2 + 248, 0, '#e7ded1', true);
    this.label(loose, 'Capacity', known ? `${data!.available} / ${data!.capacity} 根` : '— / — 根',
      26, 174, 50, -width / 2 + 406, 0, '#aaa096');
    const enter = createNode('Enter', loose, 116, 88, width / 2 - 84);
    this.label(enter, 'Text', '进入', 24, 64, 48, -12, 0, '#cf9363');
    const g = createNode('Chevron', enter, 14, 14, 40, 0).addComponent(Graphics);
    g.strokeColor = color('#cf9363'); g.lineWidth = 3;
    g.moveTo(-5, 7); g.lineTo(2, 0); g.lineTo(-5, -7); g.stroke();
    this.bind(loose, () => this.actions.onEnterLooseBox?.());
  }

  private state(item: PackCatalogItem, pack: PackSnapshot | null): CatalogPackState | null {
    if (item.id === 'life') return pack ? { unlocked: true, selected: true,
      remaining: countAvailableSlots(pack), sequence: pack.sequence } : null;
    try { return this.actions.readPackState?.(item.id) ?? null; } catch { return null; }
  }

  private buildCard(parent: Node, item: PackCatalogItem, pack: PackSnapshot | null,
    x: number, y: number, width: number, height: number, visualHeight: number, narrow: boolean): void {
    const state = this.state(item, pack);
    const unlocked = state?.unlocked === true;
    const locked = item.id !== 'life' && !unlocked;
    const card = createRect(`Pack-${item.id}`, parent, width, height,
      item.id === 'life' ? '#121b19' : '#17191a', x, y, 14, state?.selected ? item.accent : '#3e4141');
    this.bind(card, () => {
      if (unlocked) {
        if (this.actions.onSelectPack) this.actions.onSelectPack(item.id);
        else if (item.id === 'life') this.close();
      } else this.actions.onLockedPack?.(item.id);
    });
    const artWidth = narrow ? 224 : 252;
    const art = createNode('Visual', card, artWidth, visualHeight, 0, height / 2 - 20 - visualHeight / 2);
    if (locked) art.addComponent(UIOpacity).opacity = 194;
    const box = new PackBoxView(art, item, artWidth, visualHeight, this.materials);
    this.views.set(item.id, box);
    const frame = this.frames.get(item.id);
    if (frame) box.setFrame(frame);
    if (item.id === 'life' || (item.id === 'shadowless' && unlocked)) {
      const tag = createRect('Tag', card, 104, 38, '#292a25', -width / 2 + 75, height / 2 - 42, 3, item.accent);
      this.label(tag, 'Text', item.id === 'life' ? '首盒免费' : '隐藏款', 24, 98, 36, 0, 0, item.accent);
    }
    if (item.id === 'zuguo') {
      this.label(card, 'Rarity', '典藏', 22, 68, 36, -width / 2 + 57, height / 2 - 36, item.accent);
      if (unlocked) {
        const detail = createNode('NationalDetail', card, 88, 68, width / 2 - 58, height / 2 - 36);
        this.label(detail, 'Text', '详情', 24, 86, 50, 0, 0, item.accent);
        this.bind(detail, () => this.actions.onNationalDetail?.(), true);
      }
    }
    if (state?.selected && unlocked) {
      const current = createRect('Current', card, 76, 38, '#12352f', width / 2 - 61, height / 2 - 42, 3, item.accent);
      this.label(current, 'Text', '当前', 24, 72, 36, 0, 0, '#eee3ca');
    }
    if (locked) this.buildLock(card, item, state, width, height, visualHeight);
    this.label(card, 'Flavor', item.flavor, 24, width - 28, 48, 0, -height / 2 + 134, '#d0c7b9');
    const remaining = state?.remaining;
    const knownRemaining = Number.isSafeInteger(remaining) && remaining! >= 0;
    const status = locked ? '待解锁' : !knownRemaining ? '—' : remaining === 0 ? '空盒'
      : state?.sealState === 'sealed' ? state.sequence === 1 && item.id === 'life' ? '首盒免费' : '未开封'
      : `剩 ${remaining} 根`;
    this.label(card, 'Status', status, 24, 108, 42, -width / 2 + 65, -height / 2 + 60, '#bcb3a5');
    this.label(card, 'Name', item.name, 25, width - 180, 52, 0, -height / 2 + 60, '#eee6da', true);
    if (unlocked) {
      const gift = createRect('Gift', card, 88, 60, '#242420', width / 2 - 58, -height / 2 + 60, 20, '#655446');
      this.label(gift, 'Text', '派烟', 24, 86, 56, 0, 0, '#e6d7c4');
      this.bind(gift, () => this.actions.onGift?.(item.id), true);
    }
  }

  private buildLock(card: Node, item: PackCatalogItem, state: CatalogPackState | null,
    width: number, height: number, visualHeight: number): void {
    const center = height / 2 - 42 - visualHeight / 2;
    const plate = new CanvasTexture('LockedPlate', card, Math.ceil(width - 28), visualHeight);
    this.materials.push(plate); plate.node.setPosition(0, center);
    plate.redraw((ctx) => {
      const gradient = ctx.createLinearGradient(0, visualHeight / 2, 0, -visualHeight / 2);
      for (const [stop, alpha] of [[0, .28], [.34, .56], [.68, .62], [1, .30]])
        gradient.addColorStop(stop, `rgba(13,15,16,${alpha})`);
      ctx.fillStyle = gradient; ctx.fillRect(-(width - 28) / 2, -visualHeight / 2, width - 28, visualHeight);
    });
    const lock = createNode('Lock', card, 48, 55, 0, center + 110);
    const g = lock.addComponent(Graphics);
    g.strokeColor = color('#d8c8ad'); g.lineWidth = 4;
    g.roundRect(-14, 0, 28, 27, 12); g.stroke();
    g.fillColor = color('#bba78a'); g.roundRect(-22, -24, 44, 32, 5); g.fill();
    this.label(card, 'LockedTitle', '待解锁', 27, width - 30, 42, 0, center + 47, '#eee7dc', true);
    this.label(card, 'UnlockRule', item.rule, 24, width - 60, 68, 0, center - 13, '#d0c8bd');
    const hasProgress = Number.isSafeInteger(state?.target) && state!.target! > 1;
    const knownProgress = Number.isSafeInteger(state?.progress) && state!.progress! >= 0;
    if (hasProgress) this.label(card, 'Progress', `${knownProgress ? Math.min(state!.progress!, state!.target!) : '—'} / ${state!.target}`,
      23, width - 40, 32, 0, center - 58, item.accent);
    const ad = createRect('UnlockAd', card, Math.min(250, width - 76), 88, '#33261c',
      0, center - (hasProgress ? 123 : 98), 20, '#87623f');
    this.label(ad, 'Text', '看广告直接解锁', 26, Math.min(226, width - 100), 78, 0, 0, '#f3dab8');
    this.bind(ad, () => this.actions.onUnlockAd?.(item.id), true);
  }

  private loadImages(): void {
    const complete = (id: string, error: Error | null, frame?: SpriteFrame): void => {
      this.pendingImages.delete(id);
      if (this.disposed || !isValid(this, true)) return;
      if (error || !frame) { console.warn(`[PackSelect] Failed to load ${id}`, error); return; }
      frame.addRef(); this.frames.set(id, frame); this.views.get(id)?.setFrame(frame);
    };
    if (!this.frames.has('life') && !this.pendingImages.has('life')) {
      this.pendingImages.add('life');
      resources.load(AssetCatalog.wangXiSkin, SpriteFrame, (error, frame) => complete('life', error, frame));
    }
    const pending = PACK_CATALOG.filter((item) => item.id !== 'life' && item.id !== 'shadowless'
      && !this.frames.has(item.id) && !this.pendingImages.has(item.id));
    for (const item of pending) this.pendingImages.add(item.id);
    if (!pending.length) return;
    void BundleLoader.loadBundle('legacy-temp').then((bundle) => {
      if (this.disposed || !isValid(this, true)) return;
      for (const item of pending) bundle.load(`pack-skins/assets/${item.id}/spriteFrame`, SpriteFrame,
        (error, frame) => complete(item.id, error, frame));
    }).catch((error) => { for (const item of pending) complete(item.id, error); });
  }

  protected onDestroy(): void {
    this.disposed = true; this.releaseMaterials();
    for (const frame of this.frames.values()) frame.decRef();
    this.frames.clear();
  }
}
