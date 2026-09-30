import { _decorator, assetManager, BlockInputEvents, Button, Component, Graphics,
  HorizontalTextAlignment, ImageAsset, Label, Mask, Node, ScrollView, Sprite,
  SpriteFrame, Texture2D, UITransform, view } from 'cc';
import { color, createLabel, createNode, createRect, DESIGN_WIDTH } from '../common/UiFactory';
import { buildReceiveRanking, ReceiveRankingItem, ReceiveRankingSource,
  RankingScope, receivedGiftStatus } from './ReceiveRankingModel';

const { ccclass } = _decorator;
const BACKGROUND = '#101214';
const SURFACE = '#171919';
const FOREGROUND = '#eee6da';
const MUTED = '#a39c93';
const RULE = '#3a3c3d';

function calendarDate(at: number): string {
  const date = new Date(at);
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日`;
}

@ccclass('ReceiveRankingController')
export class ReceiveRankingController extends Component {
  private source!: ReceiveRankingSource;
  private onBack!: () => void;
  private background!: Node;
  private nav!: Node;
  private viewport!: Node;
  private scroll!: ScrollView;
  private content!: Node;
  private overlay!: Node;
  private overlayPanel!: Node;
  private overlayViewport!: Node;
  private overlayScroll!: ScrollView;
  private overlayContent!: Node;
  private scope: RankingScope = 'seven-days';
  private items: ReceiveRankingItem[] = [];
  private visible = 20;
  private selected: ReceiveRankingItem | null = null;
  private detailVisible = 20;
  private loadError = false;
  private height = 0;
  private slide: 'in' | 'out' | null = null;
  private slideTime = 0;
  private static readonly SLIDE_SECONDS = 0.3;

  public initialize(source: ReceiveRankingSource, onBack: () => void): void {
    this.source = source;
    this.onBack = onBack;
    this.build();
  }

  public present(): void {
    this.scope = 'seven-days';
    this.visible = 20;
    this.selected = null;
    this.overlay.active = false;
    this.node.active = true;
    this.load();
    this.resize();
    this.scroll.scrollToTop(0);
    this.node.setPosition(view.getVisibleSize().width, 0);
    this.slide = 'in';
    this.slideTime = 0;
  }

  public dismiss(): void {
    this.slide = null;
    this.node.active = false;
    this.overlay.active = false;
  }

  protected update(dt: number): void {
    if (!this.node.active) return;
    this.resize();
    if (!this.slide) return;
    this.slideTime = Math.min(ReceiveRankingController.SLIDE_SECONDS,
      this.slideTime + Math.max(0, dt));
    const progress = this.slideTime / ReceiveRankingController.SLIDE_SECONDS;
    const eased = 1 - (1 - progress) ** 3;
    this.node.setPosition(view.getVisibleSize().width *
      (this.slide === 'in' ? 1 - eased : eased), 0);
    if (progress >= 1) {
      const leaving = this.slide === 'out';
      this.slide = null;
      if (leaving) { this.dismiss(); this.onBack(); }
    }
  }

  private close(): void {
    if (this.slide || !this.node.active) return;
    if (this.overlay.active) { this.closeDetail(); return; }
    this.slide = 'out';
    this.slideTime = 0;
  }

  private build(): void {
    this.node.addComponent(BlockInputEvents);
    this.background = createRect('RankingBackground', this.node,
      DESIGN_WIDTH, 2400, BACKGROUND);
    this.viewport = createNode('RankingViewport', this.node, DESIGN_WIDTH, 1000);
    this.viewport.addComponent(Mask);
    this.scroll = this.viewport.addComponent(ScrollView);
    this.scroll.horizontal = false;
    this.scroll.vertical = true;
    this.scroll.elastic = false;
    this.content = createNode('RankingContent', this.viewport, DESIGN_WIDTH, 1100);
    this.scroll.content = this.content;
    this.nav = createNode('RankingNavigation', this.node, DESIGN_WIDTH, 128);
    createRect('NavigationBackground', this.nav, DESIGN_WIDTH, 128, BACKGROUND);
    const back = createNode('RankingBack', this.nav, 88, 88, -331, -12);
    back.addComponent(Button).transition = Button.Transition.NONE;
    createLabel('Text', back, '‹', 48, FOREGROUND, 80, 78);
    back.on(Button.EventType.CLICK, () => this.close());
    createLabel('NavigationTitle', this.nav, '收烟记录',
      34, FOREGROUND, 280, 56, 0, -12);

    this.overlay = createNode('RankingDetailOverlay', this.node, DESIGN_WIDTH, 1600);
    this.overlay.addComponent(BlockInputEvents);
    const dim = createNode('DetailDim', this.overlay, DESIGN_WIDTH, 2400);
    const dimGraphic = dim.addComponent(Graphics);
    dimGraphic.fillColor = color('#040506', 214);
    dimGraphic.rect(-375, -1200, 750, 2400);
    dimGraphic.fill();
    dim.addComponent(Button).transition = Button.Transition.NONE;
    dim.on(Button.EventType.CLICK, () => this.closeDetail());
    this.overlayPanel = createRect('DetailPanel', this.overlay, 702, 1000,
      '#181a1a', 0, 0, 14, '#4d4944');
    this.overlayViewport = createNode('DetailViewport', this.overlayPanel, 642, 700);
    this.overlayViewport.addComponent(Mask);
    this.overlayScroll = this.overlayViewport.addComponent(ScrollView);
    this.overlayScroll.horizontal = false;
    this.overlayScroll.vertical = true;
    this.overlayScroll.elastic = false;
    this.overlayContent = createNode('DetailContent', this.overlayViewport, 642, 700);
    this.overlayScroll.content = this.overlayContent;
    this.overlay.active = false;
    this.node.active = false;
  }

  private resize(): void {
    const height = view.getVisibleSize().height;
    if (height === this.height) return;
    this.height = height;
    this.node.getComponent(UITransform)!.setContentSize(DESIGN_WIDTH, height);
    this.viewport.getComponent(UITransform)!.setContentSize(DESIGN_WIDTH,
      Math.max(200, height - 128));
    this.viewport.setPosition(0, -64);
    this.nav.setPosition(0, height / 2 - 64);
    this.overlay.getComponent(UITransform)!.setContentSize(DESIGN_WIDTH, height);
    const panelHeight = Math.max(430, Math.min(height * 0.78, height - 46));
    this.overlayPanel.getComponent(UITransform)!.setContentSize(702, panelHeight);
    this.overlayPanel.setPosition(0, -height / 2 + panelHeight / 2 + 24);
    this.overlayViewport.getComponent(UITransform)!.setContentSize(642,
      Math.max(180, panelHeight - 180));
    this.overlayViewport.setPosition(0, -64);
    this.render();
    if (this.overlay.active) this.renderDetail();
  }

  private load(): void {
    try {
      const events = this.source.readReceivedEvents();
      if (events === null) throw new Error('RECEIVE_RANKING_UNAVAILABLE');
      this.items = buildReceiveRanking(events, this.scope);
      this.loadError = false;
    } catch {
      this.items = [];
      this.loadError = true;
    }
    this.selected = null;
    this.overlay.active = false;
    this.render();
  }

  private label(parent: Node, name: string, value: string, x: number, y: number,
    width: number, height: number, size: number, tint: string,
    align = HorizontalTextAlignment.LEFT): Label {
    return createLabel(name, parent, value, size, tint, width, height, x, y, align);
  }

  private repaint(node: Node, fill: string): void {
    const size = node.getComponent(UITransform)!;
    const graphic = node.getComponent(Graphics)!;
    graphic.clear();
    graphic.fillColor = color(fill);
    graphic.rect(-size.width / 2, -size.height / 2, size.width, size.height);
    graphic.fill();
  }

  private render(): void {
    if (!this.content) return;
    for (const child of [...this.content.children]) child.destroy();
    const count = Math.min(this.visible, this.items.length);
    const bodyHeight = Math.max(this.height - 128,
      490 + (count ? count * 126 : 340) + (this.items.length > count ? 88 : 0));
    this.content.getComponent(UITransform)!.setContentSize(DESIGN_WIDTH, bodyHeight);
    let cursor = bodyHeight / 2 - 62;
    this.label(this.content, 'RankingTitle', '我的收烟榜', 0,
      cursor - 34, 682, 68, 52, FOREGROUND).isBold = true;
    this.label(this.content, 'RankingCopy',
      '按派烟人的本机匿名编号合并；同名的不同人不会混在一起。',
      0, cursor - 110, 640, 80, 24, MUTED);
    cursor -= 178;
    createRect('TabsRule', this.content, 682, 2, RULE, 0, cursor - 88);
    for (const [index, scope] of (['seven-days', 'all'] as const).entries()) {
      const active = this.scope === scope;
      const tab = createNode(`RankingTab${index}`, this.content, 341, 88,
        index === 0 ? -170.5 : 170.5, cursor - 44);
      tab.addComponent(Button).transition = Button.Transition.NONE;
      createLabel('Text', tab, index === 0 ? '近 7 天' : '总榜', 26,
        active ? '#e4d9ca' : '#918b83', 320, 72);
      if (active) createRect('SelectedRule', tab, 341, 4,
        '#c6743f', 0, -42);
      tab.on(Button.EventType.CLICK, () => {
        if (this.scope === scope) return;
        this.scope = scope;
        this.visible = 20;
        this.load();
        this.scroll.scrollToTop(0);
      });
    }
    cursor -= 106;
    if (this.loadError || !this.items.length) {
      cursor -= 78;
      const empty = createRect('RankingEmpty', this.content, 682,
        this.loadError ? 270 : 230, SURFACE, 0,
        cursor - (this.loadError ? 135 : 115), 0, '#3d3f40');
      this.label(empty, 'EmptyTitle', this.loadError
        ? '榜单暂时读不出来' : '还没有接烟记录', 0,
      this.loadError ? 75 : 48, 606, 58, 32, '#dcd4c8',
      HorizontalTextAlignment.CENTER).isBold = true;
      this.label(empty, 'EmptyCopy', this.loadError
        ? '请重试，暂时无法确认接烟记录。'
        : '真正领取成功后才会计入，重复领取不会增加数量。',
      0, this.loadError ? 15 : -23, 606, 82, 24, '#9a948c',
      HorizontalTextAlignment.CENTER);
      if (this.loadError) {
        const retry = createRect('RetryRanking', empty, 490, 78,
          '#202222', 0, -88, 6, '#4b4a47');
        retry.addComponent(Button).transition = Button.Transition.NONE;
        createLabel('Text', retry, '重新读取', 24, '#d9d1c5', 460, 66);
        retry.on(Button.EventType.CLICK, () => this.load());
      }
      cursor -= this.loadError ? 270 : 230;
    } else {
      for (const [index, item] of this.items.slice(0, count).entries()) {
        const row = createRect(`Rank${item.rank}`, this.content, 682, 126,
          BACKGROUND, 0, cursor - 63);
        row.addComponent(Button).transition = Button.Transition.NONE;
        this.label(row, 'RankNumber', String(item.rank), -302, 0,
          58, 90, 38, '#c47a48', HorizontalTextAlignment.CENTER);
        this.avatar(row, item.displayNickname, item.avatarUrl, -216, 0, 82);
        this.label(row, 'Name', item.displayNickname, 8, 20,
          325, 54, 29, '#e7dfd3').isBold = true;
        this.label(row, 'Latest', `最近：${calendarDate(item.latestReceivedAt)}`,
          8, -26, 325, 42, 22, '#969087');
        this.label(row, 'Count', `${item.count} 根`, 273, 0,
          120, 72, 24, '#cfb081', HorizontalTextAlignment.RIGHT);
        createRect('RowRule', row, 682, 2, '#303233', 0, -62);
        row.on(Node.EventType.TOUCH_START, () => this.repaint(row, '#181a1b'));
        const release = (): void => { if (row.isValid) this.repaint(row, BACKGROUND); };
        row.on(Node.EventType.TOUCH_END, release);
        row.on(Node.EventType.TOUCH_CANCEL, release);
        row.on(Button.EventType.CLICK, () => this.openDetail(item));
        cursor -= 126;
      }
      if (this.items.length > count) {
        const more = createRect('MoreRanking', this.content, 682, 88,
          '#202222', 0, cursor - 54, 6, '#4b4a47');
        more.addComponent(Button).transition = Button.Transition.NONE;
        createLabel('Text', more, '查看更多好友', 24, '#d9d1c5', 650, 72);
        more.on(Button.EventType.CLICK, () => { this.visible += 20; this.render(); });
        cursor -= 108;
      }
    }
    this.label(this.content, 'RankingBoundary',
      '记录只存在本机，清除或卸载后无法找回。', 0,
      cursor - 56, 682, 80, 22, '#9a958d', HorizontalTextAlignment.CENTER);
  }

  private avatar(parent: Node, nickname: string, avatarUrl: string,
    x: number, y: number, size: number): void {
    const avatar = createNode('Avatar', parent, size, size, x, y);
    const mask = avatar.addComponent(Mask);
    mask.type = Mask.Type.GRAPHICS_ELLIPSE;
    createRect('AvatarBack', avatar, size, size, '#202223');
    createLabel('Initial', avatar, nickname.charAt(0) || '烟', 28,
      '#d8c3a4', size - 8, size - 8);
    const ring = createNode('AvatarRing', parent, size + 2, size + 2, x, y);
    const graphic = ring.addComponent(Graphics);
    graphic.lineWidth = 2;
    graphic.strokeColor = color('#62503f');
    graphic.circle(0, 0, size / 2);
    graphic.stroke();
    if (!avatarUrl) return;
    assetManager.loadRemote<ImageAsset>(avatarUrl, (error, imageAsset) => {
      if (error || !imageAsset || !avatar.isValid) return;
      const image = createNode('AvatarImage', avatar, size, size);
      const texture = new Texture2D();
      texture.image = imageAsset;
      const frame = new SpriteFrame();
      frame.texture = texture;
      const sprite = image.addComponent(Sprite);
      sprite.sizeMode = Sprite.SizeMode.CUSTOM;
      sprite.spriteFrame = frame;
    });
  }

  private openDetail(item: ReceiveRankingItem): void {
    this.selected = item;
    this.detailVisible = 20;
    this.overlay.active = true;
    this.renderDetail();
    this.overlayScroll.scrollToTop(0);
  }

  private closeDetail(): void {
    this.overlay.active = false;
    this.selected = null;
  }

  private renderDetail(): void {
    if (!this.selected) return;
    for (const child of [...this.overlayContent.children]) child.destroy();
    for (const child of [...this.overlayPanel.children]) {
      if (child !== this.overlayViewport) child.destroy();
    }
    const panelHeight = this.overlayPanel.getComponent(UITransform)!.height;
    this.avatar(this.overlayPanel, this.selected.displayNickname,
      this.selected.avatarUrl, -274, panelHeight / 2 - 78, 82);
    this.label(this.overlayPanel, 'DetailTitle',
      `${this.selected.displayNickname}给你递过 ${this.selected.count} 根`,
      8, panelHeight / 2 - 59, 458, 68, 31, '#ebe2d5').isBold = true;
    this.label(this.overlayPanel, 'DetailNote',
      '头像和昵称采用最近一次领取快照', 8,
      panelHeight / 2 - 114, 458, 42, 22, '#9a948c');
    const close = createRect('DetailClose', this.overlayPanel, 88, 88,
      '#202222', 276, panelHeight / 2 - 76, 6, '#4b4a47');
    close.addComponent(Button).transition = Button.Transition.NONE;
    createLabel('Text', close, '关闭', 21, '#b9b1a7', 80, 70);
    close.on(Button.EventType.CLICK, () => this.closeDetail());
    createRect('DetailHeadingRule', this.overlayPanel, 642, 2,
      '#343637', 0, panelHeight / 2 - 154);
    const events = this.selected.events.slice(0, this.detailVisible);
    const bodyHeight = Math.max(this.overlayViewport.getComponent(UITransform)!.height,
      events.length * 112 + (this.selected.events.length > events.length ? 88 : 0));
    this.overlayContent.getComponent(UITransform)!.setContentSize(642, bodyHeight);
    let cursor = bodyHeight / 2;
    for (const [index, event] of events.entries()) {
      this.label(this.overlayContent, `DetailDate${index}`,
        calendarDate(event.receivedAt), -145, cursor - 36,
        350, 46, 25, '#ddd4c8');
      this.label(this.overlayContent, `DetailNickname${index}`,
        `当时叫“${event.nicknameSnapshot}”`, -145, cursor - 80,
        350, 38, 22, '#969087');
      this.label(this.overlayContent, `DetailStatus${index}`,
        receivedGiftStatus(event), 241, cursor - 56,
        150, 66, 22, '#cfa173', HorizontalTextAlignment.RIGHT);
      cursor -= 112;
      createRect(`DetailRule${index}`, this.overlayContent, 642, 2,
        '#303233', 0, cursor);
    }
    if (this.selected.events.length > events.length) {
      const more = createRect('MoreDetail', this.overlayContent, 620, 78,
        '#202222', 0, cursor - 49, 6, '#4b4a47');
      more.addComponent(Button).transition = Button.Transition.NONE;
      createLabel('Text', more, '查看更多记录', 24, '#d9d1c5', 590, 66);
      more.on(Button.EventType.CLICK, () => { this.detailVisible += 20; this.renderDetail(); });
    }
  }
}
