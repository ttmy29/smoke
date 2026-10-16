import { _decorator, BlockInputEvents, Component, Graphics, HorizontalTextAlignment,
  instantiate, Label, Mask, Node, screen, ScrollView, Sprite, UITransform,
  Vec3, VerticalTextAlignment, view } from 'cc';
import { color, createLabel, createNode, createRect, DESIGN_WIDTH } from '../common/UiFactory';
import { UIButton } from '../common/UIButton';

const { ccclass } = _decorator;
const WORLD_LAYOUT_WIDTH = 375;

export interface WorldSnapshot {
  connected: boolean;
  online?: number;
  smoking?: number;
  total?: { extracted: string; puffs: string };
  personalUnlocked?: boolean;
}
export interface WorldSource {
  readSnapshot(): Readonly<WorldSnapshot>;
  refresh(): Promise<Readonly<WorldSnapshot>>;
}
export interface WorldNavigation {
  onHome(): void;
  onWorldImpact?: () => void;
  onPersonalImpact?: () => void;
  onShop?: () => void;
  onProduct?: () => void;
}
export const emptyWorldSource: WorldSource = {
  readSnapshot: () => ({ connected: false }),
  refresh: async () => ({ connected: false }),
};

/** Server counters are decimal strings to preserve totals larger than JS safe integers. */
export function formatWorldCounter(value: unknown): string {
  return typeof value === 'string' && /^\d+$/.test(value)
    ? value.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '—';
}

@ccclass('WorldController')
export class WorldController extends Component {
  private source: WorldSource = emptyWorldSource;
  private navigation!: WorldNavigation;
  private snapshot: Readonly<WorldSnapshot> = { connected: false };
  private background!: Node;
  private viewport!: Node;
  private content!: Node;
  private shell: Node | null = null;
  private scroll!: ScrollView;
  private dock: Node | null = null;
  private dockBase: Node | null = null;
  private selectedBackground: Node | null = null;
  private selectedMarker: Node | null = null;
  private toast!: Label;
  private toastSeconds = 0;
  private layoutKey = '';
  private pixels = 1;
  private width = 375;
  private busy = false;
  private revision = 0;
  private connection!: Label;
  private connectionCopy!: Node;
  private refreshLabel!: Label;
  private refreshButton!: UIButton;
  private online!: Label;
  private smoking!: Label;
  private extracted!: Label;
  private puffs!: Label;
  private worldButton!: UIButton;
  private personalButton!: UIButton;
  private personalNote!: Label;
  private personalMark!: Label;

  public initialize(navigation: WorldNavigation, source: WorldSource = emptyWorldSource): void {
    this.navigation = navigation;
    this.source = source;
    this.node.addComponent(BlockInputEvents);
    this.background = createRect('WorldBackground', this.node, DESIGN_WIDTH, 1672, '#0b0e0f');
    this.viewport = createNode('WorldViewport', this.node, DESIGN_WIDTH, 1500);
    this.viewport.addComponent(Mask);
    this.scroll = this.viewport.addComponent(ScrollView);
    this.scroll.horizontal = false; this.scroll.vertical = true; this.scroll.elastic = false;
    this.content = createNode('WorldContent', this.viewport, DESIGN_WIDTH, 1500);
    this.scroll.content = this.content;
    this.toast = createLabel('WorldNotice', this.node, '', 26, '#f0c58b', 850, 90);
    this.toast.node.active = false;
    this.resize();
    this.node.active = false;
  }

  public setSource(source: WorldSource): void {
    this.revision++;
    this.busy = false;
    this.source = source;
    this.readSnapshot();
  }

  public setNavigationHandlers(navigation: WorldNavigation): void { this.navigation = { ...navigation }; }

  /** Copies only authored navigation, preserving its transforms and the home prefab itself. */
  public attachBottomNavigation(bottom: Node): void {
    if (this.dock) { this.dock.removeFromParent(); this.dock.destroy(); }
    this.selectedBackground = null;
    this.selectedMarker = null;
    const dock = createNode('WorldBottomNavigation', this.node, DESIGN_WIDTH, 100);
    dock.active = false;
    dock.setPosition(bottom.position);
    dock.setScale(bottom.scale);
    dock.setRotation(bottom.rotation);
    this.dock = dock;
    const base = bottom.getChildByName('ui底板');
    this.dockBase = base ? instantiate(base) : null;
    if (this.dockBase) dock.addChild(this.dockBase);
    const buttons = bottom.getChildByName('buttons') ?? bottom.getChildByName('bottons');
    if (buttons) {
      const group = createNode('buttons', dock, 100, 100);
      group.setPosition(buttons.position);
      group.setScale(buttons.scale);
      group.setRotation(buttons.rotation);
      for (const [names, selected] of [[['Node'], false], [['Node2', 'Node-001'], true]] as const) {
        const original = names.map((name) => buttons.getChildByName(name)).find(Boolean);
        if (!original) continue;
        const tab = instantiate(original);
        group.addChild(tab);
        const bg = tab.getChildByName('bg');
        if (!bg) continue;
        if (selected) this.selectedBackground = bg;
        for (const child of tab.children) {
          if (child === bg) continue;
          const sprite = child.getComponent(Sprite);
          if (sprite) sprite.color = color(selected ? '#f0c58b' : '#aa9b87');
        }
        const control = UIButton.bind(bg, () => { if (!selected) this.navigation.onHome(); });
        const icon = tab.getChildByName('icon') ?? tab.getChildByName('烟');
        control.setTintTarget(icon?.getComponent(Sprite) ?? null);
        control.visualTarget = icon;
      }
    }
    dock.active = true;
    if (this.selectedBackground && this.dockBase) {
      this.selectedMarker = createNode('WorldSelectedIndicator', dock, 1, 1);
      this.selectedMarker.addComponent(Graphics);
    }
    this.toast.node.setSiblingIndex(this.node.children.length - 1);
    this.layoutKey = '';
  }

  public present(): void {
    this.node.active = true;
    this.toast.node.active = false;
    this.resize();
    this.readSnapshot();
    this.scroll.stopAutoScroll();
    this.scroll.scrollToTop(0);
  }

  public dismiss(): void {
    this.revision++;
    this.busy = false;
    this.node.active = false;
  }

  protected onDestroy(): void { this.revision++; }
  protected update(dt: number): void {
    this.resize();
    if (this.toastSeconds > 0) {
      this.toastSeconds -= Math.max(0, dt);
      if (this.toastSeconds <= 0) this.toast.node.active = false;
    }
  }

  private readSnapshot(): void {
    try { this.snapshot = this.source.readSnapshot() ?? { connected: false }; }
    catch { this.snapshot = { connected: false }; }
    this.refreshLabels();
  }

  private async refresh(): Promise<void> {
    if (this.busy) return;
    const request = ++this.revision;
    this.busy = true;
    this.refreshLabels();
    try {
      const snapshot = await this.source.refresh();
      if (request !== this.revision || !this.isValid) return;
      this.snapshot = snapshot ?? { connected: false };
    } catch {
      if (request !== this.revision || !this.isValid) return;
      this.snapshot = { ...this.snapshot, connected: false };
    }
    if (request !== this.revision || !this.isValid) return;
    this.busy = false;
    this.refreshLabels();
  }

  private refreshLabels(): void {
    if (!this.connection) return;
    const data = this.snapshot;
    this.connectionCopy.active = !data.connected || this.busy;
    this.connection.string = this.busy ? '正在连接…' : '未连接到服务器';
    this.refreshLabel.string = data.connected ? '刷新' : '重试';
    this.refreshButton.interactable = !this.busy;
    const presence = (value?: number): string => data.connected && Number.isSafeInteger(value) && value! >= 0
      ? formatWorldCounter(String(value)) : '—';
    this.online.string = presence(data.online);
    this.smoking.string = presence(data.smoking);
    this.extracted.string = formatWorldCounter(data.total?.extracted);
    this.puffs.string = formatWorldCounter(data.total?.puffs);
    for (const label of [this.extracted, this.puffs]) {
      label.fontSize = label.string.length > 18 ? 12 : label.string.length > 13 ? 17 : 20;
    }
    this.worldButton.interactable = this.extracted.string !== '—' && this.puffs.string !== '—';
    this.personalButton.interactable = !!data.personalUnlocked;
    this.paintImpactButton(this.worldButton, this.worldButton.interactable);
    this.paintImpactButton(this.personalButton, this.personalButton.interactable, true);
    this.personalNote.string = data.personalUnlocked ? '看看我的贡献' : '先看全服影响';
    this.personalMark.string = data.personalUnlocked ? '♙  ›' : '锁';
  }

  private paintImpactButton(control: UIButton, enabled: boolean, personal = false): void {
    const transform = control.node.getComponent(UITransform)!;
    const g = control.node.getComponent(Graphics)!;
    const alpha = enabled ? 255 : personal ? 204 : 128;
    g.clear();
    g.fillColor = color(personal ? enabled ? '#151918' : '#121615' : enabled ? '#2c291f' : '#1b1e18', alpha);
    g.strokeColor = color(personal ? '#4c493b' : '#89734a', alpha);
    g.lineWidth = 1;
    g.roundRect(-transform.width / 2, -transform.height / 2, transform.width, transform.height, 2); g.fill();
    g.roundRect(-transform.width / 2, -transform.height / 2, transform.width, transform.height, 2); g.stroke();
    for (const label of control.node.getComponentsInChildren(Label)) {
      const ink = label.color.clone(); ink.a = alpha; label.color = ink;
    }
  }

  private route(key: 'onWorldImpact' | 'onPersonalImpact' | 'onShop' | 'onProduct', title: string): void {
    const callback = this.navigation[key];
    if (callback) { callback(); return; }
    this.toast.string = `${title}暂未开放`;
    this.toast.node.active = true;
    this.toastSeconds = 2;
  }

  private text(parent: Node, name: string, copy: string, font: number, width: number,
    left: number, top: number, ink = '#e8ddc5', bold = false): Label {
    const label = createLabel(name, parent, copy, font, ink, width, font * 1.4);
    label.lineHeight = font * 1.4;
    label.horizontalAlign = HorizontalTextAlignment.LEFT;
    label.verticalAlign = VerticalTextAlignment.TOP;
    label.isBold = bold;
    label.overflow = Label.Overflow.RESIZE_HEIGHT;
    label.updateRenderData(true);
    const size = label.node.getComponent(UITransform)!;
    label.node.setPosition(left + width / 2, -top - size.height / 2);
    return label;
  }

  private bind(node: Node, action: () => void): UIButton {
    const control = UIButton.bind(node, action);
    // Graphics colors must be changed directly; UIOpacity does not recolor its mesh.
    const pressed = createNode('Pressed', node, 1, 1);
    const g = pressed.addComponent(Graphics);
    g.fillColor = color('#ffffff', 14);
    const transform = node.getComponent(UITransform)!;
    g.rect(-transform.width / 2, -transform.height / 2, transform.width, transform.height); g.fill();
    pressed.active = false;
    node.on(Node.EventType.TOUCH_START, () => { pressed.active = control.interactable; });
    const release = (): void => { pressed.active = false; };
    node.on(Node.EventType.TOUCH_END, release);
    node.on(Node.EventType.TOUCH_CANCEL, release);
    return control;
  }

  private resize(): void {
    const size = view.getVisibleSize();
    const cssWidth = screen.windowSize.width / (screen.devicePixelRatio || 1) || 375;
    // Fit the phone layout to the game canvas, including wide desktop previews.
    // Narrow windows keep the legacy <=360px layout; larger windows use 375px.
    const layoutWidth = Math.min(WORLD_LAYOUT_WIDTH, cssWidth);
    this.pixels = size.width / layoutWidth;
    this.width = layoutWidth;
    let dockHeight = 57 * this.pixels;
    if (this.dockBase && this.dock) {
      const rect = this.dockBase.getComponent(UITransform)!.getBoundingBox();
      const top = this.dock.position.y + rect.yMax * this.dock.scale.y;
      dockHeight = Math.max(0, Math.min(size.height, size.height / 2 + top));
    }
    const key = `${size.width}:${size.height}:${layoutWidth}:${dockHeight}`;
    if (key === this.layoutKey) return;
    this.layoutKey = key;
    if (this.selectedMarker && this.selectedBackground && this.dockBase && this.dock) {
      const bgRect = this.selectedBackground.getComponent(UITransform)!.getBoundingBoxToWorld();
      const baseRect = this.dockBase.getComponent(UITransform)!.getBoundingBoxToWorld();
      const center = this.dock.getComponent(UITransform)!.convertToNodeSpaceAR(
        new Vec3(bgRect.center.x, baseRect.yMax - this.pixels, 0));
      this.selectedMarker.setPosition(center);
      const w = 24 * this.pixels / Math.max(0.001, Math.abs(this.dock.scale.x));
      const h = 2 * this.pixels / Math.max(0.001, Math.abs(this.dock.scale.y));
      const marker = this.selectedMarker.getComponent(Graphics)!;
      marker.clear(); marker.fillColor = color('#f06013');
      marker.rect(-w / 2, -h / 2, w, h); marker.fill();
      this.selectedMarker.getComponent(UITransform)!.setContentSize(w, h);
    }
    const graphics = this.background.getComponent(Graphics)!;
    graphics.clear(); graphics.fillColor = color('#0b0e0f');
    graphics.rect(-size.width / 2, -size.height / 2, size.width, size.height); graphics.fill();
    this.background.getComponent(UITransform)!.setContentSize(size.width, size.height);
    const height = Math.max(1, size.height - dockHeight);
    this.viewport.getComponent(UITransform)!.setContentSize(size.width, height);
    this.viewport.setPosition(0, dockHeight / 2);
    this.toast.node.setPosition(0, -size.height / 2 + dockHeight + 80);
    this.buildBody(layoutWidth, height);
  }

  private buildBody(cssWidth: number, viewportHeight: number): void {
    if (this.shell) { this.shell.removeFromParent(); this.shell.destroy(); }
    const shell = this.shell = createNode('WorldShell', this.content, this.width, 1);
    shell.getComponent(UITransform)!.setAnchorPoint(0.5, 1);
    shell.setScale(this.pixels, this.pixels, 1);
    const padding = cssWidth <= 360 ? 18 : 24;
    const width = this.width - padding * 2;
    const left = -width / 2;
    let top = 24;
    this.text(shell, 'Brand', '▱  赛博抽烟', 13, width, left, top, '#c6b995');
    top += 40 + 14;
    this.text(shell, 'Heading', '全服', 29, width - 170, left, top, '#e8ddc5', true);
    const subtitle = this.text(shell, 'Subtitle', '在屏幕里，留一处喘息。',
      cssWidth <= 360 ? 11 : 12, width - 170, left, top + 44, '#aaa28f');
    const status = createNode('Connection', shell, 162, 44, width / 2 - 81, -top - 30);
    this.connectionCopy = createNode('ConnectionCopy', status, 110, 44, -26);
    this.connection = this.text(this.connectionCopy, 'Status', '未连接到服务器', 11, 110, -55, -17, '#b7a78a');
    this.text(this.connectionCopy, 'CacheNote', '有缓存时显示上次统计', 10, 110, -55, 1, '#aa9b87');
    const refresh = createNode('Refresh', status, 44, 44, 59);
    this.refreshLabel = createLabel('Text', refresh, '重试', 12, '#d4b67d', 44, 36);
    this.refreshButton = this.bind(refresh, () => { void this.refresh(); });
    top += Math.max(60, 44 + subtitle.node.getComponent(UITransform)!.height) + 24;
    const metricWidth = width / 2;
    const onlineX = left;
    const smokingX = 0 + (cssWidth <= 360 ? 17 : 25);
    this.text(shell, 'OnlineTitle', '●  在线人数', 12, metricWidth - 10, onlineX, top, '#bcb298');
    this.text(shell, 'SmokingTitle', '正在赛博抽烟', 12, metricWidth - 25, smokingX, top, '#bcb298');
    createRect('PresenceDivider', shell, 1, 66, '#37392e', 0, -top - 33);
    const numberFont = cssWidth <= 360 ? 28 : 30;
    this.online = this.text(shell, 'Online', '—', numberFont, metricWidth - 44, onlineX, top + 29, '#e6ddc7', true);
    this.smoking = this.text(shell, 'Smoking', '—', numberFont, metricWidth - 60, smokingX, top + 29, '#e6b468', true);
    this.text(shell, 'OnlineUnit', '人', 12, 16, -22, top + 45, '#b1a48b');
    this.text(shell, 'SmokingUnit', '人', 12, 16, width / 2 - 16, top + 45, '#b1a48b');
    top += 85;
    createRect('PresenceRule', shell, width, 1, '#403c30', 0, -top);
    top += 22;
    createRect('StatsRule', shell, 2, 104, '#ad9155', left + 1, -top - 52);
    this.text(shell, 'StatsHeading', '全服统计', 17, 160, left + 14, top, '#e8ddc5');
    this.text(shell, 'StatsCaption', '全服累计', 10, 70, width / 2 - 70, top + 4, '#aa9b7c');
    top += 42;
    this.text(shell, 'ExtractedTitle', '全服吸烟数', 11, metricWidth - 14, left + 14, top, '#bab09a');
    this.text(shell, 'PuffsTitle', '累计呼气次数', 11, metricWidth - 16, smokingX, top, '#bab09a');
    createRect('StatsDivider', shell, 1, 52, '#35372e', 0, -top - 26);
    this.extracted = this.text(shell, 'Extracted', '—', 20, metricWidth - 38, left + 14, top + 22, '#eadfc2', true);
    this.puffs = this.text(shell, 'Puffs', '—', 20, metricWidth - 54, smokingX, top + 22, '#eadfc2', true);
    for (const value of [this.online, this.smoking, this.extracted, this.puffs]) {
      value.enableWrapText = false;
      value.overflow = Label.Overflow.SHRINK;
    }
    this.text(shell, 'ExtractedUnit', '根', 11, 16, -20, top + 29, '#b2a48b');
    this.text(shell, 'PuffsUnit', '次', 11, 16, width / 2 - 16, top + 29, '#b2a48b');
    top += 62 + 16;
    const gap = cssWidth <= 360 ? 8 : 12;
    const actionWidth = (width - gap) / 2;
    const world = createRect('WorldImpact', shell, actionWidth, 76, '#2c291f',
      -(actionWidth + gap) / 2, -top - 38, 2, '#89734a');
    const personal = createRect('PersonalImpact', shell, actionWidth, 76, '#151918',
      (actionWidth + gap) / 2, -top - 38, 2, '#4c493b');
    for (const [node, title] of [[world, '全服影响'], [personal, '个人影响']] as const) {
      const font = cssWidth <= 360 ? 16 : 17;
      this.text(node, 'Title', title, font, actionWidth - 44, -actionWidth / 2 + 12, -25, '#e2c791', true);
    }
    this.text(world, 'Note', '看看像素之外', 10, actionWidth - 36, -actionWidth / 2 + 12, 3, '#c1ad84');
    this.personalNote = this.text(personal, 'Note', '先看全服影响', 10, actionWidth - 36,
      -actionWidth / 2 + 12, 3, '#aaa18d');
    createLabel('Icon', world, '◎ ›', 22, '#bbaa83', 36, 40, actionWidth / 2 - 22);
    this.personalMark = createLabel('Icon', personal, '锁', 12, '#bbaa83', 30, 40, actionWidth / 2 - 20);
    this.worldButton = this.bind(world, () => this.route('onWorldImpact', '全服影响'));
    this.personalButton = this.bind(personal, () => this.route('onPersonalImpact', '个人影响'));
    top += 76 + 9;
    const disclaimer = this.text(shell, 'Disclaimer', '同量真烟影响推演 · 非实际收益统计', 10, width,
      left, top, '#968e7c');
    disclaimer.horizontalAlign = HorizontalTextAlignment.CENTER;
    top += disclaimer.node.getComponent(UITransform)!.height + 17;
    this.text(shell, 'ShopTitle', '▥  全服商店', 18, width - 90, left, top + 9, '#e8ddc5');
    const shop = createNode('MoreProducts', shell, 88, 44, width / 2 - 44, -top - 22);
    createLabel('Text', shop, '查看更多  ›', 11, '#b9aa86', 88, 44);
    this.bind(shop, () => this.route('onShop', '全服商店'));
    top += 44 + 9;
    const featured = createRect('FeaturedProduct', shell, width, 144, '#251b1e', 0, -top - 72, 12, '#735245');
    this.text(featured, 'ProductTitle', '祖国 · 山河锦绣', 16, width * 0.51 - 16,
      left + 14, -53, '#e7d9b6');
    this.text(featured, 'ProductNote', '一圈山河，收入珍藏。', 11, width * 0.51 - 16,
      left + 14, -22, '#ccbaa4');
    this.text(featured, 'ProductCost', '国庆限定 · 活动获取', 10, width * 0.51 - 16,
      left + 14, 14, '#e0ba85');
    this.paintFeaturedArt(featured, width);
    this.bind(featured, () => this.route('onProduct', '商品详情'));
    top += 144 + 21;
    const contentHeight = Math.max(viewportHeight, top * this.pixels);
    shell.getComponent(UITransform)!.setContentSize(this.width, top);
    this.content.getComponent(UITransform)!.setContentSize(DESIGN_WIDTH, contentHeight);
    shell.setPosition(0, contentHeight / 2);
    this.scroll.stopAutoScroll();
    this.scroll.scrollToTop(0);
    this.refreshLabels();
  }

  private paintFeaturedArt(parent: Node, width: number): void {
    const art = createNode('NationalSuiteArt', parent, width * 0.49, 118, width * 0.25);
    const pack = createRect('Pack', art, 54, 98, '#392526', -28, 0, 3, '#c89e68');
    createLabel('Name', pack, '祖\n国', 21, '#efd6a3', 42, 66, 0, 4).isBold = true;
    createRect('PackRule', pack, 46, 1, '#b18b59', 0, -34);
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
