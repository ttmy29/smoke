import { _decorator, BlockInputEvents, Component, Graphics, HorizontalTextAlignment,
  Label, Mask, Node, screen, ScrollView, UITransform, VerticalTextAlignment, view } from 'cc';
import { color, createLabel, createNode, createRect, DESIGN_WIDTH } from '../common/UiFactory';
import { UIButton } from '../common/UIButton';

const { ccclass } = _decorator;
const CATEGORIES = ['全部', '套装', '烟盒', '烟圈', '烟灰', '颜色', '打火机'] as const;
type Category = typeof CATEGORIES[number];
const BG = '#100e0e';

export interface WorldShopActions {
  onBack(): void;
  readTickets(): number | null;
  readCollectionCount?: () => number | null;
  onProduct?: () => void;
  onShare?: () => void;
}

/** V1.0.8 shop layout, fitted to the same 375px phone width as the world page. */
@ccclass('WorldShopController')
export class WorldShopController extends Component {
  private actions!: WorldShopActions;
  private page!: Node;
  private background!: Node;
  private nav!: Node;
  private viewport!: Node;
  private scroll!: ScrollView;
  private content!: Node;
  private shell: Node | null = null;
  private product!: Node;
  private empty!: Node;
  private emptyTitle!: Label;
  private emptyCopy!: Label;
  private tickets!: Label;
  private collection!: Label;
  private toast!: Label;
  private category: Category = '全部';
  private chips: Array<{ name: Category; node: Node; text: Label }> = [];
  private pixels = 1;
  private width = 375;
  private layoutKey = '';
  private toastTime = 0;
  private slide: 'in' | 'out' | null = null;
  private slideTime = 0;

  public initialize(actions: WorldShopActions): void {
    this.actions = actions;
    this.node.addComponent(BlockInputEvents);
    this.page = createNode('WorldShopPage', this.node, DESIGN_WIDTH, 1672);
    this.background = createRect('WorldShopBackground', this.page, DESIGN_WIDTH, 1672, BG);
    this.viewport = createNode('WorldShopViewport', this.page, DESIGN_WIDTH, 1500);
    this.viewport.addComponent(Mask);
    this.scroll = this.viewport.addComponent(ScrollView);
    this.scroll.horizontal = false; this.scroll.vertical = true; this.scroll.elastic = false;
    this.content = createNode('WorldShopContent', this.viewport, DESIGN_WIDTH, 1500);
    this.scroll.content = this.content;
    this.nav = createNode('WorldShopNavigation', this.page, DESIGN_WIDTH, 100);
    this.toast = createLabel('ShopNotice', this.page, '', 28, '#f0d6a6', 850, 90);
    this.toast.node.active = false;
    this.resize();
    this.node.active = false;
  }

  public present(): void {
    this.node.active = true;
    this.category = '全部';
    this.toast.node.active = false;
    this.resize();
    this.refreshWallet();
    this.refreshCategory();
    this.scroll.stopAutoScroll();
    this.scroll.scrollToTop(0);
    this.page.setPosition(view.getVisibleSize().width, 0);
    this.slide = 'in';
    this.slideTime = 0;
  }

  public dismiss(): void {
    this.slide = null;
    this.node.active = false;
  }

  protected update(dt: number): void {
    this.resize();
    if (this.toastTime > 0) {
      this.toastTime -= Math.max(0, dt);
      if (this.toastTime <= 0) this.toast.node.active = false;
    }
    if (!this.slide) return;
    this.slideTime = Math.min(0.3, this.slideTime + Math.max(0, dt));
    const p = this.slideTime / 0.3;
    const eased = 1 - (1 - p) ** 3;
    this.page.setPosition(view.getVisibleSize().width * (this.slide === 'in' ? 1 - eased : eased), 0);
    if (p >= 1) {
      const leaving = this.slide === 'out';
      this.slide = null;
      if (leaving) { this.dismiss(); this.actions.onBack(); }
    }
  }

  private close(): void {
    if (this.slide) return;
    this.slide = 'out';
    this.slideTime = 0;
  }

  private notice(copy: string): void {
    this.toast.string = copy;
    this.toast.node.active = true;
    this.toastTime = 2;
  }

  private bind(node: Node, callback: () => void): void {
    const control = UIButton.bind(node, () => { if (!this.slide) callback(); });
    const pressed = createNode('PressedFeedback', node, 1, 1);
    const size = node.getComponent(UITransform)!;
    const g = pressed.addComponent(Graphics);
    g.fillColor = color('#ffffff', 16);
    g.rect(-size.width / 2, -size.height / 2, size.width, size.height); g.fill();
    pressed.active = false;
    node.on(Node.EventType.TOUCH_START, () => { pressed.active = control.interactable; });
    const release = (): void => { pressed.active = false; };
    node.on(Node.EventType.TOUCH_END, release);
    node.on(Node.EventType.TOUCH_CANCEL, release);
  }

  private text(parent: Node, name: string, copy: string, font: number, width: number,
    left: number, top: number, ink = '#c0afa0', bold = false): Label {
    const label = createLabel(name, parent, copy, font, ink, width, font * 1.7);
    label.lineHeight = font * 1.7;
    label.horizontalAlign = HorizontalTextAlignment.LEFT;
    label.verticalAlign = VerticalTextAlignment.TOP;
    label.isBold = bold;
    label.overflow = Label.Overflow.RESIZE_HEIGHT;
    label.updateRenderData(true);
    const transform = label.node.getComponent(UITransform)!;
    label.node.setPosition(left + width / 2, -top - transform.height / 2);
    return label;
  }

  private clear(parent: Node): void {
    for (const child of [...parent.children]) { child.removeFromParent(); child.destroy(); }
  }

  private refreshWallet(): void {
    const read = (fn: (() => number | null) | undefined, max = Number.MAX_SAFE_INTEGER): string => {
      try {
        const value = fn?.();
        return Number.isSafeInteger(value) && value! >= 0 && value! <= max ? String(value) : '—';
      } catch { return '—'; }
    };
    this.tickets.string = `${read(() => this.actions.readTickets())} 张`;
    this.collection.string = `${read(this.actions.readCollectionCount, 6)} / 6 件`;
  }

  private refreshCategory(): void {
    const showingSuite = this.category === '全部' || this.category === '套装';
    this.product.active = showingSuite;
    this.empty.active = !showingSuite;
    this.emptyTitle.string = this.category === '打火机' ? '打火机预设暂未上架' : '这一类的好物还在路上';
    this.emptyCopy.string = this.category === '打火机' ? '现有点火方式仍可正常使用。' : '先去套装里，看看这一圈山河。';
    for (const chip of this.chips) {
      const active = chip.name === this.category;
      chip.text.color = color(active ? '#f0d6a6' : '#b4a18a');
      const g = chip.node.getComponent(Graphics)!;
      g.clear();
      if (active) {
        const width = chip.node.getComponent(UITransform)!.width;
        g.fillColor = color('#c2a171');
        g.rect(-width / 2, -22, width, 2); g.fill();
      }
    }
  }

  private resize(): void {
    const size = view.getVisibleSize();
    const cssWidth = screen.windowSize.width / (screen.devicePixelRatio || 1) || 375;
    this.width = Math.min(375, cssWidth);
    this.pixels = size.width / this.width;
    const key = `${size.width}:${size.height}:${this.width}`;
    if (key === this.layoutKey) return;
    this.layoutKey = key;
    const g = this.background.getComponent(Graphics)!;
    g.clear(); g.fillColor = color(BG);
    g.rect(-size.width / 2, -size.height / 2, size.width, size.height); g.fill();
    this.background.getComponent(UITransform)!.setContentSize(size.width, size.height);
    const navHeight = 44 * this.pixels;
    this.nav.setPosition(0, size.height / 2 - navHeight / 2);
    this.clear(this.nav);
    createRect('Background', this.nav, size.width, navHeight, BG);
    const back = createNode('Back', this.nav, navHeight, navHeight, -size.width / 2 + navHeight / 2);
    createLabel('Arrow', back, '‹', 30 * this.pixels, '#eee1cf', navHeight, navHeight);
    this.bind(back, () => this.close());
    createLabel('Title', this.nav, '全服商店', 17 * this.pixels, '#eee1cf', 220 * this.pixels, navHeight);
    const height = Math.max(1, size.height - navHeight);
    this.viewport.getComponent(UITransform)!.setContentSize(size.width, height);
    this.viewport.setPosition(0, -navHeight / 2);
    this.toast.fontSize = 13 * this.pixels;
    this.toast.node.setPosition(0, -size.height / 2 + 60 * this.pixels);
    this.buildBody(height);
    this.scroll.stopAutoScroll();
    this.scroll.scrollToTop(0);
  }

  private buildBody(viewportHeight: number): void {
    if (this.shell) { this.shell.removeFromParent(); this.shell.destroy(); }
    const shell = this.shell = createNode('WorldShopShell', this.content, this.width, 1);
    shell.getComponent(UITransform)!.setAnchorPoint(0.5, 1);
    shell.setScale(this.pixels, this.pixels, 1);
    const width = this.width - 44;
    const left = -width / 2;
    let top = 24;
    const title = this.text(shell, 'Heading', '全服商店', this.width <= 360 ? 25 : 28,
      width, left, top, '#eee1cf', true);
    top += title.node.getComponent(UITransform)!.height + 14;
    const caption = this.text(shell, 'Caption', '把喜欢的片刻，收入珍藏。', 14, width, left, top);
    top += caption.node.getComponent(UITransform)!.height + 16;
    this.text(shell, 'WalletLabel', '本机烟票', 12, width / 2 - 8, left, top);
    this.text(shell, 'CollectionLabel', '山河系列', 12, width / 2 - 8, 8, top);
    this.tickets = this.text(shell, 'Tickets', '— 张', 22, width / 2 - 8, left, top + 23, '#eee1cf');
    this.collection = this.text(shell, 'Collection', '— / 6 件', 22, width / 2 - 8, 8, top + 23, '#eee1cf');
    for (const label of [this.tickets, this.collection]) { label.enableWrapText = false; label.overflow = Label.Overflow.SHRINK; }
    top += 23 + 38 + 16;
    createRect('WalletRule', shell, width, 1, '#463630', 0, -top);
    top += 18;
    const categoryView = createNode('CategoryViewport', shell, width, 44, 0, -top - 22);
    categoryView.addComponent(Mask);
    const categoryScroll = categoryView.addComponent(ScrollView);
    categoryScroll.horizontal = true; categoryScroll.vertical = false; categoryScroll.elastic = false;
    const chipWidth = Math.max(44, width / CATEGORIES.length);
    const rowWidth = chipWidth * CATEGORIES.length;
    const row = createNode('Categories', categoryView, rowWidth, 44);
    categoryScroll.content = row;
    this.chips = [];
    CATEGORIES.forEach((name, index) => {
      const chip = createNode(`Category-${name}`, row, chipWidth, 44,
        -rowWidth / 2 + chipWidth * (index + 0.5));
      chip.addComponent(Graphics);
      const label = createLabel('Text', chip, name, 13, '#b4a18a', chipWidth - 4, 44);
      this.bind(chip, () => { this.category = name; this.refreshCategory(); });
      this.chips.push({ name, node: chip, text: label });
    });
    categoryScroll.scrollToLeft(0);
    top += 44 + 4;
    createRect('CategoryRule', shell, width, 1, '#685342', 0, -top);
    top += 18;
    this.product = createRect('SuiteCard', shell, width, 172, '#291c20', 0, -top - 86, 12, '#745243');
    const copyWidth = width * 0.51 - 30;
    const productTitle = this.text(this.product, 'Name', '祖国 · 山河锦绣', 16, copyWidth,
      left + 14, -74, '#edd9b0');
    productTitle.enableWrapText = false; productTitle.overflow = Label.Overflow.SHRINK;
    this.text(this.product, 'Copy', '一圈山河，收入珍藏。', 11, copyWidth, left + 14, -45, '#c5ae93');
    this.text(this.product, 'Meta', '国庆限定 · 典藏套装', 10, copyWidth, left + 14, -15, '#d8b283');
    this.text(this.product, 'Date', '截至 2026.10.18', 10, copyWidth, left + 14, 2, '#c0ac94');
    const share = createNode('ShareActivity', this.product, copyWidth, 44,
      left + 14 + copyWidth / 2, -42);
    createLabel('Text', share, '活动分享 · 暂未开放', 11, '#eed4ac', copyWidth, 44,
      0, 0, HorizontalTextAlignment.LEFT);
    this.bind(this.product, () => {
      if (this.actions.onProduct) this.actions.onProduct();
      else this.notice('商品详情暂未开放');
    });
    this.bind(share, () => {
      if (this.actions.onShare) this.actions.onShare();
      else this.notice('活动分享暂未开放');
    });
    share.addComponent(BlockInputEvents);
    this.paintArt(this.product, width);
    this.empty = createNode('EmptyCategory', shell, width, 172, 0, -top - 86);
    this.emptyTitle = createLabel('Title', this.empty, '', 15, '#d4bfa0', width - 20, 36, 0, 7);
    this.emptyCopy = createLabel('Copy', this.empty, '', 12, '#b4a18a', width - 20, 40, 0, -32);
    top += 172 + 108;
    shell.getComponent(UITransform)!.setContentSize(this.width, top);
    const contentHeight = Math.max(viewportHeight, top * this.pixels);
    this.content.getComponent(UITransform)!.setContentSize(DESIGN_WIDTH, contentHeight);
    shell.setPosition(0, contentHeight / 2);
    this.refreshWallet();
    this.refreshCategory();
  }

  private paintArt(parent: Node, width: number): void {
    const art = createNode('NationalSuiteArt', parent, width * 0.49, 122, width * 0.25);
    art.setScale(0.96, 0.96, 1);
    const pack = createRect('Pack', art, 54, 98, '#392526', -28, 0, 3, '#c89e68');
    createLabel('Name', pack, '祖\n国', 21, '#efd6a3', 42, 66, 0, 4).isBold = true;
    createRect('Rule', pack, 46, 1, '#b18b59', 0, -34);
    const g = art.addComponent(Graphics);
    g.strokeColor = color('#bd9f69'); g.lineWidth = 1.4;
    g.moveTo(-51, -29); g.lineTo(-38, -11); g.lineTo(-29, -19);
    g.lineTo(-19, -6); g.lineTo(-4, -30); g.stroke();
    for (const [x, y, radius] of [[32, 28, 24], [15, -23, 18], [56, -23, 18]]) {
      g.strokeColor = color('#d2b878', 185); g.circle(x, y, radius); g.stroke();
      g.strokeColor = color('#8b7351', 165); g.arc(x, y, radius - 4, 0.3, 4.3, false); g.stroke();
    }
  }
}
