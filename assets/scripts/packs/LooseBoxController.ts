import { _decorator, assetManager, BlockInputEvents, Component, Graphics, HorizontalTextAlignment,
  ImageAsset, isValid, Label, Mask, Node, screen, ScrollView, Sprite, SpriteFrame, Texture2D,
  UIOpacity, UITransform, Vec2, view } from 'cc';
import { color, createLabel, createNode, createRect } from '../common/UiFactory';
import { UIButton } from '../common/UIButton';
import { CanvasTexture } from '../session/effects/CanvasTexture';
import { createLooseContainer } from './LooseContainerView';
import { emptyLooseBoxSource, LooseBoxSource, LooseCigaretteItem, looseDate, readLooseBox } from './LooseBoxModel';

const { ccclass } = _decorator;
const BG = '#101214';
type BusinessResult = boolean | Promise<boolean>;
export interface LooseBoxActions {
  onBack(): void;
  onHome(): void;
  onRanking(): void;
  onUpgradeAd?: (nextLevel: number | null) => BusinessResult;
  onSmoke?: (id?: string) => BusinessResult;
  onDiscard?: (id: string) => BusinessResult;
}

/** Complete UI paths; social receipt, ad grants and session transactions stay behind adapters. */
@ccclass('LooseBoxController')
export class LooseBoxController extends Component {
  private source: LooseBoxSource = emptyLooseBoxSource;
  private actions!: LooseBoxActions;
  private state = readLooseBox(emptyLooseBoxSource);
  private page!: Node;
  private background!: Node;
  private nav!: Node;
  private viewport!: Node;
  private content!: Node;
  private scroll!: ScrollView;
  private overlay!: Node;
  private badgeOverlay!: Node;
  private detailScroll: ScrollView | null = null;
  private materials: CanvasTexture[] = [];
  private detailMaterials: CanvasTexture[] = [];
  private selectedId: string | null = null;
  private discardConfirm = false;
  private badgeOpen = false;
  private busy = false;
  private epoch = 0;
  private disposed = false;
  private layoutKey = '';
  private unit = 1;
  private narrow = false;
  private slide: 'in' | 'out' | null = null;
  private slideTime = 0;
  private covered = false;
  private readonly avatarCache = new Map<string, { image: ImageAsset; texture: Texture2D; frame: SpriteFrame }>();
  private readonly avatarTargets = new Map<string, Set<Sprite>>();
  private readonly pendingAvatars = new Set<string>();

  public get modalOpen(): boolean { return this.selectedId !== null || this.badgeOpen; }
  public setSource(source: LooseBoxSource): void {
    this.source = source;
    if (this.node.active && this.page) this.refresh();
  }

  public initialize(actions: LooseBoxActions, source: LooseBoxSource = emptyLooseBoxSource): void {
    this.actions = actions; this.source = source;
    this.node.addComponent(BlockInputEvents);
    this.page = createNode('LooseBoxPage', this.node, 941, 1672);
    this.background = createRect('Background', this.page, 941, 1672, BG);
    this.viewport = createNode('Viewport', this.page, 941, 1500);
    this.viewport.addComponent(Mask);
    this.scroll = this.viewport.addComponent(ScrollView);
    this.scroll.horizontal = false; this.scroll.vertical = true;
    this.scroll.elastic = false; this.scroll.cancelInnerEvents = true;
    this.content = createNode('Content', this.viewport, 941, 1);
    this.content.getComponent(UITransform)!.setAnchorPoint(.5, 1); this.scroll.content = this.content;
    this.nav = createNode('Navigation', this.page, 941, 100);
    this.overlay = createNode('DetailOverlay', this.page, 941, 1672);
    this.overlay.addComponent(BlockInputEvents); this.overlay.active = false;
    this.badgeOverlay = createNode('BadgeOverlay', this.page, 941, 1672);
    this.badgeOverlay.addComponent(BlockInputEvents); this.badgeOverlay.active = false;
    this.node.active = false;
  }

  public present(): void {
    this.covered = false;
    this.epoch++; this.busy = false; this.closeDetail(); this.node.active = true;
    this.state = readLooseBox(this.source); this.layoutKey = ''; this.resize();
    this.scroll.stopAutoScroll(); this.scroll.scrollToTop(0);
    this.page.setPosition(view.getVisibleSize().width, 0); this.slide = 'in'; this.slideTime = 0;
  }
  public dismiss(): void {
    this.covered = false;
    this.epoch++; this.busy = false; this.slide = null; this.closeDetail(); this.node.active = false;
  }
  public suspend(keepVisible = false): void {
    this.epoch++; this.busy = false; this.slide = null; this.covered = true;
    this.scroll.stopAutoScroll(); this.scroll.enabled = false; this.node.active = keepVisible;
  }
  public resume(): void {
    this.covered = false; this.scroll.enabled = !this.modalOpen;
    this.node.active = true; this.page.setPosition(0, 0); this.resize();
  }

  protected update(dt: number): void {
    if (this.covered) return;
    this.resize();
    if (!this.slide) return;
    this.slideTime = Math.min(.3, this.slideTime + Math.max(0, dt));
    const p = this.slideTime / .3, eased = 1 - (1 - p) ** 3;
    this.page.setPosition(view.getVisibleSize().width * (this.slide === 'in' ? 1 - eased : eased), 0);
    if (p >= 1) { const leaving = this.slide === 'out'; this.slide = null;
      if (leaving) { this.dismiss(); this.actions.onBack(); } }
  }
  private close(): void {
    if (this.slide || this.busy || this.covered) return;
    if (this.badgeOpen) { this.closeBadge(); return; }
    if (this.selectedId) { this.closeDetail(); return; }
    this.slide = 'out'; this.slideTime = 0;
  }
  private refresh(): void {
    const offset = this.scroll.getScrollOffset();
    this.state = readLooseBox(this.source);
    if (this.selectedId && !this.selected()) this.closeDetail();
    this.layoutKey = ''; this.resize();
    this.scroll.scrollToOffset(new Vec2(0, offset.y), 0);
  }
  private selected(): LooseCigaretteItem | undefined { return this.state.items.find(item => item.id === this.selectedId); }
  private clear(node: Node): void { for (const child of [...node.children]) { child.removeFromParent(); child.destroy(); } }
  private release(list: CanvasTexture[]): void { for (const material of list) material.dispose(); list.length = 0; }

  private text(parent: Node, name: string, copy: string, font: number, width: number,
    left: number, top: number, ink = '#aaa39a', bold = false): number {
    const label = createLabel(name, parent, copy, font, ink, width, font * 1.6);
    label.isBold = bold; label.lineHeight = font * 1.6;
    label.horizontalAlign = HorizontalTextAlignment.LEFT;
    label.overflow = Label.Overflow.RESIZE_HEIGHT; label.updateRenderData(true);
    const height = label.node.getComponent(UITransform)!.height;
    label.node.setPosition(left + width / 2, -top - height / 2);
    return height;
  }
  private centered(parent: Node, name: string, copy: string, font: number, width: number,
    height: number, x: number, y: number, ink = '#d9d1c5', bold = false): Label {
    const label = createLabel(name, parent, copy, font, ink, width, height, x, y); label.isBold = bold; return label;
  }
  private bind(node: Node, callback: () => void): void {
    const button = UIButton.bind(node, () => { if (!this.slide && !this.busy && !this.covered) callback(); });
    const size = node.getComponent(UITransform)!;
    const pressed = createNode('Pressed', node, size.width, size.height);
    const g = pressed.addComponent(Graphics); g.fillColor = color('#ffffff', 14);
    g.rect(-size.width / 2, -size.height / 2, size.width, size.height); g.fill(); pressed.active = false;
    node.on(Node.EventType.TOUCH_START, () => { pressed.active = button.interactable; });
    const release = (): void => { pressed.active = false; };
    node.on(Node.EventType.TOUCH_END, release); node.on(Node.EventType.TOUCH_CANCEL, release);
  }
  private button(parent: Node, name: string, copy: string, width: number, height: number,
    x: number, y: number, action: () => void, fill = '#202222', border = '#4b4a47', ink = '#c9c0b4', font = 25): Node {
    const button = createRect(name, parent, width, height, fill, x, y, 8, border);
    this.centered(button, 'Text', copy, font, width - 24, height - 12, 0, 0, ink);
    this.bind(button, action); return button;
  }

  private resize(): void {
    const size = view.getVisibleSize();
    this.narrow = (screen.windowSize.width / (screen.devicePixelRatio || 1) || 375) <= 340;
    const key = `${size.width}:${size.height}:${this.narrow}`;
    if (key === this.layoutKey) return;
    this.layoutKey = key; this.unit = size.width / 750;
    for (const node of [this.page, this.overlay, this.badgeOverlay]) {
      node.getComponent(UITransform)!.setContentSize(size.width, size.height);
    }
    const g = this.background.getComponent(Graphics)!; g.clear(); g.fillColor = color(BG);
    g.rect(-size.width / 2, -size.height / 2, size.width, size.height); g.fill();
    this.background.getComponent(UITransform)!.setContentSize(size.width, size.height);
    const navHeight = 88 * this.unit;
    this.clear(this.nav); this.nav.setPosition(0, size.height / 2 - navHeight / 2);
    createRect('NavBackground', this.nav, size.width, navHeight, BG);
    const back = createNode('Back', this.nav, navHeight, navHeight, -size.width / 2 + navHeight / 2);
    this.centered(back, 'Arrow', '‹', 60 * this.unit, navHeight, navHeight, 0, 0); this.bind(back, () => this.close());
    this.centered(this.nav, 'Title', '散烟盒', 34 * this.unit, 350 * this.unit, navHeight, 0, 0);
    const height = Math.max(1, size.height - navHeight);
    this.viewport.getComponent(UITransform)!.setContentSize(size.width, height);
    this.viewport.setPosition(0, -navHeight / 2);
    this.buildBody(height);
    if (this.selectedId) this.buildDetail();
    if (this.badgeOpen) this.buildBadge();
  }

  private buildBody(viewportHeight: number): void {
    this.release(this.materials); this.clear(this.content);
    const shell = createNode('LoosePage', this.content, 750, 1); shell.setScale(this.unit, this.unit, 1);
    const width = 750 - (this.narrow ? 48 : 68), left = -width / 2;
    const rank = createNode('RankingLink', shell, 210, 88, width / 2 - 105, -68);
    this.centered(rank, 'Text', '我的收烟榜', 24, 200, 84, 0, 0, '#b2aaa0');
    createRect('LinkRule', rank, 172, 2, '#5c4939', 0, -32);
    this.bind(rank, () => this.actions.onRanking());
    createRect('ToolbarRule', shell, width, 2, '#363839', 0, -112);
    let top = 164;
    top += this.text(shell, 'Heading', '散烟盒', 54, width, left, top, '#eee6da', true) + 17;
    top += this.text(shell, 'Copy', '朋友递来的每根烟都会保留来源。抽散烟不会减少当前烟盒，也不会触发整盒结算。',
      24, Math.min(640, width), left, top) + 40;
    const cardHeight = this.narrow ? 466 : 280;
    const full = this.state.known && this.state.count === this.state.capacity;
    const card = createRect('ContainerCard', shell, width, cardHeight, '#191b1b', 0, -top - cardHeight / 2, 10, full ? '#7b563c' : '#5a5146');
    const visualW = 280, visualH = this.narrow ? 190 : 220;
    const visual = createNode('ContainerVisual', card, visualW, visualH,
      this.narrow ? 0 : -width / 2 + 170, this.narrow ? cardHeight / 2 - 24 - visualH / 2 : 0);
    this.materials.push(createLooseContainer(visual, visualW, visualH, this.state.tier.level, this.state.items));
    const copyWidth = this.narrow ? width - 48 : width - 368;
    const copy = createNode('ContainerCopy', card, copyWidth, 220,
      this.narrow ? 0 : -width / 2 + 338 + copyWidth / 2, this.narrow ? -109 : 0);
    this.centered(copy, 'Name', '散烟盒', this.narrow ? 30 : 34, copyWidth, 48, 0, 81, '#e9e0d3', true);
    const count = this.state.count === null ? '—' : String(this.state.count);
    const capacity = this.state.capacity === null ? '—' : String(this.state.capacity);
    this.centered(copy, 'Count', count, 54, 94, 70, -copyWidth / 2 + 47, 15, '#dfb176');
    this.centered(copy, 'Capacity', `/ ${capacity}根`, 24, 110, 48, -copyWidth / 2 + 149, 7, '#9c958c');
    if (full) this.centered(copy, 'Full', '已满', 24, 80, 42, copyWidth / 2 - 40, 7, '#d27d49');
    this.centered(copy, 'UpgradeNote', this.state.maxLevel ? '散烟盒已是最大容量' : '每看完一次广告升一级 · 最高 20 根',
      24, copyWidth, 88, 0, -69, '#c6b498');
    top += cardHeight;
    if (!this.state.maxLevel) {
      top += 32;
      this.button(shell, 'UpgradeAd', `看广告升级至 ${this.state.nextTier?.capacity ?? '—'} 根`, width, 88, 0, -top - 44,
        () => { void this.runBusiness(() => this.actions.onUpgradeAd?.(this.state.nextTier?.level ?? null)); },
        '#33261c', '#87623f', '#f3dab8', 26);
      top += 88;
    }
    if (this.state.items.length) {
      top += 28;
      const random = createRect('RandomSmoke', shell, width, 112, '#251d18', 0, -top - 56, 9, '#79583d');
      const mark = createNode('RandomMark', random, 34, 34, -width / 2 + 50).addComponent(Graphics);
      mark.strokeColor = color('#d18248'); mark.lineWidth = 3;
      mark.moveTo(0, 22); mark.lineTo(22, 0); mark.lineTo(0, -22); mark.lineTo(-22, 0); mark.close(); mark.stroke();
      this.centered(random, 'Title', '随机取烟', 28, width - 120, 42, 38, 19, '#e8dfd2', true);
      this.centered(random, 'Note', '战列舰赠烟整组抽5根', 24, width - 120, 40, 38, -23, '#aa998a');
      this.bind(random, () => { void this.runBusiness(() => this.actions.onSmoke?.()); }); top += 142;
      createRect('ListRule', shell, width, 2, '#353637', 0, -top);
      for (const item of this.state.items) { this.buildRow(shell, item, width, top); top += 152; }
    } else {
      top += 60; createRect('EmptyTop', shell, width, 2, '#3b3d3e', 0, -top); top += 58;
      const emptyTitle = this.centered(shell, 'EmptyTitle', '还没有朋友递来的烟', 34, width - 72, 54, 0, -top - 27, '#ded6ca', true);
      top += emptyTitle.node.getComponent(UITransform)!.height + 15;
      top += this.text(shell, 'EmptyCopy', '朋友通过派烟卡递给你的烟，选择“存入散烟盒”后，就会出现在这里。',
        24, Math.min(560, width - 72), -Math.min(560, width - 72) / 2, top, '#a39b92') + 34;
      this.button(shell, 'GoHome', '回到首页', 280, 92, 0, -top - 46, () => this.actions.onHome(), '#1c1e1e', '#514d48');
      top += 150; createRect('EmptyBottom', shell, width, 2, '#3b3d3e', 0, -top);
    }
    top += 54;
    this.centered(shell, 'LocalNote', '散烟只保存在本机，清除或卸载后无法找回。', 24, width, 78, 0, -top - 39, '#8f8981');
    const height = Math.max(viewportHeight, (top + 132) * this.unit);
    this.content.getComponent(UITransform)!.setContentSize(view.getVisibleSize().width, height);
    this.content.setPosition(0, viewportHeight / 2);
  }

  private buildRow(parent: Node, item: LooseCigaretteItem, width: number, top: number): void {
    const actionW = this.narrow ? 112 : 132;
    const mainW = width - actionW;
    const row = createNode(`Loose-${item.id}`, parent, width, 152, 0, -top - 76);
    createRect('Rule', row, width, 2, '#303233', 0, -76);
    const main = createNode('Main', row, mainW, 150, -actionW / 2);
    this.avatar(main, item, -mainW / 2 + 42, 0, 64);
    const nameW = mainW - 104;
    const name = this.centered(main, 'Sender', item.senderName.trim() || '一位烟友', 28, nameW, 40, 44, 40, '#eee5d8', true);
    name.horizontalAlign = HorizontalTextAlignment.LEFT;
    const date = this.centered(main, 'Date', `${looseDate(item.receivedAt)}递来${item.quantity}根${item.themeName ? ' · ' + item.themeName : ''}`,
      24, nameW, 38, 44, -2, '#9b948c'); date.horizontalAlign = HorizontalTextAlignment.LEFT;
    const effects = this.centered(main, 'Effects', `锁定特效 · ${item.effectSummary || '—'}`, 24, nameW, 38, 44, -40, '#b98a63');
    effects.horizontalAlign = HorizontalTextAlignment.LEFT;
    this.bind(main, () => this.openDetail(item.id));
    const action = createNode('SmokeSpecific', row, actionW, 142, width / 2 - actionW / 2);
    createRect('ActionRule', action, 2, 92, '#3a3b3a', -actionW / 2);
    this.stick(action, item, 0, 21, this.materials);
    this.centered(action, 'Text', item.quantity === 5 ? '抽这5根' : '抽这根', 24, actionW - 12, 40, 0, -50, '#d99a61');
    this.bind(action, () => { void this.runBusiness(() => this.actions.onSmoke?.(item.id)); });
  }

  public openDetail(id: string): void {
    if (this.busy || this.slide || this.covered || !this.state.items.some(item => item.id === id)) return;
    this.selectedId = id; this.discardConfirm = false; this.overlay.active = true;
    this.scroll.enabled = false; this.buildDetail();
  }
  private closeDetail(): void {
    this.closeBadge(); this.selectedId = null; this.discardConfirm = false;
    if (this.overlay) { this.overlay.active = false; this.clear(this.overlay); }
    this.detailScroll = null; this.release(this.detailMaterials);
    if (this.scroll) this.scroll.enabled = !this.covered;
  }

  private buildDetail(): void {
    const item = this.selected(); if (!item) { this.closeDetail(); return; }
    const oldOffset = this.detailScroll?.getScrollOffset().y ?? 0;
    this.release(this.detailMaterials); this.clear(this.overlay);
    const size = view.getVisibleSize(), localH = size.height / this.unit;
    const shade = createRect('Shade', this.overlay, size.width, size.height, '#040506'); shade.addComponent(UIOpacity).opacity = 219;
    const stage = createNode('DetailStage', this.overlay, 750, localH); stage.setScale(this.unit, this.unit, 1);
    const panelH = Math.min(localH * .72, 1120), width = 702;
    const panel = createRect('DetailPanel', stage, width, panelH, '#181a1a', 0, -localH / 2 + 30 + panelH / 2, 14, '#4d4944');
    const shell = createNode('DetailShell', panel, width, panelH, 0, panelH / 2);
    this.text(shell, 'Title', '散烟详情', 31, width - 210, -width / 2 + 30, 36, '#ebe2d5', true);
    this.button(shell, 'CloseDetail', '关闭', 96, 88, width / 2 - 78, -80, () => { if (!this.badgeOpen) this.closeDetail(); });
    createRect('HeadingRule', shell, width - 60, 2, '#343637', 0, -150);
    const footerH = this.discardConfirm ? (localH < 1360 ? 216 : 330) : 152;
    const viewportH = Math.max(60, panelH - 178 - footerH);
    const viewport = createNode('DetailViewport', shell, width - 60, viewportH, 0, -164 - viewportH / 2);
    viewport.addComponent(Mask);
    this.detailScroll = viewport.addComponent(ScrollView);
    this.detailScroll.horizontal = false; this.detailScroll.vertical = true; this.detailScroll.elastic = false;
    const body = createNode('DetailBody', viewport, width - 60, 1);
    body.getComponent(UITransform)!.setAnchorPoint(.5, 1); this.detailScroll.content = body;
    const innerW = width - 60, left = -innerW / 2;
    this.avatar(body, item, left + 40, -72, 80);
    let top = 32;
    top += this.text(body, 'Sender', item.senderName.trim() || '一位烟友', 32, innerW - 112, left + 112, top, '#eee5d8', true) + 8;
    top += this.text(body, 'ReceivedAt', `${looseDate(item.receivedAt, true)} 接收`, 24, innerW - 112, left + 112, top, '#b7ada0') + 8;
    if (item.themeName) top += this.text(body, 'Theme', `来自「${item.themeName}」烟盒`, 24, innerW - 112, left + 112, top, '#b7ada0') + 8;
    if (item.badge) {
      const badge = this.button(body, 'BadgeInfo', item.badge.title, 200, 52, left + 212, -top - 26,
        () => this.openBadge(), '#28211b', '#876542', '#d8c08a', 24); badge.name = 'BadgeInfo'; top += 68;
    }
    top = Math.max(top, 145) + 24;
    const appearanceH = item.quantity === 5 ? 168 : 154;
    const appearance = createRect('Appearance', body, innerW, appearanceH, '#131515', 0, -top - appearanceH / 2, 8, '#393b3b');
    this.stick(appearance, item, -innerW / 2 + 47, 0, this.detailMaterials);
    this.centered(appearance, 'Title', item.filterVariant === 'shadowless' ? '无影烟 · 烟身透明' : '保留递来时的烟嘴配色',
      24, innerW - 120, 50, 42, 36, '#d9c5ae', true);
    this.centered(appearance, 'Copy', item.quantity === 5 ? '五根为一组，占用5根容量，取用时整组抽出。'
      : '指定抽或随机抽中后，会沿用这根烟自己的外观。', 24, innerW - 120, 78, 42, -29, '#918a82');
    top += appearanceH + 18;
    const rows = ['烟灰', '余烟', '形状', '烟圈色', '吐雾', '呼出', '烟量', '环境'];
    const effect = createRect('EffectPanel', body, innerW, 412, '#1e1916', 0, -top - 206, 8, '#714d31');
    this.centered(effect, 'Heading', '好友分享配置', 24, 260, 40, -innerW / 2 + 150, 170, '#d37a3d', true);
    this.centered(effect, 'Lock', '特效锁定', 24, 180, 40, innerW / 2 - 110, 170, '#948a80');
    this.centered(effect, 'Copy', '烟灰烟雾不可修改，环境可更换', 24, innerW - 40, 50, 0, 119, '#e0d3c1');
    this.centered(effect, 'Fun', `趣味体验：${item.funText || '—'}`, 24, innerW - 40, 50, 0, 68, '#e0d3c1');
    rows.forEach((label, index) => {
      const value = label === '环境' ? item.environmentName : item.effects?.find(entry => entry.label === label)?.value;
      const colW = (innerW - 58) / 2, col = index % 2, row = Math.floor(index / 2);
      const cx = -innerW / 2 + 20 + colW / 2 + col * (colW + 18), y = 5 - row * 51;
      this.centered(effect, `Label-${label}`, label, 24, colW * .38, 42, cx - colW * .30, y, '#918980');
      this.centered(effect, `Value-${label}`, value || '—', 24, colW * .60, 42, cx + colW * .20, y, '#c8bcae');
      createRect(`Rule-${label}`, effect, colW, 1, '#35302b', cx, y - 24);
    });
    top += 440;
    body.getComponent(UITransform)!.setContentSize(innerW, Math.max(top, viewportH)); body.setPosition(0, viewportH / 2);
    this.detailScroll.scrollToOffset(new Vec2(0, oldOffset), 0);
    const footer = createNode('DetailActions', shell, innerW, footerH, 0, -panelH + footerH / 2 + 16);
    createRect('Rule', footer, innerW, 2, '#343637', 0, footerH / 2);
    if (!this.discardConfirm) {
      const buttonW = (innerW - 16) / 2;
      this.button(footer, 'SmokeSelected', item.quantity === 5 ? '抽这5根' : '抽这根', buttonW, 96, -(buttonW + 16) / 2, -5,
        () => { void this.runBusiness(() => this.actions.onSmoke?.(item.id), true); }, '#d97a39', '#b56635', '#160d07');
      this.button(footer, 'RequestDiscard', item.quantity === 5 ? '丢掉这5根' : '丢掉这根', buttonW, 96, (buttonW + 16) / 2, -5,
        () => { this.discardConfirm = true; this.buildDetail(); }, '#251b1a', '#6e4b44', '#d9b0a7');
    } else {
      this.centered(footer, 'DiscardCopy', '丢掉后不会进入抽烟记录，也无法恢复。', 24, innerW, 72, 0, footerH / 2 - 46, '#d2bbb5');
      if (localH < 1360) {
        const bw = (innerW - 24) / 2;
        this.button(footer, 'ConfirmDiscard', '确认丢掉', bw, 96, -(bw + 24) / 2, -42,
          () => { void this.runBusiness(() => this.actions.onDiscard?.(item.id), true); }, '#42241f', '#86534a', '#f0d2ca');
        this.button(footer, 'Keep', '继续留着', bw, 96, (bw + 24) / 2, -42, () => { this.discardConfirm = false; this.buildDetail(); });
      } else {
        this.button(footer, 'ConfirmDiscard', '确认丢掉', innerW, 96, 0, 3,
          () => { void this.runBusiness(() => this.actions.onDiscard?.(item.id), true); }, '#42241f', '#86534a', '#f0d2ca');
        this.button(footer, 'Keep', '继续留着', innerW, 96, 0, -107, () => { this.discardConfirm = false; this.buildDetail(); });
      }
    }
  }

  private openBadge(): void { if (!this.selected()?.badge) return; this.badgeOpen = true; this.buildBadge(); }
  private closeBadge(): void { this.badgeOpen = false; if (this.badgeOverlay) { this.badgeOverlay.active = false; this.clear(this.badgeOverlay); }
    if (this.detailScroll) this.detailScroll.enabled = true; }
  private buildBadge(): void {
    const badge = this.selected()?.badge; if (!badge) { this.closeBadge(); return; }
    this.clear(this.badgeOverlay); this.badgeOverlay.active = true;
    if (this.detailScroll) this.detailScroll.enabled = false;
    const size = view.getVisibleSize();
    const shade = createRect('Shade', this.badgeOverlay, size.width, size.height, '#040506'); shade.addComponent(UIOpacity).opacity = 219;
    const stage = createNode('BadgeStage', this.badgeOverlay, 750, size.height / this.unit); stage.setScale(this.unit, this.unit, 1);
    const panel = createRect('BadgePanel', stage, 620, 420, '#211b15', 0, 0, 16, '#8e744e');
    this.centered(panel, 'Title', badge.title, 34, 550, 70, 0, 128, '#e5cc9d', true);
    this.centered(panel, 'Description', badge.description, 26, 540, 150, 0, 12, '#c4b69e');
    this.button(panel, 'CloseBadge', '知道了', 300, 88, 0, -140, () => this.closeBadge(), '#493323', '#8e744e', '#e5cc9d');
  }

  private async runBusiness(action: () => BusinessResult | undefined, closeOnSuccess = false): Promise<void> {
    if (this.busy || this.slide || this.badgeOpen || this.covered) return;
    const epoch = this.epoch; this.busy = true;
    try {
      const accepted = await action();
      if (this.disposed || epoch !== this.epoch || !this.node.active) return;
      if (accepted === true) { if (closeOnSuccess) this.closeDetail(); this.refresh(); }
    } catch (error) { console.warn('[LooseBox] action failed', error); }
    finally { if (epoch === this.epoch) this.busy = false; }
  }

  private stick(parent: Node, item: LooseCigaretteItem, x: number, y: number, materials: CanvasTexture[]): void {
    if (item.filterVariant === 'shadowless') return;
    const material = new CanvasTexture('GiftCigarette', parent, 34, 94); materials.push(material); material.node.setPosition(x, y);
    material.redraw((ctx) => {
      const paper = ctx.createLinearGradient(-17, 0, 17, 0);
      paper.addColorStop(0, '#c7c0b6'); paper.addColorStop(.36, '#e7e1d6'); paper.addColorStop(1, '#f8f4ec');
      ctx.fillStyle = paper; ctx.fillRect(-17, -10, 34, 57);
      ctx.fillStyle = item.filterBand || '#5f3824'; ctx.fillRect(-17, -14, 34, 4);
      ctx.fillStyle = item.filterBase || '#ac7b50'; ctx.fillRect(-17, -47, 34, 33);
      const shine = ctx.createLinearGradient(-17, 0, 17, 0); shine.addColorStop(0, 'rgba(8,10,11,.28)');
      shine.addColorStop(.32, 'rgba(255,255,255,0)'); shine.addColorStop(.65, 'rgba(255,255,255,.22)'); shine.addColorStop(1, 'rgba(8,10,11,.18)');
      ctx.fillStyle = shine; ctx.fillRect(-17, -47, 34, 33);
      ctx.strokeStyle = item.filterInk || '#f0c27a'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-6, -28); ctx.lineTo(6, -28); ctx.stroke();
    });
  }

  private avatar(parent: Node, item: LooseCigaretteItem, x: number, y: number, size: number): void {
    const root = createNode('Avatar', parent, size, size, x, y);
    const mask = root.addComponent(Mask); mask.type = Mask.Type.GRAPHICS_STENCIL;
    const stencil = mask.subComp as Graphics; stencil.circle(0, 0, size / 2); stencil.fill();
    createRect('Background', root, size, size, '#25282a');
    const sprite = createNode('Image', root, size, size).addComponent(Sprite); sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    const url = item.avatarUrl; if (!url) return;
    const cached = this.avatarCache.get(url); if (cached) { sprite.spriteFrame = cached.frame; return; }
    const targets = this.avatarTargets.get(url) ?? new Set<Sprite>();
    for (const target of targets) if (!isValid(target, true)) targets.delete(target);
    targets.add(sprite); this.avatarTargets.set(url, targets);
    if (this.pendingAvatars.has(url)) return; this.pendingAvatars.add(url);
    assetManager.loadRemote<ImageAsset>(url, (error, image) => {
      this.pendingAvatars.delete(url);
      if (error || !image || this.disposed || !isValid(this, true)) return;
      image.addRef(); const texture = new Texture2D(); texture.image = image;
      const frame = new SpriteFrame(); frame.texture = texture;
      this.avatarCache.set(url, { image, texture, frame });
      for (const target of this.avatarTargets.get(url) ?? []) if (isValid(target, true)) target.spriteFrame = frame;
      this.avatarTargets.delete(url);
    });
  }

  protected onDestroy(): void {
    this.disposed = true; this.epoch++; this.release(this.materials); this.release(this.detailMaterials);
    for (const resource of this.avatarCache.values()) { resource.frame.destroy(); resource.texture.destroy(); resource.image.decRef(); }
    this.avatarCache.clear(); this.avatarTargets.clear();
  }
}
