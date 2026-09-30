import { _decorator, BlockInputEvents, Button, Component, EditBox, EventTouch, Graphics,
  HorizontalTextAlignment, Label, Mask, Node, ScrollView, UITransform,
  VerticalTextAlignment, view } from 'cc';
import { color, createLabel, createNode, createRect, DESIGN_HEIGHT, DESIGN_WIDTH } from '../common/UiFactory';
import { QuitSnapshot, QuitStore } from '../persistence/QuitStore';
import { QuitJournalController } from './QuitJournalController';
import { QuitTrendController } from './QuitTrendController';

const { ccclass } = _decorator;
type Tab = 'smoke' | 'quit';
type HoldAction = 'smoke' | 'quit';
type QuitPalette = { bg: string; surface: string; fg: string; muted: string;
  rule: string; button: string; ink: string };
const DARK: QuitPalette = { bg: '#101213', surface: '#1b1d1e', fg: '#f5f4f0',
  muted: '#b6b8ba', rule: '#36393b', button: '#f5f4f0', ink: '#101213' };
const LIGHT: QuitPalette = { bg: '#f5f4f0', surface: '#eae9e5', fg: '#161819',
  muted: '#606467', rule: '#c9cbcc', button: '#161819', ink: '#f5f4f0' };

@ccclass('QuitController')
export class QuitController extends Component {
  private pageRoot!: Node;
  private background!: Node;
  private navBackground!: Node;
  private tabBackground!: Node;
  private navTitle!: Label;
  private navBack!: Label;
  private navRoot!: Node;
  private viewport!: Node;
  private scroll!: ScrollView;
  private content!: Node;
  private section!: Node;
  private tabs!: Node;
  private notice!: Label;
  private overlay!: Node;
  private overlayCard!: Node;
  private overlayTitle!: Label;
  private overlayBody!: Label;
  private overlayConfirm!: Label;
  private detailOverlay!: Node;
  private detailTitle!: Label;
  private detailBody!: Label;
  private toastRoot!: Node;
  private toastTitle!: Label;
  private toastBody!: Label;
  private toastVersion = 0;
  private journal!: QuitJournalController;
  private trendPage!: QuitTrendController;
  private priceInput: EditBox | null = null;
  private sticksInput: EditBox | null = null;
  private feelingInput: EditBox | null = null;
  private priceOpen = false;
  private priceDraft = '';
  private sticksDraft = '20';
  private priceError = '';
  private slide: 'in' | 'out' | null = null;
  private slideTime = 0;
  private viewportHeight = 0;
  private tab: Tab = 'smoke';
  private light = false;
  private selected = false;
  private feeling = '';
  private hold: HoldAction | null = null;
  private holdTime = 0;
  private holdDay = '';
  private holdStartX = 0;
  private holdStartY = 0;
  private holdOriginalText = '';
  private holdOriginalSubtitle = '';
  private allowedQuitDay = '';
  private allowedQuitAt: number | null = null;
  private holdLabel: Label | null = null;
  private holdSubtitle: Label | null = null;
  private smokeStatusLabel: Label | null = null;
  private pending: (() => void) | null = null;
  private store!: QuitStore;
  private onBack: (() => void) | null = null;
  private static readonly SLIDE_SECONDS = 0.3;
  private static readonly HOLD_SECONDS = 3;

  public initialize(store: QuitStore, onBack: () => void): void {
    this.store = store;
    this.onBack = onBack;
    this.build();
  }

  public present(): void {
    const snapshot = this.store.readSnapshot();
    this.light = snapshot?.light ?? false;
    this.tab = 'smoke';
    this.realVisible = 20;
    this.priceOpen = false;
    this.priceError = '';
    this.selected = snapshot?.confirmed ?? false;
    this.feeling = snapshot?.feeling ?? '';
    this.allowedQuitDay = '';
    this.allowedQuitAt = null;
    this.notice.string = '';
    this.overlay.active = false;
    this.detailOverlay.active = false;
    this.toastRoot.active = false;
    this.journal.dismiss();
    this.trendPage.dismiss();
    this.refresh();
    this.resize();
    this.scroll.scrollToTop(0);
    this.slide = 'in';
    this.slideTime = 0;
    this.pageRoot.setPosition(view.getVisibleSize().width, 0);
  }

  public dismiss(): void {
    this.slide = null;
    this.hold = null;
    this.pending = null;
    this.allowedQuitDay = '';
    this.allowedQuitAt = null;
    this.priceOpen = false;
    this.endWipe();
    if (this.toastRoot) this.toastRoot.active = false;
    this.journal?.dismiss();
    this.trendPage?.dismiss();
    this.pageRoot?.setPosition(0, 0);
  }

  protected update(dt: number): void {
    this.resize();
    if (this.slide) {
      this.slideTime = Math.min(QuitController.SLIDE_SECONDS, this.slideTime + Math.max(0, dt));
      const progress = this.slideTime / QuitController.SLIDE_SECONDS;
      const eased = 1 - (1 - progress) ** 3;
      this.pageRoot.setPosition(view.getVisibleSize().width * (this.slide === 'in' ? 1 - eased : eased), 0);
      if (progress >= 1) {
        const leaving = this.slide === 'out';
        this.slide = null;
        if (leaving) this.onBack?.();
      }
    }
    if (this.hold) {
      this.holdTime += Math.max(0, dt);
      this.paintWipe(this.holdTime / QuitController.HOLD_SECONDS);
      const countdown = this.holdTime < 3
        ? `${Math.max(0, 3 - this.holdTime).toFixed(1)} 秒` : '正在保存';
      if (this.holdLabel) this.holdLabel.string = countdown;
      if (this.wipeHoldLabel) this.wipeHoldLabel.string = countdown;
      if (this.holdTime >= QuitController.HOLD_SECONDS) {
        const action = this.hold;
        this.hold = null;
        if (this.holdLabel?.isValid) this.holdLabel.string = this.holdOriginalText;
        if (this.holdSubtitle?.isValid) this.holdSubtitle.string = this.holdOriginalSubtitle;
        this.holdLabel = null;
        this.holdSubtitle = null;
        if (this.holdDay === this.store.readSnapshot()?.today) this.perform(action);
        else this.notice.string = '日期已变化，请重新长按';
        this.endWipe();
      }
    }
  }

  private resize(): void {
    if (!this.viewport) return;
    // Android's keyboard can change the visible height while EditBox is
    // focused. Rebuilding here destroys its DOM input before Cocos's delayed
    // scrollIntoView callback runs.
    if (this.priceInput?.isFocused() || this.sticksInput?.isFocused()
      || this.feelingInput?.isFocused()) return;
    const height = view.getVisibleSize().height;
    if (height === this.viewportHeight) return;
    const changed = this.viewportHeight > 0;
    this.viewportHeight = height;
    const navHeight = 128;
    const tabsHeight = 128;
    const viewportHeight = Math.max(200, height - navHeight - tabsHeight);
    this.viewport.getComponent(UITransform)?.setContentSize(DESIGN_WIDTH, viewportHeight);
    this.viewport.setPosition(0, -(navHeight + tabsHeight) / 2);
    this.navRoot.setPosition(0, height / 2 - navHeight / 2);
    this.tabs.setPosition(0, height / 2 - navHeight - tabsHeight / 2);
    this.notice.node.setPosition(0, -height / 2 + 38);
    this.overlay.setPosition(0, 0);
    this.overlayCard.setPosition(0, -height / 2 + 208);
    this.detailOverlay.setPosition(0, 0);
    if (changed) this.refresh();
  }

  private build(): void {
    const shield = createNode('QuitInputShield', this.node, DESIGN_WIDTH, 2400);
    shield.addComponent(BlockInputEvents);
    this.pageRoot = createNode('QuitPageRoot', this.node, DESIGN_WIDTH, DESIGN_HEIGHT);
    this.background = createRect('Background', this.pageRoot, DESIGN_WIDTH, 2400, DARK.bg);
    this.viewport = createNode('QuitViewport', this.pageRoot, DESIGN_WIDTH, DESIGN_HEIGHT);
    this.viewport.addComponent(Mask);
    this.scroll = this.viewport.addComponent(ScrollView);
    this.scroll.horizontal = false;
    this.scroll.vertical = true;
    this.scroll.elastic = false;
    this.content = createNode('QuitScrollContent', this.viewport, DESIGN_WIDTH, 1700);
    this.scroll.content = this.content;
    this.section = createNode('QuitSection', this.content, DESIGN_WIDTH, 1700);
    this.navRoot = createNode('QuitNav', this.pageRoot, DESIGN_WIDTH, 128);
    this.navBackground = createRect('NavBackground', this.navRoot, DESIGN_WIDTH, 128, DARK.bg);
    const back = createNode('Back', this.navRoot, 88, 88, -331, -12);
    back.addComponent(Button).transition = Button.Transition.NONE;
    this.navBack = createLabel('BackText', back, '‹', 48, DARK.fg, 80, 78);
    back.on(Button.EventType.CLICK, () => {
      if (!this.slide && !this.overlay.active) { this.slide = 'out'; this.slideTime = 0; }
    });
    this.navTitle = createLabel('NavTitle', this.navRoot, '今日戒烟', 34, DARK.fg, 280, 56, 0, -12);
    this.tabs = createNode('QuitTabs', this.pageRoot, DESIGN_WIDTH, 128);
    this.tabBackground = createRect('TabBackground', this.tabs, DESIGN_WIDTH, 128, DARK.bg);
    this.notice = createLabel('QuitNotice', this.pageRoot, '', 24, '#d8ad76', 680, 58);
    this.overlay = createNode('QuitConfirmOverlay', this.pageRoot, DESIGN_WIDTH, 2400);
    this.overlay.addComponent(BlockInputEvents);
    const dim = createNode('OverlayDim', this.overlay, DESIGN_WIDTH, 2400);
    const dimGraphics = dim.addComponent(Graphics);
    dimGraphics.fillColor = color('#020404', 219);
    dimGraphics.rect(-DESIGN_WIDTH / 2, -1200, DESIGN_WIDTH, 2400);
    dimGraphics.fill();
    dim.addComponent(Button).transition = Button.Transition.NONE;
    dim.on(Button.EventType.CLICK, () => this.closeConfirm());
    this.overlayCard = createRect('ConfirmCard', this.overlay, 680, 360,
      '#171a19', 0, 0, 0, '#cd9158');
    createRect('ConfirmAccent', this.overlayCard, 678, 5, '#d8814c', 0, 177);
    this.overlayTitle = createLabel('ConfirmTitle', this.overlayCard, '', 31,
      '#f3e7d5', 612, 56, 0, 107, HorizontalTextAlignment.LEFT);
    this.overlayTitle.isBold = true;
    this.overlayBody = createLabel('ConfirmBody', this.overlayCard, '', 23,
      '#b8ac9d', 612, 112, 0, 8, HorizontalTextAlignment.LEFT);
    const cancelButton = createRect('CancelConfirm', this.overlayCard, 339, 96,
      '#151818', -169.5, -132);
    cancelButton.addComponent(Button).transition = Button.Transition.NONE;
    createLabel('Text', cancelButton, '取消', 25, '#bdb3a7', 319, 80).isBold = true;
    cancelButton.on(Button.EventType.CLICK, () => this.closeConfirm());
    const confirmButton = createRect('AcceptConfirm', this.overlayCard, 339, 96,
      '#d57843', 169.5, -132);
    confirmButton.addComponent(Button).transition = Button.Transition.NONE;
    createLabel('Text', confirmButton, '继续', 25, '#251208', 319, 80).isBold = true;
    confirmButton.on(Button.EventType.CLICK, () => {
      const callback = this.pending;
      this.closeConfirm();
      callback?.();
    });
    this.overlayConfirm = confirmButton.getChildByName('Text')!.getComponent(Label)!;
    this.overlay.active = false;
    this.detailOverlay = createNode('QuitDetailOverlay', this.pageRoot, DESIGN_WIDTH, 2400);
    this.detailOverlay.addComponent(BlockInputEvents);
    createRect('DetailDim', this.detailOverlay, DESIGN_WIDTH, 2400, '#080908');
    const detailCard = createRect('DetailCard', this.detailOverlay, 670, 930,
      '#232725', 0, 0, 20, '#5b625a');
    this.detailTitle = createLabel('DetailTitle', detailCard, '', 34, '#efe8da', 610, 70, 0, 382);
    this.detailBody = createLabel('DetailBody', detailCard, '', 25, '#ccc5b9', 590, 580,
      0, 38, HorizontalTextAlignment.LEFT);
    this.detailBody.verticalAlign = 0;
    this.button(detailCard, '取消', -158, -386, 280, 78, () => { this.detailOverlay.active = false; });
    this.button(detailCard, '关闭', 158, -386, 280, 78,
      () => { this.detailOverlay.active = false; });
    this.detailOverlay.active = false;
    this.wipeRoot = createNode('RealColorWipe', this.pageRoot, DESIGN_WIDTH, DESIGN_HEIGHT);
    this.wipeMask = this.wipeRoot.addComponent(Mask);
    this.wipeMask.type = Mask.Type.GRAPHICS_STENCIL;
    this.wipeRoot.active = false;
    this.toastRoot = createNode('QuitToast', this.pageRoot, 640, 142);
    createRect('ToastCard', this.toastRoot, 620, 134, '#292d2b', 0, 0, 16, '#676f6b');
    this.toastTitle = createLabel('ToastTitle', this.toastRoot, '', 31,
      '#f5f4f0', 570, 48, 0, 25);
    this.toastTitle.isBold = true;
    this.toastBody = createLabel('ToastBody', this.toastRoot, '', 23,
      '#d5d8d5', 570, 44, 0, -23);
    this.toastRoot.active = false;
    const journalNode = createNode('QuitJournalPage', this.pageRoot,
      DESIGN_WIDTH, DESIGN_HEIGHT);
    this.journal = journalNode.addComponent(QuitJournalController);
    this.journal.initialize(this.store, () => this.refresh(), () => {
      this.switchTab('smoke');
      this.openPrice();
    }, () => this.openTrend());
    const trendNode = createNode('QuitTrendPage', this.pageRoot,
      DESIGN_WIDTH, DESIGN_HEIGHT);
    this.trendPage = trendNode.addComponent(QuitTrendController);
    this.trendPage.initialize(this.store);
  }

  private showToast(title: string, body: string): void {
    this.toastTitle.string = title;
    this.toastBody.string = body;
    this.toastRoot.active = true;
    const version = ++this.toastVersion;
    this.scheduleOnce(() => {
      if (version === this.toastVersion && this.toastRoot.isValid) this.toastRoot.active = false;
    }, 2.4);
  }

  private wipeRoot!: Node;
  private wipeMask!: Mask;
  private wipeContent: Node | null = null;
  private wipeHoldLabel: Label | null = null;
  private wipeHoldSubtitle: Label | null = null;

  private beginWipe(snapshot: QuitSnapshot): void {
    if (!this.wipeRoot) return;
    for (const child of [...this.wipeRoot.children]) child.destroy();
    const height = view.getVisibleSize().height;
    const palette = this.palette(!snapshot.light);
    this.wipeRoot.getComponent(UITransform)!.setContentSize(DESIGN_WIDTH, height);
    this.wipeRoot.active = true;
    createRect('WipeBackground', this.wipeRoot, DESIGN_WIDTH, height, palette.bg);
    const nav = createNode('WipeNav', this.wipeRoot, DESIGN_WIDTH, 128, 0, height / 2 - 64);
    createRect('WipeNavBackground', nav, DESIGN_WIDTH, 128, palette.bg);
    createLabel('WipeBack', nav, '‹', 48, palette.fg, 80, 78, -331, -12);
    createLabel('WipeTitle', nav, '今日戒烟', 34, palette.fg, 280, 56, 0, -12);
    const tabs = createNode('WipeTabs', this.wipeRoot, DESIGN_WIDTH, 128,
      0, height / 2 - 192);
    createRect('WipeTabsBackground', tabs, DESIGN_WIDTH, 128, palette.bg);
    for (const [index, name] of ['今天抽了', '今天未抽'].entries()) {
      const selected = index === (this.tab === 'smoke' ? 0 : 1);
      const tab = createRect(`WipeTab${index}`, tabs, 337, 100,
        selected ? palette.button : palette.bg, index === 0 ? -174.5 : 174.5,
        0, 12, selected ? palette.button : palette.rule);
      createLabel('WipeTabText', tab, name, 32, selected ? palette.ink : palette.muted,
        310, 80).isBold = true;
    }
    const viewportHeight = Math.max(200, height - 256);
    const viewportNode = createNode('WipeViewport', this.wipeRoot, DESIGN_WIDTH,
      viewportHeight, 0, -128);
    viewportNode.addComponent(Mask);
    const contentHeight = this.content.getComponent(UITransform)!.height;
    this.wipeContent = createNode('WipeContent', viewportNode, DESIGN_WIDTH,
      contentHeight, this.content.position.x, this.content.position.y);
    if (this.tab === 'smoke') {
      this.drawSmokeView(snapshot, this.wipeContent, palette, contentHeight, false);
    } else {
      this.drawQuitMirror(snapshot, this.wipeContent, palette, contentHeight);
    }
    const wipeHold = this.wipeContent.getChildByName('HoldAction');
    this.wipeHoldLabel = wipeHold?.getChildByName('HoldText')?.getComponent(Label) ?? null;
    this.wipeHoldSubtitle = wipeHold?.getChildByName('HoldSubtitle')?.getComponent(Label) ?? null;
    if (this.wipeHoldSubtitle) this.wipeHoldSubtitle.string = '松开取消';
    this.paintWipe(0);
  }

  private paintWipe(progress: number): void {
    if (!this.wipeRoot?.active) return;
    const height = view.getVisibleSize().height;
    const revealed = Math.max(0.01, height * Math.min(1, Math.max(0, progress)));
    const graphic = this.wipeMask.subComp as Graphics;
    graphic.clear();
    graphic.fillColor = color('#ffffff');
    graphic.rect(-DESIGN_WIDTH / 2, height / 2 - revealed, DESIGN_WIDTH, revealed);
    graphic.fill();
    if (this.wipeContent) this.wipeContent.setPosition(this.content.position);
  }

  private endWipe(): void {
    if (this.wipeRoot) this.wipeRoot.active = false;
    this.wipeContent = null;
    this.wipeHoldLabel = null;
    this.wipeHoldSubtitle = null;
  }

  private button(parent: Node, title: string, x: number, y: number, width: number,
    height: number, onClick: () => void, size = 27): Node {
    const palette = this.palette();
    const root = createRect(title, parent, width, height, palette.surface, x, y, 12, palette.rule);
    root.addComponent(Button).transition = Button.Transition.SCALE;
    createLabel('Text', root, title, size, palette.fg, width - 20, height - 8);
    root.on(Button.EventType.CLICK, onClick);
    return root;
  }

  private palette(light = this.light): QuitPalette { return light ? LIGHT : DARK; }

  private repaint(node: Node, fill: string): void {
    const transform = node.getComponent(UITransform)!;
    const graphics = node.getComponent(Graphics)!;
    graphics.clear();
    graphics.fillColor = color(fill);
    graphics.rect(-transform.width / 2, -transform.height / 2, transform.width, transform.height);
    graphics.fill();
  }

  private applyTheme(): void {
    const palette = this.palette();
    this.repaint(this.background, palette.bg);
    this.repaint(this.navBackground, palette.bg);
    this.repaint(this.tabBackground, palette.bg);
    this.navTitle.color = color(palette.fg);
    this.navBack.color = color(palette.fg);
    this.notice.color = color(palette.muted);
  }

  private drawTabs(): void {
    const palette = this.palette();
    for (const child of [...this.tabs.children]) if (child.name !== 'TabBackground') child.destroy();
    const add = (tab: Tab, text: string, x: number): void => {
      const selected = this.tab === tab;
      const root = createRect(`Tab${tab}`, this.tabs, 337, 100,
        selected ? palette.button : palette.bg, x, 0, 12,
        selected ? palette.button : palette.rule);
      root.addComponent(Button).transition = Button.Transition.NONE;
      createLabel('Text', root, text, 32, selected ? palette.ink : palette.muted,
        310, 80).isBold = true;
      root.on(Button.EventType.CLICK, () => this.switchTab(tab));
    };
    add('smoke', '今天抽了', -174.5);
    add('quit', '今天未抽', 174.5);
  }

  private switchTab(tab: Tab): void {
    this.cancelHold();
    this.priceOpen = false;
    this.allowedQuitDay = '';
    this.allowedQuitAt = null;
    this.tab = tab;
    this.notice.string = '';
    this.refresh();
    this.scroll.scrollToTop(0);
  }

  private refresh(): void {
    this.cancelHold();
    this.smokeStatusLabel = null;
    if (!this.priceOpen) { this.priceInput = null; this.sticksInput = null; }
    this.feelingInput = null;
    for (const child of [...this.section.children]) {
      if (child.name === 'PackPriceField' || child.name === 'SticksField'
        || child.name === 'FeelingField') {
        // Cocos may still have a 400 ms mobile scroll callback for this input.
        // Keep the disabled DOM node alive until that callback has finished.
        child.active = false;
        child.removeFromParent();
        setTimeout(() => { if (child.isValid) child.destroy(); }, 500);
      } else child.destroy();
    }
    const snapshot = this.store.readSnapshot();
    this.light = snapshot?.light ?? false;
    this.applyTheme();
    this.drawTabs();
    if (!snapshot) {
      createLabel('Unavailable', this.section, '本机存档不可用，暂时无法记录', 30,
        '#d7ae8b', 650, 100, 0, 620);
      this.button(this.section, '重新读取', 0, 510, 500, 76, () => this.refresh());
      return;
    }
    if (this.tab === 'smoke') this.drawSmoke(snapshot);
    else this.drawQuit(snapshot);
  }

  private heading(text: string, y: number, size = 32): void {
    createLabel(text, this.section, text, size, this.palette().fg, 650, 66, 0, y,
      HorizontalTextAlignment.LEFT).isBold = true;
  }

  private line(text: string, y: number, size = 26, tone = '#aca9a2'): void {
    createLabel(text, this.section, text, size, tone === '#aca9a2' ? this.palette().muted : tone,
      650, 70, 0, y,
      HorizontalTextAlignment.LEFT);
  }

  private drawSmoke(snapshot: QuitSnapshot): void {
    const height = Math.max(view.getVisibleSize().height - 256,
      1260 + Math.min(snapshot.records.length, this.realVisible) * 88
        + (this.priceOpen ? 460 : 0) + (this.priceError ? 52 : 0));
    this.content.getComponent(UITransform)!.setContentSize(DESIGN_WIDTH, height);
    this.section.getComponent(UITransform)!.setContentSize(DESIGN_WIDTH, height);
    this.notice.node.active = false;
    this.drawSmokeView(snapshot, this.section, this.palette(), height, true);
  }

  private realVisible = 20;

  private smokeText(parent: Node, name: string, value: string, x: number, y: number,
    width: number, height: number, size: number, tint: string,
    align: HorizontalTextAlignment = HorizontalTextAlignment.LEFT): Label {
    return createLabel(name, parent, value, size, tint, width, height, x, y, align);
  }

  private smokeRule(parent: Node, name: string, y: number, palette: QuitPalette): void {
    createRect(name, parent, 678, 2, palette.rule, 0, y);
  }

  private drawSmokeView(snapshot: QuitSnapshot, parent: Node, palette: QuitPalette,
    height: number, interactive: boolean): void {
    let cursor = height / 2 - 28;
    this.smokeText(parent, 'RealTitle', '今天，照实记。', 0, cursor - 32,
      678, 64, 48, palette.fg).isBold = true;
    cursor -= 64 + 18;
    const date = new Date();
    const weekday = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][date.getDay()];
    this.smokeText(parent, 'RealDate', `${snapshot.today} · ${weekday}`,
      -169, cursor - 16, 340, 32, 22, palette.muted);
    this.smokeText(parent, 'RealDateNote', '今天 · 真实记录', 181, cursor - 16,
      316, 32, 22, palette.muted, HorizontalTextAlignment.RIGHT);
    cursor -= 32 + 30;
    this.smokeRule(parent, 'MetricsTop', cursor, palette);
    const metricsHeight = 150;
    const widths = [247, 215, 216];
    const starts = [-339, -92, 123];
    const seconds = snapshot.lastRealAt
      ? Math.max(0, Math.floor((Date.now() - snapshot.lastRealAt) / 1000)) : -1;
    const interval = seconds < 0 ? '还未记录' : seconds < 60 ? '刚刚'
      : seconds < 3600 ? `${Math.floor(seconds / 60)} 分钟`
        : seconds < 86400 ? `${Math.floor(seconds / 3600)} 时 ${Math.floor(seconds % 3600 / 60)} 分`
          : `${Math.floor(seconds / 86400)} 天 ${Math.floor(seconds % 86400 / 3600)} 时`;
    const values = [interval, String(snapshot.records.length),
      snapshot.todayCostCents === null ? '—' : (snapshot.todayCostCents / 100).toFixed(2)];
    const labels = ['距上次记录', '今日已记', '烟费估算'];
    for (let index = 0; index < 3; index += 1) {
      const left = starts[index] + (index === 0 ? 0 : 20);
      const w = widths[index] - (index === 0 ? 8 : 30);
      const labelY = cursor - 26 - 17;
      const valueY = cursor - 65 - 28;
      this.smokeText(parent, `MetricLabel${index}`, labels[index], left + w / 2,
        labelY, w, 34, 23, palette.muted);
      this.smokeText(parent, `MetricValue${index}`, values[index], left + w / 2,
        valueY, w, 56, index === 0 ? 29 : 40, palette.fg).isBold = true;
      if (index > 0) {
        const unitX = Math.min(starts[index] + widths[index] - 18,
          left + Math.max(25, values[index].length * 22) + 18);
        this.smokeText(parent, `MetricUnit${index}`, index === 1 ? '支' : '元',
          unitX, valueY - 8, 34, 30, 22, palette.muted);
      }
      if (interactive && index > 0) {
        const hit = createNode(`MetricHit${index}`, parent, widths[index], metricsHeight,
          starts[index] + widths[index] / 2, cursor - metricsHeight / 2);
        hit.addComponent(Button).transition = Button.Transition.NONE;
        hit.on(Button.EventType.CLICK, () => this.openTrend());
      }
    }
    createRect('MetricDivider1', parent, 2, 100, palette.rule, -92, cursor - 75);
    createRect('MetricDivider2', parent, 2, 100, palette.rule, 123, cursor - 75);
    cursor -= metricsHeight;
    this.smokeRule(parent, 'MetricsBottom', cursor, palette);
    cursor -= 32;
    this.smokeText(parent, 'RealHeading', '如实记下，慢慢调整。', 0,
      cursor - 25, 678, 50, 34, palette.fg, HorizontalTextAlignment.CENTER).isBold = true;
    cursor -= 50 + 14;
    this.smokeText(parent, 'RealCopy', '按自己的节奏，照顾好自己。', 0,
      cursor - 18, 678, 36, 25, palette.muted, HorizontalTextAlignment.CENTER);
    cursor -= 36 + 26;
    this.holdButton('抽了一支', cursor - 72, 'smoke', parent, palette, 144, interactive);
    cursor -= 144 + 22;
    const status = this.smokeText(parent, 'RealStatus', this.notice.string
      || '只记录真实抽过的烟。长按满 3 秒记一支。', 0, cursor - 25,
      678, 50, 23, palette.muted, HorizontalTextAlignment.CENTER);
    if (interactive) this.smokeStatusLabel = status;
    cursor -= 50;
    this.smokeRule(parent, 'TrendTop', cursor, palette);
    const trend = createNode('RealTrend', parent, 678, 104, 0, cursor - 52);
    this.smokeText(trend, 'TrendTitle', '查看完整趋势', -175, 0,
      330, 54, 29, palette.fg);
    this.smokeText(trend, 'TrendNote', '吸烟 · 花费  ›', 181, 0,
      306, 54, 24, palette.muted, HorizontalTextAlignment.RIGHT);
    if (interactive) {
      trend.addComponent(Button).transition = Button.Transition.NONE;
      trend.on(Button.EventType.CLICK, () => this.openTrend());
    }
    cursor -= 104;
    this.smokeRule(parent, 'TrendBottom', cursor, palette);
    cursor -= 34;
    this.smokeText(parent, 'HistoryHeading', '今天的记录', -170, cursor - 22,
      338, 44, 30, palette.fg).isBold = true;
    this.smokeText(parent, 'HistoryCount', `${snapshot.records.length} 支`, 174,
      cursor - 22, 330, 44, 23, palette.muted, HorizontalTextAlignment.RIGHT);
    cursor -= 44;
    if (!snapshot.records.length) {
      cursor -= 26;
      this.smokeText(parent, 'RealEmpty', '还没有记录。真实抽过后，再来记一支。',
        0, cursor - 28, 678, 56, 24, palette.muted);
      cursor -= 56 + 18;
    }
    snapshot.records.slice().reverse().slice(0, this.realVisible).forEach((record, index) => {
      const time = new Date(record.at);
      const two = (value: number): string => value < 10 ? `0${value}` : String(value);
      const stamp = `${two(time.getHours())}:${two(time.getMinutes())}:${two(time.getSeconds())}`;
      this.smokeRule(parent, `RowLine${index}`, cursor, palette);
      const rowY = cursor - 44;
      this.smokeText(parent, `RowTime${index}`, stamp, -247, rowY,
        184, 54, 28, palette.fg);
      const price = record.priceCents ?? snapshot.packPriceCents;
      const count = record.priceCents === null || record.priceCents === undefined
        ? snapshot.sticksPerPack : record.sticksPerPack ?? snapshot.sticksPerPack;
      this.smokeText(parent, `RowCost${index}`,
        price === null ? '未设烟价' : `约 ¥${(price / count / 100).toFixed(2)}`,
        34, rowY, 270, 54, 24, palette.muted, HorizontalTextAlignment.RIGHT);
      const undo = this.smokeText(parent, `RowUndo${index}`, '撤销', 271, rowY,
        136, 64, 25, palette.fg, HorizontalTextAlignment.RIGHT);
      if (interactive) {
        undo.node.addComponent(Button).transition = Button.Transition.NONE;
        undo.node.on(Button.EventType.CLICK, () => this.confirm('撤销这支记录？',
          '对应的支数和烟费估算会移除，未抽烟确认需要你重新操作。', '确认撤销',
          () => this.resultNotice(this.store.undoReal(record.id))));
      }
      cursor -= 88;
    });
    if (snapshot.records.length > this.realVisible) {
      const more = this.smokeText(parent, 'MoreRows', '查看更多记录', 0,
        cursor - 44, 678, 88, 26, palette.fg);
      if (interactive) {
        more.node.addComponent(Button).transition = Button.Transition.NONE;
        more.node.on(Button.EventType.CLICK, () => { this.realVisible += 20; this.refresh(); });
      }
      cursor -= 88;
    }
    cursor -= 32;
    this.smokeRule(parent, 'PriceTop', cursor, palette);
    const priceNode = createNode('PriceLink', parent, 678, 104, 0, cursor - 52);
    this.smokeText(priceNode, 'PriceTitle', '我的烟价', -170, 0, 338, 54, 29, palette.fg);
    this.smokeText(priceNode, 'PriceSummary', snapshot.packPriceCents === null
      ? '设置烟价（选填）  ›'
      : `¥${(snapshot.packPriceCents / 100).toFixed(2)} / ${snapshot.sticksPerPack} 支  ›`,
    170, 0, 338, 54, 24, palette.muted, HorizontalTextAlignment.RIGHT);
    if (interactive) {
      priceNode.addComponent(Button).transition = Button.Transition.NONE;
      priceNode.on(Button.EventType.CLICK, () => this.openPrice());
    }
    cursor -= 104;
    this.smokeRule(parent, 'PriceBottom', cursor, palette);
    if (interactive && this.priceOpen) {
      cursor -= 24;
      const addField = (name: string, label: string, value: string, y: number,
        numeric: boolean): EditBox => {
        this.smokeText(parent, `${name}Label`, label, -120, y,
          438, 64, 26, palette.fg);
        const field = createRect(`${name}Field`, parent, 210, 88, palette.surface,
          234, y, 8, palette.rule);
        const inputArea = createNode(`${name}InputArea`, field, 210, 88);
        inputArea.active = false;
        const edit = inputArea.addComponent(EditBox);
        // EditBox chooses input vs textarea during __preload. Set the mode
        // before activation so the web preview never creates a textarea.
        edit.inputMode = EditBox.InputMode.DECIMAL;
        inputArea.active = true;
        const configureLabel = (label: Label | null, tint: string): void => {
          if (!label) return;
          label.fontSize = 26;
          label.lineHeight = 36;
          label.color = color(tint);
          label.horizontalAlign = HorizontalTextAlignment.LEFT;
          label.verticalAlign = VerticalTextAlignment.CENTER;
          label.overflow = Label.Overflow.CLAMP;
          label.enableWrapText = false;
          label.node.getComponent(UITransform)?.setContentSize(206, 88);
          label.node.setPosition(0, 0);
        };
        if (!edit.textLabel) {
          edit.textLabel = createLabel('TEXT_LABEL', inputArea, '', 26, palette.fg,
            206, 88, 0, 0, HorizontalTextAlignment.LEFT);
        }
        if (!edit.placeholderLabel) {
          edit.placeholderLabel = createLabel('PLACEHOLDER_LABEL', inputArea, '', 26,
            palette.muted, 206, 88, 0, 0, HorizontalTextAlignment.LEFT);
        }
        configureLabel(edit.textLabel, palette.fg);
        configureLabel(edit.placeholderLabel, palette.muted);
        edit.string = value;
        edit.placeholder = name === 'PackPrice' ? '未设置' : '';
        edit.maxLength = name === 'PackPrice' ? 8 : 3;
        inputArea.on('editing-did-began', () => {
          // The engine focuses its DOM input after emitting this event.
          Promise.resolve().then(() => {
            if (typeof document === 'undefined' || !edit.isFocused()) return;
            const input = document.activeElement as HTMLInputElement | null;
            if (!input?.classList.contains('cocosEditBox')) return;
            input.style.boxSizing = 'border-box';
            input.style.width = '206px';
            input.style.outline = 'none';
            input.style.boxShadow = 'none';
            input.style.border = '0';
            input.style.padding = '0';
            input.style.margin = '0';
            input.style.background = 'transparent';
            input.style.lineHeight = '88px';
            input.style.caretColor = palette.fg;
            input.inputMode = numeric ? 'numeric' : 'decimal';
          });
        });
        return edit;
      };
      this.priceInput = addField('PackPrice', '每包价格 / 元（选填）',
        this.priceDraft, cursor - 44, false);
      this.priceInput.node.on('text-changed', () => {
        this.priceDraft = this.priceInput?.string ?? this.priceDraft;
      });
      cursor -= 108;
      this.sticksInput = addField('Sticks', '每包支数', this.sticksDraft,
        cursor - 44, true);
      this.sticksInput.node.on('text-changed', () => {
        this.sticksDraft = this.sticksInput?.string ?? this.sticksDraft;
      });
      cursor -= 108;
      this.smokeText(parent, 'PriceHelp',
        '未设价记录按当前烟价补算，已设价记录保留原价。',
        0, cursor - 30, 678, 60, 23, palette.muted);
      cursor -= 60;
      if (this.priceError) {
        this.smokeText(parent, 'PriceError', this.priceError,
          0, cursor - 26, 678, 52, 22, palette.fg);
        cursor -= 52;
      }
      cursor -= 20;
      const cancel = createRect('CancelPrice', parent, 331, 88, palette.surface,
        -173.5, cursor - 44, 10, palette.rule);
      this.smokeText(cancel, 'CancelPriceText', '取消', 0, 0,
        310, 70, 26, palette.fg, HorizontalTextAlignment.CENTER);
      cancel.addComponent(Button).transition = Button.Transition.NONE;
      cancel.on(Button.EventType.CLICK, () => this.closePrice());
      const save = createRect('SavePrice', parent, 331, 88, palette.surface,
        173.5, cursor - 44, 10, palette.rule);
      this.smokeText(save, 'SavePriceText', '保存烟价', 0, 0,
        310, 70, 26, palette.fg, HorizontalTextAlignment.CENTER);
      save.addComponent(Button).transition = Button.Transition.NONE;
      save.on(Button.EventType.CLICK, () => this.savePriceInline());
      cursor -= 88 + 24;
    }
    cursor -= 26;
    this.smokeText(parent, 'RealFootnote',
      '记录仅保存在本机。烟费为按支数估算的消耗，非实际购买支出。',
      0, cursor - 38, 678, 76, 22, palette.muted);
  }

  private drawQuit(snapshot: QuitSnapshot): void {
    const height = Math.max(1500, view.getVisibleSize().height - 256);
    this.content.getComponent(UITransform)!.setContentSize(DESIGN_WIDTH, height);
    this.section.getComponent(UITransform)!.setContentSize(DESIGN_WIDTH, height);
    this.notice.node.active = false;
    const palette = this.palette();
    let cursor = height / 2 - 22;
    this.smokeText(this.section, 'QuitTitle', '今天没抽真烟，就记一天', 0,
      cursor - 30, 678, 60, 38, palette.fg).isBold = true;
    cursor -= 60 + 14;
    const date = new Date();
    const weekday = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][date.getDay()];
    this.smokeText(this.section, 'QuitCopy', '慢慢来，照顾好自己。', -151,
      cursor - 18, 376, 36, 22, palette.muted);
    this.smokeText(this.section, 'QuitDate',
      `${date.getMonth() + 1} 月 ${date.getDate()} 日 · ${weekday}`, 197,
      cursor - 18, 284, 36, 22, palette.muted, HorizontalTextAlignment.RIGHT);
    cursor -= 36 + 22;
    this.smokeRule(this.section, 'QuitSummaryTop', cursor, palette);
    const values = [snapshot.totalDays, snapshot.currentStreak, snapshot.longestStreak];
    const labels = ['累计确认 / 天', '当前连续 / 天', '最长连续 / 天'];
    for (let index = 0; index < 3; index += 1) {
      const x = -226 + index * 226;
      this.smokeText(this.section, `QuitSummaryValue${index}`, String(values[index]),
        x, cursor - 53, 218, 64, 40, palette.fg,
        HorizontalTextAlignment.CENTER).isBold = true;
      this.smokeText(this.section, `QuitSummaryLabel${index}`, labels[index],
        x, cursor - 112, 218, 38, 22, palette.muted,
        HorizontalTextAlignment.CENTER);
    }
    createRect('QuitSummaryDivider1', this.section, 1, 54, palette.rule,
      -113, cursor - 80);
    createRect('QuitSummaryDivider2', this.section, 1, 54, palette.rule,
      113, cursor - 80);
    cursor -= 156;
    this.smokeRule(this.section, 'QuitSummaryBottom', cursor, palette);
    if (snapshot.records.length > 0) {
      cursor -= 20;
      const warning = createRect('QuitSmokingNotice', this.section, 678, 104,
        palette.surface, 0, cursor - 52, 12, palette.rule);
      this.smokeText(warning, 'WarningTitle',
        `今天已记录 ${snapshot.records.length} 支真烟`, -115, 22,
        386, 36, 25, palette.fg);
      this.smokeText(warning, 'WarningNote', '如有误记，请先核对并撤销。',
        -115, -19, 386, 32, 21, palette.muted);
      const review = this.smokeText(warning, 'ReviewRecord', '核对记录',
        252, 0, 132, 64, 24, palette.fg, HorizontalTextAlignment.CENTER);
      review.node.addComponent(Button).transition = Button.Transition.NONE;
      review.node.on(Button.EventType.CLICK, () => this.switchTab('smoke'));
      cursor -= 104;
    }
    cursor -= 24;
    this.smokeText(this.section, 'QuitConfirmTitle', '今天的确认', -170,
      cursor - 22, 338, 44, 28, palette.fg).isBold = true;
    cursor -= 44 + 14;
    const choice = createRect('QuitChoice', this.section, 678, 108,
      palette.surface, 0, cursor - 54, 12, this.selected ? palette.fg : palette.rule);
    choice.addComponent(Button).transition = Button.Transition.NONE;
    const mark = createNode('ChoiceMark', choice, 38, 38, -292, 0);
    const markGraphics = mark.addComponent(Graphics);
    markGraphics.lineWidth = 2;
    markGraphics.strokeColor = color(this.selected ? palette.fg : palette.muted);
    markGraphics.circle(0, 0, 18);
    markGraphics.stroke();
    if (this.selected) {
      markGraphics.fillColor = color(palette.fg);
      markGraphics.circle(0, 0, 9);
      markGraphics.fill();
    }
    this.smokeText(choice, 'ChoiceTitle', '今日确定未抽真烟', -42,
      22, 402, 40, 27, palette.fg).isBold = true;
    const note = snapshot.confirmed
      ? this.selected ? '再次点击可取消选择，保存后生效' : '保存后会移除今天的记录'
      : '选择并保存后，今天才会计入 1 天';
    this.smokeText(choice, 'ChoiceNote', note, -42, -22, 402, 40, 21, palette.muted);
    const state = snapshot.confirmed
      ? this.selected ? '已记入' : '待取消' : this.selected ? '已选择' : '待选择';
    this.smokeText(choice, 'ChoiceState', state, 270, 0, 112, 48, 22,
      palette.fg, HorizontalTextAlignment.RIGHT);
    choice.on(Button.EventType.CLICK, () => {
      this.selected = !this.selected;
      this.notice.string = snapshot.confirmed
        ? this.selected ? '今天已记入戒烟日志' : '已取消选择，保存后会移除今天'
        : this.selected ? '已选择，保存后才会计入一天' : '尚未确认';
      this.refresh();
    });
    cursor -= 108 + 22;
    this.smokeText(this.section, 'FeelingLabel', '今天的感受（选填）', -154,
      cursor - 18, 370, 36, 24, palette.muted);
    const feelingCount = this.smokeText(this.section, 'FeelingCount',
      `${this.feeling.length} / 200`, 235, cursor - 18, 208, 36, 22,
      palette.muted, HorizontalTextAlignment.RIGHT);
    cursor -= 36 + 12;
    const field = createRect('FeelingField', this.section, 678, 128,
      palette.surface, 0, cursor - 64, 12, palette.rule);
    const inputArea = createNode('FeelingInputArea', field, 646, 104);
    inputArea.active = false;
    const edit = inputArea.addComponent(EditBox);
    edit.inputMode = EditBox.InputMode.ANY;
    inputArea.active = true;
    this.feelingInput = edit;
    const configureFeelingLabel = (label: Label | null, tint: string): void => {
      if (!label) return;
      label.fontSize = 26;
      label.lineHeight = 36;
      label.color = color(tint);
      label.horizontalAlign = HorizontalTextAlignment.LEFT;
      label.verticalAlign = VerticalTextAlignment.TOP;
      label.overflow = Label.Overflow.CLAMP;
      label.node.getComponent(UITransform)?.setContentSize(642, 104);
      label.node.setPosition(0, 0);
    };
    configureFeelingLabel(edit.textLabel, palette.fg);
    configureFeelingLabel(edit.placeholderLabel, palette.muted);
    edit.placeholder = '今天想记录点什么';
    edit.string = this.feeling;
    edit.maxLength = 200;
    inputArea.on('text-changed', () => {
      this.feeling = edit.string.slice(0, 200);
      feelingCount.string = `${this.feeling.length} / 200`;
    });
    cursor -= 128 + 24;
    const actionText = snapshot.confirmed
      ? this.selected ? '更新今天的感受' : '取消今天的记录' : '记下这一天';
    if (this.selected) {
      const action = this.holdButton(actionText, cursor - 50, 'quit',
        this.section, palette, 100);
      const subtitle = action.getChildByName('HoldSubtitle')?.getComponent(Label);
      if (subtitle) subtitle.string = snapshot.confirmed
        ? '长按 3 秒更新' : '长按 3 秒记录';
    } else if (snapshot.confirmed) {
      const cancel = createRect('QuitCancelAction', this.section, 678, 100,
        palette.surface, 0, cursor - 50, 12, palette.rule);
      this.smokeText(cancel, 'QuitCancelText', actionText, 0, 0,
        634, 70, 30, palette.fg, HorizontalTextAlignment.CENTER).isBold = true;
      cancel.addComponent(Button).transition = Button.Transition.NONE;
      cancel.on(Button.EventType.CLICK, () => this.cancelTodayQuit(snapshot));
    } else {
      const disabled = createRect('QuitDisabledAction', this.section, 678, 100,
        palette.surface, 0, cursor - 50, 12, palette.rule);
      this.smokeText(disabled, 'QuitDisabledText', actionText, 0, 0,
        634, 70, 30, palette.muted, HorizontalTextAlignment.CENTER).isBold = true;
    }
    cursor -= 100;
    const status = this.notice.string || (snapshot.confirmed ? '今天已记入戒烟日志' : '');
    if (status && status !== '尚未确认') {
      cursor -= 8;
      this.smokeText(this.section, 'QuitStatus', status, 0, cursor - 22,
        678, 44, 23, palette.muted, HorizontalTextAlignment.CENTER);
      cursor -= 44;
    }
    cursor -= 8;
    const log = createNode('QuitLogLink', this.section, 678, 80, 0, cursor - 40);
    this.smokeText(log, 'QuitLogText', '查看戒烟日志', 0, 0,
      640, 70, 28, palette.fg, HorizontalTextAlignment.CENTER);
    log.addComponent(Button).transition = Button.Transition.NONE;
    log.on(Button.EventType.CLICK, () => this.openQuitHistory());
  }

  // The old package renders the opposite theme's current tab behind the hold wipe.
  // This copy has no input components: touches stay on the live page underneath.
  private drawQuitMirror(snapshot: QuitSnapshot, parent: Node,
    palette: QuitPalette, height: number): void {
    let cursor = height / 2 - 22;
    this.smokeText(parent, 'QuitTitle', '今天没抽真烟，就记一天', 0,
      cursor - 30, 678, 60, 38, palette.fg).isBold = true;
    cursor -= 74;
    const date = new Date();
    const weekday = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][date.getDay()];
    this.smokeText(parent, 'QuitCopy', '慢慢来，照顾好自己。', -151,
      cursor - 18, 376, 36, 22, palette.muted);
    this.smokeText(parent, 'QuitDate',
      `${date.getMonth() + 1} 月 ${date.getDate()} 日 · ${weekday}`, 197,
      cursor - 18, 284, 36, 22, palette.muted, HorizontalTextAlignment.RIGHT);
    cursor -= 58;
    this.smokeRule(parent, 'QuitSummaryTop', cursor, palette);
    const values = [snapshot.totalDays, snapshot.currentStreak, snapshot.longestStreak];
    const labels = ['累计确认 / 天', '当前连续 / 天', '最长连续 / 天'];
    for (let index = 0; index < 3; index += 1) {
      const x = -226 + index * 226;
      this.smokeText(parent, `QuitSummaryValue${index}`, String(values[index]),
        x, cursor - 53, 218, 64, 40, palette.fg,
        HorizontalTextAlignment.CENTER).isBold = true;
      this.smokeText(parent, `QuitSummaryLabel${index}`, labels[index],
        x, cursor - 112, 218, 38, 22, palette.muted,
        HorizontalTextAlignment.CENTER);
    }
    createRect('QuitSummaryDivider1', parent, 1, 54, palette.rule, -113, cursor - 80);
    createRect('QuitSummaryDivider2', parent, 1, 54, palette.rule, 113, cursor - 80);
    cursor -= 156;
    this.smokeRule(parent, 'QuitSummaryBottom', cursor, palette);
    cursor -= 24;
    this.smokeText(parent, 'QuitConfirmTitle', '今天的确认', -170,
      cursor - 22, 338, 44, 28, palette.fg).isBold = true;
    cursor -= 58;
    const choice = createRect('QuitChoice', parent, 678, 108,
      palette.surface, 0, cursor - 54, 12, palette.fg);
    const mark = createNode('ChoiceMark', choice, 38, 38, -292, 0);
    const markGraphics = mark.addComponent(Graphics);
    markGraphics.lineWidth = 2;
    markGraphics.strokeColor = color(palette.fg);
    markGraphics.circle(0, 0, 18);
    markGraphics.stroke();
    markGraphics.fillColor = color(palette.fg);
    markGraphics.circle(0, 0, 9);
    markGraphics.fill();
    this.smokeText(choice, 'ChoiceTitle', '今日确定未抽真烟', -42,
      22, 402, 40, 27, palette.fg).isBold = true;
    this.smokeText(choice, 'ChoiceNote', snapshot.confirmed
      ? '再次点击可取消选择，保存后生效' : '选择并保存后，今天才会计入 1 天',
    -42, -22, 402, 40, 21, palette.muted);
    this.smokeText(choice, 'ChoiceState', snapshot.confirmed ? '已记入' : '已选择',
      270, 0, 112, 48, 22, palette.fg, HorizontalTextAlignment.RIGHT);
    cursor -= 130;
    this.smokeText(parent, 'FeelingLabel', '今天的感受（选填）', -154,
      cursor - 18, 370, 36, 24, palette.muted);
    this.smokeText(parent, 'FeelingCount', `${this.feeling.length} / 200`, 235,
      cursor - 18, 208, 36, 22, palette.muted, HorizontalTextAlignment.RIGHT);
    cursor -= 48;
    const field = createRect('FeelingField', parent, 678, 128,
      palette.surface, 0, cursor - 64, 12, palette.rule);
    this.smokeText(field, 'FeelingText', this.feeling || '今天想记录点什么',
      -12, 0, 620, 104, 26, this.feeling ? palette.fg : palette.muted,
      HorizontalTextAlignment.LEFT);
    cursor -= 152;
    const action = this.holdButton(snapshot.confirmed ? '更新今天的感受' : '记下这一天',
      cursor - 50, 'quit', parent, palette, 100, false);
    const subtitle = action.getChildByName('HoldSubtitle')?.getComponent(Label);
    if (subtitle) subtitle.string = '松开取消';
    cursor -= 100;
    const status = this.notice.string || (snapshot.confirmed ? '今天已记入戒烟日志' : '');
    if (status && status !== '尚未确认') {
      cursor -= 8;
      this.smokeText(parent, 'QuitStatus', status, 0, cursor - 22,
        678, 44, 23, palette.muted, HorizontalTextAlignment.CENTER);
      cursor -= 44;
    }
    cursor -= 8;
    const log = createNode('QuitLogLink', parent, 678, 80, 0, cursor - 40);
    this.smokeText(log, 'QuitLogText', '查看戒烟日志', 0, 0,
      640, 70, 28, palette.fg, HorizontalTextAlignment.CENTER);
  }

  private showDetail(title: string, body: string): void {
    this.detailTitle.string = title;
    this.detailBody.string = body;
    this.detailBody.node.active = true;
    this.detailOverlay.active = true;
  }

  private openRealHistory(): void {
    const history = this.store.readHistory();
    if (!history) { this.notice.string = '本机存档不可用'; return; }
    const rows = history.real.slice(0, 12).map((item) => {
      const date = new Date(item.at);
      return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}  `
        + `${date.getHours()}:${String(date.getMinutes() < 10 ? '0' : '')}${date.getMinutes()}  1 支`;
    });
    this.showDetail('更多真实记录', rows.length ? rows.join('\n') : '还没有记录。');
  }

  private openTrend(): void {
    this.cancelHold();
    this.trendPage.present();
  }

  private openQuitHistory(): void {
    this.cancelHold();
    this.journal.present();
  }

  private openPrice(): void {
    const snapshot = this.store.readSnapshot();
    if (!snapshot) { this.notice.string = '本机存档不可用'; return; }
    this.cancelHold();
    this.priceOpen = !this.priceOpen;
    this.priceError = '';
    if (this.priceOpen) {
      this.priceDraft = snapshot.packPriceCents === null
        ? '' : (snapshot.packPriceCents / 100).toFixed(2);
      this.sticksDraft = String(snapshot.sticksPerPack);
    }
    this.refresh();
    if (this.priceOpen) this.scheduleOnce(() => {
      if (this.priceOpen && this.node.active) this.scroll.scrollToBottom(0.2);
    }, 0);
  }

  private closePrice(): void {
    this.priceOpen = false;
    this.priceError = '';
    this.priceInput = null;
    this.sticksInput = null;
    this.refresh();
  }

  private savePriceInline(): void {
    const priceText = (this.priceInput?.string ?? this.priceDraft).trim();
    const value = priceText.length === 0 ? null : Number(priceText);
    const sticksText = (this.sticksInput?.string ?? this.sticksDraft).trim();
    const sticks = Number(sticksText);
    this.priceDraft = priceText;
    this.sticksDraft = sticksText;
    if ((priceText && !/^\d{1,5}(?:\.\d{1,2})?$/.test(priceText))
      || (value !== null && (!Number.isFinite(value) || value < 0 || value > 10000))
      || !/^\d{1,3}$/.test(sticksText)
      || !Number.isSafeInteger(sticks) || sticks < 1 || sticks > 100) {
      this.priceError = '每包价格为 0–10000 元，最多两位小数；每包 1–100 支。';
      this.refresh();
      return;
    }
    const result = this.store.savePrice(value === null ? null : Math.round(value * 100), sticks);
    if (result === 'saved' || result === 'unchanged') {
      this.priceOpen = false;
      this.priceError = '';
      this.priceInput = null;
      this.sticksInput = null;
      this.notice.string = '烟价已保存，费用已更新';
    } else {
      this.priceError = '烟价没有保存成功，请重试。';
    }
    this.refresh();
  }

  private holdButton(title: string, y: number, action: HoldAction,
    parent: Node = this.section, palette: QuitPalette = this.palette(),
    height = 144, interactive = true): Node {
    const node = createRect('HoldAction', parent, 678, height, palette.button, 0, y, 14);
    const label = createLabel('HoldText', node, title, action === 'smoke' ? 40 : 32,
      palette.ink, 638, action === 'smoke' ? 70 : 54, 0, action === 'smoke' ? 16 : 12);
    const subtitle = createLabel('HoldSubtitle', node, '长按 3 秒记录', 24,
      palette.ink, 638, action === 'smoke' ? 44 : 34, 0,
      action === 'smoke' ? -33 : -29);
    if (!interactive) return node;
    node.on(Node.EventType.TOUCH_START, (event: EventTouch) => {
      if (this.overlay.active || this.detailOverlay.active || this.slide) return;
      if (action === 'smoke' && this.priceOpen) return;
      if (event.getTouches().length > 1) return;
      const snapshot = this.store.readSnapshot();
      if (!snapshot) { this.notice.string = '本机存档不可用'; return; }
      if (action === 'quit' && snapshot.records.length > 0) {
        this.showToast('今日有真实记烟', '请先核对或撤销误记');
        return;
      }
      if (action === 'smoke' && snapshot.confirmed
        && (this.allowedQuitDay !== snapshot.today
          || this.allowedQuitAt !== snapshot.quitConfirmedAt)) {
        this.confirm('今天已确认未抽烟',
          '真实记烟成功后，将取消今天的未抽烟确认。是否继续？', '继续记烟', () => {
            this.allowedQuitDay = snapshot.today;
            this.allowedQuitAt = snapshot.quitConfirmedAt;
            this.notice.string = '现在长按 3 秒记一支；提前松开不会修改记录。';
            this.refresh();
          });
        return;
      }
      const point = event.getUILocation();
      this.holdStartX = point.x;
      this.holdStartY = point.y;
      this.hold = action;
      this.holdTime = 0;
      this.holdDay = snapshot.today;
      this.holdOriginalText = title;
      this.holdLabel = label;
      this.holdSubtitle = subtitle;
      this.holdOriginalSubtitle = this.holdSubtitle.string;
      this.holdSubtitle.string = '松开取消';
      this.notice.string = '保持按住，松开即可取消。';
      if (this.smokeStatusLabel) this.smokeStatusLabel.string = this.notice.string;
      this.beginWipe(snapshot);
    });
    node.on(Node.EventType.TOUCH_MOVE, (event: EventTouch) => {
      const point = event.getUILocation();
      if (event.getTouches().length > 1 || Math.hypot(point.x - this.holdStartX,
        point.y - this.holdStartY) > 24) this.cancelHold();
    });
    node.on(Node.EventType.TOUCH_END, () => this.cancelHold());
    node.on(Node.EventType.TOUCH_CANCEL, () => this.cancelHold());
    return node;
  }

  private cancelHold(): void {
    const cancelled = this.hold !== null;
    this.hold = null;
    this.holdTime = 0;
    if (cancelled && this.holdLabel?.isValid) this.holdLabel.string = this.holdOriginalText;
    if (cancelled && this.holdSubtitle?.isValid) this.holdSubtitle.string = this.holdOriginalSubtitle;
    this.holdLabel = null;
    this.holdSubtitle = null;
    this.endWipe();
    if (cancelled && this.tab === 'smoke') {
      this.notice.string = '已取消，本次没有记录。';
      if (this.smokeStatusLabel?.isValid) this.smokeStatusLabel.string = this.notice.string;
    }
  }

  private perform(action: HoldAction): void {
    const snapshot = this.store.readSnapshot();
    if (!snapshot) { this.notice.string = '本机存档不可用'; return; }
    if (action === 'smoke') {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const allowed = snapshot.confirmed && this.allowedQuitDay === snapshot.today
        && this.allowedQuitAt === snapshot.quitConfirmedAt;
      const result = this.store.recordReal(id, allowed, Date.now(),
        allowed ? this.allowedQuitAt! : undefined);
      if (result === 'saved') { this.allowedQuitDay = ''; this.allowedQuitAt = null; }
      this.resultNotice(result, 'smoke');
      return;
    }
    if (snapshot.records.length > 0) {
      this.notice.string = '请先核对并撤销今天的真烟记录';
    } else if (snapshot.confirmed && !this.selected) {
      this.cancelTodayQuit(snapshot);
    } else if (!this.selected) {
      this.notice.string = '请先选择“今日确定未抽真烟”';
    } else {
      this.resultNotice(this.store.confirmQuit(this.feeling));
    }
  }

  private cancelTodayQuit(snapshot: QuitSnapshot): void {
    this.confirm('取消今天的记录？',
      '取消后，今天不再计入累计和连续天数；之后仍可重新记录。',
      '取消记录', () => {
        if (this.store.readSnapshot()?.today !== snapshot.today) {
          this.notice.string = '日期已变化，请重新操作';
          this.refresh();
        } else this.resultNotice(this.store.cancelQuit());
      });
  }

  private resultNotice(result: string, action?: HoldAction): void {
    this.notice.string = result === 'saved'
      ? action === 'smoke' ? '已记录一支。记错了可以在下方撤销。' : '已保存'
      : result === 'unchanged' ? '今天的记录没有变化'
      : result === 'conflict' ? action === 'smoke'
        ? '未抽烟确认已变化，请重新长按并确认。' : '今日已有真烟记录，请先核对'
        : '保存失败，请重试';
    const snapshot = this.store.readSnapshot();
    if (snapshot) {
      this.selected = snapshot.confirmed;
      this.feeling = snapshot.feeling;
    }
    this.refresh();
  }

  private confirm(title: string, body: string, confirmText: string, callback: () => void): void {
    this.pending = callback;
    this.overlayTitle.string = title;
    this.overlayBody.string = body;
    this.overlayConfirm.string = confirmText;
    this.overlay.active = true;
  }

  private closeConfirm(): void { this.pending = null; this.overlay.active = false; }
}
