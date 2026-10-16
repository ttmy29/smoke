import { _decorator, BlockInputEvents, Component, EditBox, Graphics, HorizontalTextAlignment,
  Label, Mask, Node, ScrollView, UITransform, Vec2, VerticalTextAlignment, view } from 'cc';
import { color, createLabel, createNode, createRect, DESIGN_HEIGHT, DESIGN_WIDTH } from '../common/UiFactory';
import { UIButton } from '../common/UIButton';
import { QuitStore } from '../persistence/QuitStore';
import { SmokingRecord } from '../persistence/SmokingRecordStore';
import { QuitJournalController } from '../quit/QuitJournalController';
import { QuitTrendController } from '../quit/QuitTrendController';
import { parseRecordsPrice, RECORD_EFFECT_TASKS, RECORD_TABS, recordsDuration,
  RecordsSnapshot, RecordsSource, RecordsTab } from './RecordsModel';

const { ccclass } = _decorator;
const SCALE = DESIGN_WIDTH / 750;
const BG = '#0d0f11';
const GOLD = '#d7a35f';
const MUTED = '#918a81';
const FG = '#ddd6ca';
const LEFT = HorizontalTextAlignment.LEFT;
const RIGHT = HorizontalTextAlignment.RIGHT;
const CENTER = HorizontalTextAlignment.CENTER;
// Creator 3.8.6 keeps an Android scrollIntoView callback for 400ms after focus/touch.
const EDITBOX_RETIRE_DELAY_MS = 500;
const BOLD_TEXT = new Set(['RecordsTitle', 'PanelTitle', 'SummaryValue', 'SavingsTitle', 'SavingsValue', 'TaskName']);

export interface RecordsActions { onBack(): void; onCheckIn(): void; onQuit(price?: boolean): void; }

function dateText(at: number): string {
  const date = new Date(at);
  const pad = (value: number): string => value < 10 ? `0${value}` : String(value);
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function dayText(day: string): string {
  const [year, month, date] = day.split('-').map(Number);
  return `${year} 年 ${month} 月 ${date} 日`;
}
function value(number: number | null): string { return number === null ? '—' : String(number); }

/** V1.0.8 /record-pages/pages/stats/stats; authored prefab supplies the entry only. */
@ccclass('RecordsController')
export class RecordsController extends Component {
  private source!: RecordsSource;
  private actions!: RecordsActions;
  private page!: Node;
  private background!: Node;
  private stage!: Node;
  private nav!: Node;
  private viewport!: Node;
  private content!: Node;
  private scroll!: ScrollView;
  private tabs!: Node;
  private overlay!: Node;
  private toast!: Label;
  private journal!: QuitJournalController;
  private trend!: QuitTrendController;
  private snapshot: RecordsSnapshot | null = null;
  private tab: RecordsTab = 'checkins';
  private height = 0;
  private tabsTop = 0;
  private cursor = 0;
  private quitVisible = 20;
  private priceOpen = false;
  private priceDraft = '';
  private priceError = '';
  private priceInput: EditBox | null = null;
  private priceLayoutHoldUntil = 0;
  private toastRemaining = 0;
  private slide: 'in' | 'out' | null = null;
  private slideTime = 0;

  public get modalOpen(): boolean {
    return this.overlay.active || this.journal.node.active || this.trend.node.active;
  }

  public initialize(source: RecordsSource, quit: QuitStore, actions: RecordsActions): void {
    this.source = source;
    this.actions = actions;
    this.node.addComponent(BlockInputEvents);
    this.page = createNode('RecordsPage', this.node, DESIGN_WIDTH, DESIGN_HEIGHT);
    this.background = createRect('RecordsBackground', this.page, DESIGN_WIDTH, 2400, BG);
    this.stage = createNode('RecordsStage', this.page, 750, 1332);
    this.stage.setScale(SCALE, SCALE, 1);
    this.viewport = createNode('RecordsViewport', this.stage, 750, 1200);
    this.viewport.addComponent(Mask);
    this.scroll = this.viewport.addComponent(ScrollView);
    this.scroll.horizontal = false; this.scroll.vertical = true; this.scroll.elastic = false;
    this.content = createNode('RecordsContent', this.viewport, 750, 1);
    this.content.getComponent(UITransform)!.setAnchorPoint(0.5, 1);
    this.scroll.content = this.content;
    this.tabs = createNode('RecordsTabs', this.stage, 750, 96);
    this.nav = createRect('RecordsNavigation', this.stage, 750, 88, '#101214');
    this.button(this.nav, 'Back', '‹', -320, 0, 88, 80, () => this.beginBack(), false, 44);
    this.text(this.nav, 'NavTitle', '记录', 30, FG, 0, -22, 400, CENTER);
    this.overlay = createNode('SmokingDetailOverlay', this.stage, 750, 1332);
    this.overlay.addComponent(BlockInputEvents);
    this.overlay.addComponent(Graphics);
    this.overlay.active = false;
    this.toast = createLabel('RecordsToast', this.stage, '', 25, '#f2dfc3', 650, 80);
    this.toast.node.active = false;
    const journalNode = createNode('RecordsQuitDetail', this.node, DESIGN_WIDTH, DESIGN_HEIGHT);
    this.journal = journalNode.addComponent(QuitJournalController);
    this.journal.initialize(quit, () => actions.onQuit(), () => actions.onQuit(true), () => this.trend.present());
    const trendNode = createNode('RecordsQuitTrend', this.node, DESIGN_WIDTH, DESIGN_HEIGHT);
    this.trend = trendNode.addComponent(QuitTrendController);
    this.trend.initialize(quit);
    this.node.active = false;
  }

  public present(): void {
    this.tab = 'checkins'; this.quitVisible = 20; this.priceOpen = false;
    this.node.active = true;
    this.overlay.active = false;
    this.journal.dismiss(); this.trend.dismiss();
    this.height = 0; this.resize();
    this.scroll.scrollToTop(0); this.positionTabs();
    this.slide = 'in'; this.slideTime = 0;
    this.page.setPosition(view.getVisibleSize().width, 0);
  }

  public resume(): void { this.node.active = true; this.render(); }

  public dismiss(): void {
    this.retirePriceInput();
    this.slide = null; this.overlay.active = false;
    this.journal?.dismiss(); this.trend?.dismiss();
    this.toastRemaining = 0; this.toast.node.active = false;
    this.node.active = false;
  }

  protected update(dt: number): void {
    this.resize(); this.positionTabs();
    if (this.toastRemaining > 0) {
      this.toastRemaining -= dt;
      if (this.toastRemaining <= 0) this.toast.node.active = false;
    }
    if (!this.slide) return;
    this.slideTime = Math.min(0.3, this.slideTime + Math.max(0, dt));
    const progress = this.slideTime / 0.3;
    const eased = 1 - (1 - progress) ** 3;
    this.page.setPosition(view.getVisibleSize().width * (this.slide === 'in' ? 1 - eased : eased), 0);
    if (progress >= 1) {
      const leaving = this.slide === 'out'; this.slide = null;
      if (leaving) this.actions.onBack();
    }
  }

  private beginBack(): void {
    if (this.slide || this.overlay.active || this.journal.node.active || this.trend.node.active) return;
    this.slide = 'out'; this.slideTime = 0;
  }

  private resize(): void {
    // A keyboard resize must not rebuild the focused EditBox or its native DOM input.
    if (this.priceInput?.isFocused() || Date.now() < this.priceLayoutHoldUntil) return;
    const size = view.getVisibleSize();
    const height = size.height / SCALE;
    if (height === this.height) return;
    this.height = height;
    const transform = this.background.getComponent(UITransform)!;
    transform.setContentSize(size.width, size.height);
    const g = this.background.getComponent(Graphics)!;
    g.clear(); g.fillColor = color(BG); g.rect(-size.width / 2, -size.height / 2, size.width, size.height); g.fill();
    this.stage.getComponent(UITransform)!.setContentSize(750, height);
    this.viewport.getComponent(UITransform)!.setContentSize(750, height - 88);
    this.viewport.setPosition(0, -44);
    this.nav.setPosition(0, height / 2 - 44);
    this.toast.node.setPosition(0, -height / 2 + 100);
    this.overlay.active = false;
    this.render();
  }

  private clear(parent: Node): void {
    let ancestor = this.priceInput?.node.parent;
    while (ancestor) {
      if (ancestor === parent) { this.retirePriceInput(); break; }
      ancestor = ancestor.parent;
    }
    for (const child of [...parent.children]) { child.removeFromParent(); child.destroy(); }
  }

  private retirePriceInput(): void {
    const edit = this.priceInput;
    this.priceInput = null;
    if (!edit?.isValid) return;
    this.priceLayoutHoldUntil = Date.now() + EDITBOX_RETIRE_DELAY_MS;
    edit.blur();
    const input = edit.node;
    input.active = false;
    input.removeFromParent();
    // Disable/hide now, but keep the DOM reference alive until engine callbacks finish.
    setTimeout(() => { if (input.isValid) input.destroy(); }, EDITBOX_RETIRE_DELAY_MS);
  }

  /** Text grows vertically; the page never shrinks its labels to conceal overflow. */
  private text(parent: Node, name: string, copy: string, font: number, tint: string,
    x: number, top: number, width: number, align = LEFT, lineHeight = font * 1.5): number {
    const label = createLabel(name, parent, copy, font, tint, width, 1, x, -top, align);
    label.node.getComponent(UITransform)!.setAnchorPoint(0.5, 1);
    label.verticalAlign = VerticalTextAlignment.TOP;
    label.isBold = BOLD_TEXT.has(name);
    label.lineHeight = Math.ceil(lineHeight);
    label.overflow = Label.Overflow.RESIZE_HEIGHT;
    label.updateRenderData(true);
    return label.node.getComponent(UITransform)!.height;
  }

  private line(parent: Node, top: number, width = 690, x = 0): void {
    createRect('Rule', parent, width, 1, '#2d2f2f', x, -top);
  }

  private button(parent: Node, name: string, copy: string, x: number, y: number,
    width: number, height: number, callback: () => void, filled = true, font = 24): Node {
    const hit = createNode(name, parent, width, height, x, y);
    const face = createRect('Face', hit, width, height, filled ? '#211b14' : BG, 0, 0, filled ? 8 : 0,
      filled ? '#65513a' : undefined);
    const control = UIButton.bind(hit, callback);
    control.visualTarget = face;
    // Capture the optional visual target while keeping the hit rectangle fixed.
    control.refreshFeedback();
    createLabel('Label', face, copy, font, filled ? '#dfb57e' : FG, width - 12, height - 8);
    return hit;
  }

  private plainAction(parent: Node, name: string, x: number, y: number,
    width: number, height: number, callback: () => void): Node {
    const hit = createNode(name, parent, width, height, x, y);
    const visual = createNode('Visual', hit, width, height);
    const control = UIButton.bind(hit, callback);
    control.visualTarget = visual;
    control.refreshFeedback();
    return hit;
  }

  private paintFrame(node: Node, width: number, height: number,
    fill: string, stroke: string, radius = 0): void {
    node.getComponent(UITransform)!.setContentSize(width, height);
    const g = node.getComponent(Graphics) ?? node.addComponent(Graphics);
    const path = (): void => {
      if (radius) g.roundRect(-width / 2, -height / 2, width, height, radius);
      else g.rect(-width / 2, -height / 2, width, height);
    };
    g.clear(); g.fillColor = color(fill); path(); g.fill();
    g.strokeColor = color(stroke); g.lineWidth = 1; path(); g.stroke();
  }

  private statusPill(parent: Node, copy: string, top: number): { width: number; height: number } {
    const pill = createNode('QuitStatus', parent, 1, 1);
    const face = createNode('Background', pill, 1, 1);
    const label = createLabel('Label', pill, copy, 24, '#b8b584', 1, 1);
    label.lineHeight = 29; label.enableWrapText = false; label.overflow = Label.Overflow.NONE;
    label.updateRenderData(true);
    const size = label.node.getComponent(UITransform)!;
    const width = size.width + 26;
    const height = size.height + 14;
    pill.getComponent(UITransform)!.setContentSize(width, height);
    pill.setPosition(341 - width / 2, -top - height / 2);
    this.paintFrame(face, width, height, '#181a16', '#454a3b', height / 2);
    return { width, height };
  }

  private openPriceEditor(s: RecordsSnapshot): void {
    this.priceOpen = true;
    this.priceDraft = s.packPriceCents === null ? '' : (s.packPriceCents / 100).toFixed(2);
    this.priceError = '';
    this.render();
  }

  private savePrice(edit: EditBox): void {
    if (!this.priceOpen || edit !== this.priceInput) return;
    this.priceDraft = edit.string;
    const parsed = parseRecordsPrice(this.priceDraft);
    this.priceError = parsed.error;
    if (!parsed.error && !this.source.setPackPrice(parsed.cents)) this.priceError = '价格没能保存，请重试。';
    if (!this.priceError) { this.priceOpen = false; this.priceDraft = ''; }
    this.render();
  }

  private clearPriceError(panel: Node, background: Node, width: number): void {
    if (panel.parent !== this.content) return;
    const error = panel.getChildByName('PriceError');
    if (!error) return;
    const removed = error.getComponent(UITransform)!.height + 12;
    const errorY = error.position.y;
    const oldHeight = panel.getComponent(UITransform)!.height;
    for (const child of panel.children) {
      if (child !== background && child !== error && child.position.y < errorY) {
        child.setPosition(child.position.x, child.position.y + removed);
      }
    }
    error.removeFromParent(); error.destroy();
    const height = oldHeight - removed;
    panel.getComponent(UITransform)!.setContentSize(width, height);
    this.paintFrame(background, width, height, '#181713', '#49402f');
    background.setPosition(0, -height / 2);
    for (const child of this.content.children) {
      if (child !== panel && child.position.y < panel.position.y - oldHeight) {
        child.setPosition(child.position.x, child.position.y + removed);
      }
    }
    this.cursor -= removed;
    const contentHeight = Math.max(this.height - 88, this.cursor + 52);
    this.content.getComponent(UITransform)!.setContentSize(750, contentHeight);
    const offset = Math.min(this.scroll.getScrollOffset().y, contentHeight - this.height + 88);
    this.scroll.stopAutoScroll();
    this.scroll.scrollToOffset(new Vec2(0, Math.max(0, offset)), 0);
  }

  private heading(title: string, note: string, count = ''): void {
    const top = this.cursor + 24;
    const titleHeight = this.text(this.content, 'PanelTitle', title, 30, '#d8d1c6', -95, top, 482);
    const noteHeight = this.text(this.content, 'PanelNote', note, 23, MUTED, -95, top + titleHeight + 8, 482);
    if (count) this.text(this.content, 'PanelCount', count, 24, GOLD, 260, top + 8, 160, RIGHT);
    this.cursor = Math.max(this.cursor + 118, top + titleHeight + 8 + noteHeight + 18);
    this.line(this.content, this.cursor);
  }

  private summary(values: Array<[string, string]>, top: number, width = 690, height = 112): number {
    const cell = width / values.length;
    values.forEach(([number, label], index) => {
      const x = -width / 2 + cell * (index + 0.5);
      const valueHeight = this.text(this.content, 'SummaryValue', number, values.length === 4 ? 42 : 34,
        GOLD, x, top + 17, cell - 12, CENTER);
      const labelTop = top + 17 + valueHeight + 7;
      const labelHeight = this.text(this.content, 'SummaryLabel', label, 22, MUTED, x, labelTop, cell - 8, CENTER);
      height = Math.max(height, labelTop - top + labelHeight + 20);
    });
    this.line(this.content, top, width); this.line(this.content, top + height, width);
    for (let index = 1; index < values.length; index++) createRect('SummaryDivider', this.content,
      1, height, '#343433', -width / 2 + cell * index, -top - height / 2);
    return height;
  }

  private render(offset = this.scroll?.getScrollOffset().y ?? 0): void {
    if (!this.content || !this.height) return;
    this.snapshot = this.source.read();
    this.clear(this.content); this.clear(this.tabs);
    this.cursor = 44;
    this.text(this.content, 'RecordsTitle', '赛博记录', 58, FG, -110, this.cursor, 470, LEFT, 63);
    if (this.snapshot) this.text(this.content, 'Tickets', `▣ ${this.snapshot.ticketBalance}`, 29, GOLD,
      270, this.cursor + 16, 150, RIGHT);
    this.cursor += 81;
    this.cursor += this.text(this.content, 'Subtitle', '线上体验按操作统计，线下抽烟与未抽烟由你如实记录。',
      24, '#9a938a', -35, this.cursor, 620, LEFT, 40);
    if (!this.snapshot) {
      this.tabs.active = false;
      this.cursor += 42;
      this.empty('记录暂时读不出来', '当前数据没有被修改。请稍后重新打开本页。');
    } else {
      const s = this.snapshot;
      this.cursor += 42;
      this.cursor += this.summary([[value(s.todayCount), '今天'], [value(s.last7Count), '近7天'], [String(s.totalCount), '全部'],
        [value(s.completedPacks), '完整抽完盒数']], this.cursor, 690, 142);
      this.cursor += 26;
      const aggregate = createRect('AggregatePanel', this.content, 690, 128, '#151719', 0, -this.cursor - 64, 24, '#343536');
      [[value(s.totalPuffs), '累计口数'], [recordsDuration(s.durationSeconds), '抽烟时间'], [s.favoritePack, '常用烟盒']]
        .forEach(([number, caption], index) => {
          const x = (index - 1) * 220;
          this.text(aggregate, 'Caption', caption, 22, MUTED, x, -39, 208, CENTER);
          this.text(aggregate, 'Value', number, 25, '#d7d0c5', x, 2, 208, CENTER);
          if (index) createRect('AggregateDivider', aggregate, 1, 62, '#3a3b3c', x - 110);
        });
      this.cursor += 166;
      this.tabsTop = this.cursor;
      this.tabs.active = true;
      createRect('TabsBackground', this.tabs, 750, 96, BG);
      RECORD_TABS.forEach((item, index) => {
        const x = (index - 2) * 138;
        const hit = this.button(this.tabs, item.id, item.label, x, 0, 138, 96, () => {
          if (this.tab === item.id || this.slide || this.overlay.active) return;
          this.tab = item.id;
          this.render(Math.min(this.scroll.getScrollOffset().y, this.tabsTop));
        }, false, 26);
        hit.getChildByName('Face')!.getChildByName('Label')!.getComponent(Label)!.color = color(this.tab === item.id ? '#e0ad6d' : '#928b82');
        if (this.tab === item.id) createRect('Selected', hit, 90, 4, '#d39b58', 0, -46, 2);
      });
      createRect('TabsRule', this.tabs, 750, 1, '#41413f', 0, -48);
      this.cursor += 96;
      if (this.tab === 'checkins') this.checkins(s);
      else if (this.tab === 'smoking') this.smoking(s);
      else if (this.tab === 'quit') this.quitting(s);
      else if (this.tab === 'tasks') this.tasks(s);
      else this.tickets(s);
    }
    const height = Math.max(this.height - 88, this.cursor + 52);
    this.content.getComponent(UITransform)!.setContentSize(750, height);
    this.content.setPosition(0, (this.height - 88) / 2);
    this.scroll.stopAutoScroll();
    this.scroll.scrollToOffset(new Vec2(0, Math.max(0, Math.min(offset, height - this.height + 88))), 0);
    this.positionTabs();
  }

  private positionTabs(): void {
    if (!this.tabs?.active) return;
    const top = Math.min(this.height / 2 - 88,
      this.height / 2 - 88 - this.tabsTop + this.scroll.getScrollOffset().y);
    this.tabs.setPosition(0, top - 48);
  }

  private empty(title: string, copy: string, action?: { label: string; run(): void }): void {
    this.cursor += 28;
    const height = action ? 320 : 240;
    const panel = createRect('EmptyPanel', this.content, 690, height, '#151719', 0, -this.cursor - height / 2, 24, '#343536');
    this.text(panel, 'Title', title, 29, FG, 0, -height / 2 + 52, 620, CENTER);
    this.text(panel, 'Copy', copy, 23, '#9a938a', 0, -height / 2 + 108, 620, CENTER, 36);
    if (action) this.button(panel, 'EmptyAction', action.label, 0, -height / 2 + 62, 400, 88, action.run);
    this.cursor += height;
  }

  private note(copy: string): void {
    this.cursor += 20;
    this.cursor += this.text(this.content, 'Note', copy, 23, MUTED, 0, this.cursor, 682, LEFT, 36) + 20;
  }

  private checkins(s: RecordsSnapshot): void {
    this.heading('打卡记录', '每天最多一次，打卡后本机烟票增加 1 张。');
    this.button(this.content, 'OpenCheckIn', s.checkedToday ? '今日已打卡' : '去打卡', 247,
      -this.cursor + 62, 180, 88, () => this.actions.onCheckIn());
    this.cursor += this.summary([[String(s.cumulativeDays), '累计打卡'], [String(s.checkinStreak), '当前连续 / 天']], this.cursor);
    const logs = s.ledger.filter((entry) => entry.reason === 'daily-checkin');
    for (const entry of logs) {
      this.text(this.content, 'CheckinDay', `${dayText(entry.day)} 打卡`, 25, '#d7d0c5', -75, this.cursor + 20, 540);
      this.text(this.content, 'CheckinTime', dateText(entry.at).slice(6), 22, MUTED, -75, this.cursor + 65, 540);
      this.text(this.content, 'Reward', '+1 张', 27, GOLD, 278, this.cursor + 36, 120, RIGHT);
      this.cursor += 112; this.line(this.content, this.cursor);
    }
    if (!logs.length) this.empty('还没有打卡记录', '今天打一次卡，就会在这里留下第一条记录。');
    if (s.ledgerIncomplete || s.ledgerArchived) this.note('部分早期打卡没有时间明细，以上只展示本机已保存的记录。');
  }

  private smoking(s: RecordsSnapshot): void {
    this.savings(s);
    this.heading('抽烟记录', '最近完成的 30 根，点开可查看这根烟的配置。', `${s.sessions.length} 条`);
    for (const record of s.sessions) {
      const hit = createNode('SmokingRow', this.content, 682, 128, 0, -this.cursor - 64);
      this.text(hit, 'Pack', '王溪', 25, '#d6cfc4', -105, -43, 460);
      this.text(hit, 'Meta', `${dateText(record.endedAt)} · ${record.outcome === 'finished' ? '抽到烟尾' : '提前熄灭'} · 烟位 ${record.slotIndex + 1}`,
        22, MUTED, -105, 0, 460);
      this.text(hit, 'Puffs', `${record.puffs} 口`, 25, GOLD, 244, -35, 150, RIGHT);
      this.text(hit, 'Duration', recordsDuration(record.durationSeconds), 22, MUTED, 244, 8, 150, RIGHT);
      UIButton.bind(hit, () => this.showSmokingDetail(record));
      this.cursor += 128; this.line(this.content, this.cursor);
    }
    if (!s.sessions.length) this.empty('还没有赛博记录', '回到首页点“来一根”，直接抽当前盒。',
      { label: '回首页抽一根', run: () => this.actions.onBack() });
    if (s.smokingIncomplete) this.note('早期累计根数缺少逐根明细，未补造记录；“—”表示统计尚不完整。');
  }

  private savings(s: RecordsSnapshot): void {
    const top = this.cursor + 28;
    const width = 682;
    const inner = width - 52 - 2;
    const panel = createNode('Savings', this.content, width, 1, 0, -top);
    const bg = createNode('Background', panel, width, 1);
    let cursor = 28;
    const titleHeight = this.text(panel, 'SavingsTitle', '烟费估算', 27, '#d8d1c6',
      -54, cursor, inner - 108);
    const headingHeight = Math.max(titleHeight, 64); // 44px edit hit area with -12rpx vertical margins.
    panel.getChildByName('SavingsTitle')!.setPosition(-54, -cursor - (headingHeight - titleHeight) / 2);
    const editHit = this.plainAction(panel, 'EditPrice', inner / 2 - 44,
      -cursor - headingHeight / 2, 88, 88, () => this.openPriceEditor(s));
    const pencil = createNode('Pencil', editHit.getChildByName('Visual')!, 18, 40);
    pencil.setRotationFromEuler(0, 0, -40);
    const pen = pencil.addComponent(Graphics);
    pen.strokeColor = color('#d8aa69'); pen.fillColor = color('#d8aa69'); pen.lineWidth = 2;
    pen.rect(-3.5, -12, 7, 24); pen.stroke();
    pen.moveTo(-3.5, 8); pen.lineTo(3.5, 8); pen.stroke();
    pen.moveTo(-5, -14); pen.lineTo(5, -14); pen.lineTo(0, -21); pen.close(); pen.fill();
    cursor += headingHeight + 24;

    // The values stay above all three lower states: unset price, editor, and saved price.
    const valuesTop = cursor;
    const cells: Array<[string, string]> = [[value(s.savingsCount), '赛博抽烟 / 根'],
      [s.estimatedSavedCents === null ? '—' : `¥${(s.estimatedSavedCents / 100).toFixed(2)}`, '烟费折算']];
    let valuesHeight = 0;
    cells.forEach(([number, caption], index) => {
      const x = (index - 0.5) * inner / 2;
      const align = index === 0 ? LEFT : RIGHT;
      const numberHeight = this.text(panel, 'SavingsValue', number, 38, '#d8aa69', x,
        valuesTop + 24, inner / 2 - 20, align);
      const captionHeight = this.text(panel, 'SavingsLabel', caption, 24, '#928b82', x,
        valuesTop + 24 + numberHeight + 7, inner / 2 - 20, align);
      valuesHeight = Math.max(valuesHeight, 24 + numberHeight + 7 + captionHeight + 24);
    });
    createRect('ValuesTopRule', panel, inner, 1, '#39362e', 0, -valuesTop);
    createRect('ValuesBottomRule', panel, inner, 1, '#39362e', 0, -valuesTop - valuesHeight);
    createRect('ValuesDivider', panel, 1, valuesHeight, '#39362e', 0, -valuesTop - valuesHeight / 2);
    cursor += valuesHeight;

    if (this.priceOpen) {
      cursor += 24;
      cursor += this.text(panel, 'PriceLabel', '单盒价格', 24, '#d8d1c6', 0, cursor, inner) + 14;
      const field = createNode('PriceInputRow', panel, inner, 96, 0, -cursor - 48);
      this.paintFrame(field, inner, 96, '#101211', '#746045');
      const inputWidth = inner - 40 - 18 - 88 - 28;
      const input = createNode('PriceInput', field, inputWidth, 96, -inner / 2 + 20 + 18 + 14 + inputWidth / 2);
      // Set the mode and configure its own labels before __preload creates the DOM input.
      input.active = false;
      this.text(field, 'Currency', '¥', 24, '#d8aa69', -inner / 2 + 29, -18, 18);
      this.text(field, 'Unit', '元 / 盒', 24, '#aaa298', inner / 2 - 64, -18, 88, RIGHT);
      const edit = input.addComponent(EditBox);
      edit.inputMode = EditBox.InputMode.DECIMAL;
      edit.returnType = EditBox.KeyboardReturnType.DONE;
      edit.maxLength = 8;
      const inputLabel = (name: string, tint: string): Label => {
        // inputMode's setter already creates these labels even while the node is inactive.
        const label = input.getChildByName(name)?.getComponent(Label)
          ?? createLabel(name, input, '', 32, tint, inputWidth - 2, 96, 0, 0, LEFT);
        label.fontSize = 32;
        label.color = color(tint);
        label.horizontalAlign = LEFT;
        // EditBox positions labels by their top-left corner, unlike normal centered labels.
        label.node.getComponent(UITransform)!.setAnchorPoint(0, 1);
        label.verticalAlign = VerticalTextAlignment.CENTER;
        label.lineHeight = 44;
        label.overflow = Label.Overflow.CLAMP;
        label.enableWrapText = false;
        return label;
      };
      edit.textLabel = inputLabel('TEXT_LABEL', '#e0b577');
      edit.placeholderLabel = inputLabel('PLACEHOLDER_LABEL', MUTED);
      edit.placeholder = '例如 20';
      edit.string = this.priceDraft;
      this.priceInput = edit;
      input.on(EditBox.EventType.EDITING_DID_BEGAN, () => {
        this.priceLayoutHoldUntil = Date.now() + EDITBOX_RETIRE_DELAY_MS;
        // The event precedes DOM focus/style setup; apply browser overrides afterwards.
        Promise.resolve().then(() => {
          if (typeof document === 'undefined' || this.priceInput !== edit || !edit.isFocused()) return;
          const nativeInput = document.activeElement as HTMLInputElement | null;
          if (!nativeInput || nativeInput.tagName !== 'INPUT' || !nativeInput.classList.contains('cocosEditBox')) return;
          nativeInput.type = 'text';
          nativeInput.inputMode = 'decimal';
          nativeInput.setAttribute('enterkeyhint', 'done');
          nativeInput.style.boxSizing = 'border-box';
          nativeInput.style.width = `${inputWidth - 2}px`;
          nativeInput.style.height = '96px';
          nativeInput.style.border = '0';
          nativeInput.style.outline = 'none';
          nativeInput.style.boxShadow = 'none';
          nativeInput.style.padding = '0';
          nativeInput.style.margin = '0';
          nativeInput.style.background = 'transparent';
          nativeInput.style.lineHeight = '96px';
          nativeInput.style.caretColor = '#e0b577';
        });
      });
      input.on(EditBox.EventType.EDITING_DID_ENDED, () => {
        this.priceLayoutHoldUntil = Date.now() + EDITBOX_RETIRE_DELAY_MS;
      });
      input.on(EditBox.EventType.TEXT_CHANGED, () => {
        if (this.priceInput !== edit) return;
        this.priceDraft = edit.string; this.priceError = '';
        this.clearPriceError(panel, bg, width);
      });
      input.on(EditBox.EventType.EDITING_RETURN, () => this.savePrice(edit));
      input.active = true;
      cursor += 96;
      if (this.priceError) {
        cursor += 12;
        cursor += this.text(panel, 'PriceError', this.priceError, 24, '#e69a82', 0, cursor, inner);
      }
      cursor += 20;
      cursor += this.text(panel, 'PriceHelp', '每盒按 20 根折算；留空保存可取消估算。', 24, '#928b82',
        0, cursor, inner, LEFT, 39);
      cursor += 22;
      const buttonWidth = (inner - 20) / 2;
      const cancel = this.button(panel, 'Cancel', '取消', -(buttonWidth + 20) / 2, -cursor - 44, buttonWidth, 88, () => {
        this.priceOpen = false; this.priceDraft = ''; this.priceError = '';
        this.render();
      });
      this.paintFrame(cancel.getChildByName('Face')!, buttonWidth, 88, '#211b14', '#65513a', 8);
      const save = this.button(panel, 'Save', '保存价格', (buttonWidth + 20) / 2, -cursor - 44,
        buttonWidth, 88, () => this.savePrice(edit));
      const saveFace = save.getChildByName('Face')!;
      this.paintFrame(saveFace, buttonWidth, 88, '#d4a160', '#65513a', 8);
      saveFace.getChildByName('Label')!.getComponent(Label)!.color = color('#22180d');
      cursor += 88;
    } else if (s.packPriceCents === null) {
      cursor += 20;
      cursor += this.text(panel, 'PriceEmpty', '填入单盒价格，按全部赛博抽烟根数估算烟费。',
        24, '#928b82', 0, cursor, inner, LEFT, 39);
      cursor += 22;
      const start = this.button(panel, 'StartPrice', '填写单盒价格', 0, -cursor - 44, inner, 88,
        () => this.openPriceEditor(s));
      this.paintFrame(start.getChildByName('Face')!, inner, 88, '#211b14', '#65513a', 8);
      cursor += 88;
    } else {
      cursor += 20;
      cursor += this.text(panel, 'Price', `每盒 ¥${(s.packPriceCents / 100).toFixed(2)} · 按 20 根折算`,
        24, '#aaa298', 0, cursor, inner);
      cursor += 20;
      cursor += this.text(panel, 'Formula', '线上根数 × 真烟单盒价格 ÷ 20，不代表线下实际节省。',
        24, '#928b82', 0, cursor, inner, LEFT, 39);
    }
    const height = cursor + 28;
    panel.getComponent(UITransform)!.setContentSize(width, height);
    this.paintFrame(bg, width, height, '#181713', '#49402f'); bg.setPosition(0, -height / 2);
    this.cursor = top + height + 8;
  }

  private quitting(s: RecordsSnapshot): void {
    this.heading('戒烟记录', '真实吸烟与未抽烟确认，按日期一起回看。');
    this.button(this.content, 'Today', '记录今天', 247, -this.cursor + 62, 180, 88, () => this.actions.onQuit());
    this.cursor += this.summary([[String(s.quitTotal), '未抽烟 / 天'], [String(s.quitStreak), '当前连续 / 天'],
      [String(s.quitLongest), '最长连续 / 天']], this.cursor);
    this.cursor += 16;
    this.cursor += this.text(this.content, 'QuitSummaryNote', '以上天数仅统计明确确认未抽烟的日期',
      24, '#aaa299', 0, this.cursor, 682, LEFT, 39);
    this.cursor += 14;
    const trend = this.plainAction(this.content, 'QuitTrend', 0, -this.cursor - 50, 682, 100, () => this.trend.present());
    const trendVisual = trend.getChildByName('Visual')!;
    this.text(trendVisual, 'TrendLabel', '查看吸烟与烟费趋势', 27, GOLD, -54, -19, 574, LEFT, 38);
    this.text(trendVisual, 'TrendHint', '折线图', 24, '#aaa299', 293, -17, 96, RIGHT, 34);
    this.line(trendVisual, 50, 682);
    this.cursor += 100;
    for (const row of s.quitDays.slice(0, this.quitVisible)) {
      const top = this.cursor;
      const hit = this.plainAction(this.content, 'QuitDay', 0, -top, 682, 1,
        () => { if (!this.journal.presentDay(row.day)) this.notify('这条记录暂时读不出来，请重试'); });
      const visual = hit.getChildByName('Visual')!;
      const status = this.statusPill(visual, row.count ? `已抽 ${row.count} 支` : '未抽真烟', 24);
      const copyWidth = 682 - status.width - 20;
      const copyX = -341 + copyWidth / 2;
      const dateHeight = this.text(visual, 'Date', dayText(row.day), 25, '#d7d0c5', copyX, 24, copyWidth, LEFT, 34);
      visual.getChildByName('Date')!.getComponent(Label)!.isBold = true;
      const timeHeight = this.text(visual, 'Time', `${dateText(row.at).slice(6)} ${row.count ? '最近记录' : '确认'}${
        !row.count && row.updated ? ' · 感受已更新' : ''}`, 24, MUTED, copyX, 24 + dateHeight + 7, copyWidth, LEFT, 33);
      const mainHeight = Math.max(dateHeight + 7 + timeHeight, status.height);
      let height = 24 + mainHeight;
      const copy = row.count ? row.costCents === null ? '设置烟价，计算烟费'
        : `烟费估算 ¥${(Math.round(row.costCents) / 100).toFixed(2)}`
        : row.feeling.replace(/\s+/g, ' ').trim() || '这次没有填写感受';
      if (row.count && row.costCents === null) {
        height += 8;
        const link = this.plainAction(visual, 'Price', 0, -height - 44, 682, 88, () => this.actions.onQuit(true));
        const linkVisual = link.getChildByName('Visual')!;
        this.text(linkVisual, 'PriceLink', copy, 25, GOLD, 0, -17, 682, LEFT, 34);
        linkVisual.getChildByName('PriceLink')!.getComponent(Label)!.isUnderline = true;
        height += 88;
      } else {
        height += 16;
        const measured = this.text(visual, 'Feeling', copy, 24,
          row.count || row.feeling.trim() ? '#aaa299' : '#827c74', 0, height, 682, LEFT, 38);
        const textHeight = Math.min(measured, 76);
        const feeling = visual.getChildByName('Feeling')!;
        feeling.getComponent(Label)!.overflow = Label.Overflow.CLAMP;
        feeling.getComponent(UITransform)!.setContentSize(682, textHeight);
        height += textHeight;
      }
      height = Math.max(116, height + 24);
      hit.getComponent(UITransform)!.setContentSize(682, height);
      hit.setPosition(0, -top - height / 2);
      visual.getComponent(UITransform)!.setContentSize(682, height);
      visual.setPosition(0, height / 2);
      this.cursor += height; this.line(this.content, this.cursor);
    }
    if (!s.quitDays.length) this.empty('还没有戒烟日志', '抽过真烟就记一支，确定未抽就确认今天。',
      { label: '去记录今天', run: () => this.actions.onQuit() });
    if (s.quitDays.length > this.quitVisible) {
      this.cursor += 20;
      const more = this.plainAction(this.content, 'MoreDays', 0, -this.cursor - 44, 682, 88,
        () => { this.quitVisible += 20; this.render(); });
      this.text(more.getChildByName('Visual')!, 'MoreLabel', '查看更多日期', 26, GOLD, 0, -18, 682, CENTER, 36);
      this.cursor += 88;
    }
  }

  private tasks(s: RecordsSnapshot): void {
    this.heading('特效任务', '达标后点击「完成」，永久解锁对应烟灰与烟圈。',
      `已完成 ${s.completedTasks.length}/${RECORD_EFFECT_TASKS.length}`);
    this.note('选择或更换特效仍需今日编辑权限。');
    for (const task of RECORD_EFFECT_TASKS) {
      const top = this.cursor + 40;
      const completed = s.completedTasks.indexOf(task.id) >= 0;
      const ready = !completed && task.goals.every((goal) => (s.taskMetrics[goal.metric] ?? -1) >= goal.target);
      const row = createNode(task.id, this.content, 682, 1, 0, -top);
      let height = this.text(row, 'TaskName', task.name, 30, '#d5cec3', -100, 0, 480);
      if (ready) this.button(row, 'Complete', '完成', 270, -36, 136, 88, () => {
        if (!this.source.completeTask) { this.notify('特效奖励暂未开放'); return; }
        if (this.source.completeTask(task.id)) { this.render(); this.notify('烟灰与烟圈已解锁'); }
        else this.notify('完成失败，请重试');
      }, true, 28);
      else this.text(row, 'Status', completed ? '已完成' : '进行中', 22, '#c49d72', 260, 8, 160, RIGHT);
      height += 16;
      height += this.text(row, 'Reward', task.reward, 28, '#dcc09b', 0, height, 682);
      height += 24;
      for (const goal of task.goals) {
        const current = s.taskMetrics[goal.metric];
        this.text(row, 'Goal', goal.label, 26, '#aaa399', -120, height, 442);
        this.text(row, 'GoalValue', `${current === undefined ? '—' : current}/${goal.target}${goal.metric === 'days'
          || goal.metric === 'handDays' ? '天' : '次'}`, 26, '#d5c6b1', 260, height, 162, RIGHT);
        height += 51;
      }
      const progress = Math.min(...task.goals.map((goal) => Math.min(1, (s.taskMetrics[goal.metric] ?? 0) / goal.target)));
      createRect('Track', row, 682, 6, '#2d2f31', 0, -height - 12, 3);
      if (progress > 0) createRect('Progress', row, 682 * progress, 6, completed ? '#aaa36d' : '#bd7045',
        -341 + 341 * progress, -height - 12, 3);
      this.cursor = top + height + 52; this.line(this.content, this.cursor);
    }
    this.note('累计打卡进度已同步；其他任务进度与特效奖励暂未开放。');
  }

  private tickets(s: RecordsSnapshot): void {
    this.heading('烟票流水', '本机最近的烟票收入与使用记录。', `${s.ticketBalance} 张`);
    for (const entry of s.ledger) {
      const reason = entry.reason === 'daily-checkin' ? '每日打卡' : entry.reason === 'checkin-ad-bonus' ? '打卡广告额外烟票' : '补一盒';
      this.text(this.content, 'Reason', reason, 25, '#d6cfc4', -75, this.cursor + 20, 540);
      this.text(this.content, 'Date', dateText(entry.at), 22, MUTED, -75, this.cursor + 65, 540);
      this.text(this.content, 'Delta', entry.delta > 0 ? `+${entry.delta}` : String(entry.delta), 27,
        entry.delta > 0 ? GOLD : '#cf8a77', 278, this.cursor + 36, 120, RIGHT);
      this.cursor += 112; this.line(this.content, this.cursor);
    }
    if (!s.ledger.length) this.note('还没有烟票流水。');
    if (s.ledgerIncomplete) this.note('早期余额或初始配置没有对应流水，以上仅展示实际保存的收入与使用记录。');
    if (s.ledgerArchived) this.note('仅保留最近 200 条流水，更早明细不影响本机余额。');
  }

  private notify(copy: string): void {
    this.toast.string = copy; this.toast.node.active = true; this.toastRemaining = 2.5;
  }

  private showSmokingDetail(record: SmokingRecord): void {
    this.clear(this.overlay);
    this.overlay.active = true;
    this.overlay.getComponent(UITransform)!.setContentSize(750, this.height);
    const g = this.overlay.getComponent(Graphics)!;
    g.clear(); g.fillColor = color('#040506', Math.round(255 * 0.86));
    g.rect(-375, -this.height / 2, 750, this.height); g.fill();
    const height = Math.min(this.height - 48, 1100);
    const card = createRect('DetailPanel', this.overlay, 702, height, '#181a1a', 0, 0, 14, '#4d4944');
    this.text(card, 'Title', '抽烟记录详情', 31, '#ebe2d5', -60, -height / 2 + 30, 480);
    this.button(card, 'Close', '关闭', 277, height / 2 - 62, 88, 88, () => { this.overlay.active = false; });
    const viewport = createNode('DetailViewport', card, 642, height - 140, 0, -46);
    viewport.addComponent(Mask);
    const scroll = viewport.addComponent(ScrollView); scroll.horizontal = false; scroll.elastic = false;
    const body = createNode('DetailBody', viewport, 642, 1);
    body.getComponent(UITransform)!.setAnchorPoint(0.5, 1); scroll.content = body;
    let top = 0;
    const label = (name: string, copy: string, font: number, tint: string): void => {
      top += this.text(body, name, copy, font, tint, 0, top, 642) + 22;
    };
    label('Pack', '王溪 · 来自「王溪」烟盒', 30, '#e2d8ca');
    label('Date', dateText(record.endedAt), 24, '#b3a79a');
    label('Outcome', `${record.outcome === 'finished' ? '抽到烟尾' : '提前熄灭'} · 烟位 ${record.slotIndex + 1}`, 23, '#b5a99b');
    const stick = createRect('Cigarette', body, 32, 94, '#e7e1d6', -275, -top - 47, 8, '#8e8373');
    createRect('Filter', stick, 32, 32, '#bf7736', 0, -31);
    this.text(body, 'Appearance', '保留这根烟抽烟时的外观与特效', 24, '#d9c5ae', 38, top + 12, 550);
    top += 128;
    label('ReadOnly', '仅查看', 25, '#dfb785');
    label('Numbers', `${record.puffs} 口 · ${recordsDuration(record.durationSeconds)}\n弹灰 ${record.ashFlicks} 次 · 吐圈 ${record.rings} 次`, 25, FG);
    label('Effects', '烟灰：自然落灰\n烟圈：圆形\n吐雾方式：标准\n环境：默认背景', 24, '#c1b8a8');
    body.getComponent(UITransform)!.setContentSize(642, top);
    body.setPosition(0, (height - 140) / 2); scroll.scrollToTop(0);
  }
}
