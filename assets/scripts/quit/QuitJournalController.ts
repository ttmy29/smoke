import { _decorator, BlockInputEvents, Button, Component, Graphics,
  HorizontalTextAlignment, Label, Mask, Node, ScrollView, UITransform,
  VerticalTextAlignment, view } from 'cc';
import { color, createLabel, createNode, createRect, DESIGN_WIDTH } from '../common/UiFactory';
import { QuitDay, QuitStore, RealRecord } from '../persistence/QuitStore';

const { ccclass } = _decorator;
type Palette = { bg: string; surface: string; fg: string; muted: string;
  rule: string; accent: string };
const DARK: Palette = { bg: '#101213', surface: '#1b1d1e', fg: '#f5f4f0',
  muted: '#b6b8ba', rule: '#36393b', accent: '#f5f4f0' };
const LIGHT: Palette = { bg: '#f5f4f0', surface: '#eae9e5', fg: '#161819',
  muted: '#606467', rule: '#c9cbcc', accent: '#161819' };
type DayRow = { day: string; records: RealRecord[]; quit: QuitDay | null;
  costCents: number | null };

function localDay(at: number): string {
  const date = new Date(at);
  const two = (value: number): string => value < 10 ? `0${value}` : String(value);
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
}

function clock(at: number): string {
  const date = new Date(at);
  const two = (value: number): string => value < 10 ? `0${value}` : String(value);
  return `${two(date.getHours())}:${two(date.getMinutes())}`;
}

function dayText(day: string): string {
  const [year, month, date] = day.split('-').map(Number);
  return `${year} 年 ${month} 月 ${date} 日`;
}

@ccclass('QuitJournalController')
export class QuitJournalController extends Component {
  private store!: QuitStore;
  private onToday!: () => void;
  private onPrice!: () => void;
  private onTrend!: () => void;
  private background!: Node;
  private nav!: Node;
  private navBackground!: Node;
  private navBack!: Label;
  private navTitle!: Label;
  private viewport!: Node;
  private scroll!: ScrollView;
  private content!: Node;
  private detail!: Node;
  private detailBackground!: Node;
  private detailNav!: Node;
  private detailNavBackground!: Node;
  private detailBack!: Label;
  private detailNavTitle!: Label;
  private detailViewport!: Node;
  private detailScroll!: ScrollView;
  private detailContent!: Node;
  private detailDay: string | null = null;
  private detailVisible = 20;
  private detailSlide: 'in' | 'out' | null = null;
  private detailSlideTime = 0;
  private visible = 20;
  private height = 0;
  private slide: 'in' | 'out' | null = null;
  private slideTime = 0;
  private static readonly SLIDE_SECONDS = 0.3;

  public initialize(store: QuitStore, onToday: () => void,
    onPrice: () => void, onTrend: () => void): void {
    this.store = store;
    this.onToday = onToday;
    this.onPrice = onPrice;
    this.onTrend = onTrend;
    this.build();
  }

  public present(): void {
    this.visible = 20;
    this.detail.active = false;
    this.detailDay = null;
    this.detailSlide = null;
    this.node.active = true;
    this.render();
    this.resize();
    this.scroll.scrollToTop(0);
    this.node.setPosition(view.getVisibleSize().width, 0);
    this.slide = 'in';
    this.slideTime = 0;
  }

  public dismiss(): void {
    this.slide = null;
    this.node.active = false;
    this.detail.active = false;
    this.detailDay = null;
    this.detailSlide = null;
  }

  public close(): void {
    if (this.slide || !this.node.active) return;
    if (this.detail.active) { this.closeDetail(); return; }
    this.slide = 'out';
    this.slideTime = 0;
  }

  protected update(dt: number): void {
    if (!this.node.active) return;
    this.resize();
    if (this.slide) {
      this.slideTime = Math.min(QuitJournalController.SLIDE_SECONDS,
        this.slideTime + Math.max(0, dt));
      const progress = this.slideTime / QuitJournalController.SLIDE_SECONDS;
      const eased = 1 - (1 - progress) ** 3;
      this.node.setPosition(view.getVisibleSize().width *
        (this.slide === 'in' ? 1 - eased : eased), 0);
      if (progress >= 1) {
        const leaving = this.slide === 'out';
        this.slide = null;
        if (leaving) this.dismiss();
      }
    }
    if (this.detailSlide) {
      this.detailSlideTime = Math.min(QuitJournalController.SLIDE_SECONDS,
        this.detailSlideTime + Math.max(0, dt));
      const progress = this.detailSlideTime / QuitJournalController.SLIDE_SECONDS;
      const eased = 1 - (1 - progress) ** 3;
      this.detail.setPosition(view.getVisibleSize().width *
        (this.detailSlide === 'in' ? 1 - eased : eased), 0);
      if (progress >= 1) {
        const leaving = this.detailSlide === 'out';
        this.detailSlide = null;
        if (leaving) { this.detail.active = false; this.detailDay = null; }
      }
    }
  }

  private build(): void {
    this.node.addComponent(BlockInputEvents);
    this.background = createRect('JournalBackground', this.node, DESIGN_WIDTH, 2400, DARK.bg);
    this.viewport = createNode('JournalViewport', this.node, DESIGN_WIDTH, 1000);
    this.viewport.addComponent(Mask);
    this.scroll = this.viewport.addComponent(ScrollView);
    this.scroll.horizontal = false;
    this.scroll.vertical = true;
    this.scroll.elastic = false;
    this.content = createNode('JournalContent', this.viewport, DESIGN_WIDTH, 1500);
    this.scroll.content = this.content;
    this.nav = createNode('JournalNavigation', this.node, DESIGN_WIDTH, 128);
    this.navBackground = createRect('JournalNavigationBackground', this.nav,
      DESIGN_WIDTH, 128, DARK.bg);
    const back = createNode('JournalBack', this.nav, 88, 88, -331, -12);
    back.addComponent(Button).transition = Button.Transition.NONE;
    this.navBack = createLabel('JournalBackText', back, '‹', 48, DARK.fg, 80, 78);
    back.on(Button.EventType.CLICK, () => this.close());
    this.navTitle = createLabel('JournalNavigationTitle', this.nav, '戒烟日志',
      34, DARK.fg, 280, 56, 0, -12);
    this.detail = createNode('JournalDetailPage', this.node, DESIGN_WIDTH, 1600);
    this.detail.addComponent(BlockInputEvents);
    this.detailBackground = createRect('DetailBackground', this.detail,
      DESIGN_WIDTH, 2400, DARK.bg);
    this.detailViewport = createNode('DetailViewport', this.detail,
      DESIGN_WIDTH, 1000);
    this.detailViewport.addComponent(Mask);
    this.detailScroll = this.detailViewport.addComponent(ScrollView);
    this.detailScroll.horizontal = false;
    this.detailScroll.vertical = true;
    this.detailScroll.elastic = false;
    this.detailContent = createNode('DetailContent', this.detailViewport,
      DESIGN_WIDTH, 1200);
    this.detailScroll.content = this.detailContent;
    this.detailNav = createNode('DetailNavigation', this.detail, DESIGN_WIDTH, 128);
    this.detailNavBackground = createRect('DetailNavigationBackground', this.detailNav,
      DESIGN_WIDTH, 128, DARK.bg);
    const detailBack = createNode('DetailBack', this.detailNav, 88, 88, -331, -12);
    detailBack.addComponent(Button).transition = Button.Transition.NONE;
    this.detailBack = createLabel('DetailBackText', detailBack, '‹',
      48, DARK.fg, 80, 78);
    detailBack.on(Button.EventType.CLICK, () => this.closeDetail());
    this.detailNavTitle = createLabel('DetailNavigationTitle', this.detailNav,
      '戒烟记录详情', 34, DARK.fg, 340, 56, 0, -12);
    this.detail.active = false;
    this.node.active = false;
  }

  private resize(): void {
    const height = view.getVisibleSize().height;
    if (this.height === height) return;
    this.height = height;
    this.node.getComponent(UITransform)!.setContentSize(DESIGN_WIDTH, height);
    this.viewport.getComponent(UITransform)!.setContentSize(DESIGN_WIDTH,
      Math.max(200, height - 128));
    this.viewport.setPosition(0, -64);
    this.nav.setPosition(0, height / 2 - 64);
    this.detail.getComponent(UITransform)!.setContentSize(DESIGN_WIDTH, height);
    this.detailViewport.getComponent(UITransform)!.setContentSize(DESIGN_WIDTH,
      Math.max(200, height - 128));
    this.detailViewport.setPosition(0, -64);
    this.detailNav.setPosition(0, height / 2 - 64);
    this.render();
    if (this.detail.active && this.detailDay) this.renderDetail();
  }

  private paint(node: Node, fill: string): void {
    const size = node.getComponent(UITransform)!;
    const graphics = node.getComponent(Graphics)!;
    graphics.clear();
    graphics.fillColor = color(fill);
    graphics.rect(-size.width / 2, -size.height / 2, size.width, size.height);
    graphics.fill();
  }

  private label(parent: Node, name: string, value: string, x: number, y: number,
    width: number, height: number, size: number, tint: string,
    align = HorizontalTextAlignment.LEFT): Label {
    return createLabel(name, parent, value, size, tint, width, height, x, y, align);
  }

  private rows(history: NonNullable<ReturnType<QuitStore['readHistory']>>): DayRow[] {
    const groups = new Map<string, DayRow>();
    for (const quit of history.quit) {
      groups.set(quit.day, { day: quit.day, records: [], quit, costCents: 0 });
    }
    for (const record of history.real) {
      const day = localDay(record.at);
      const row = groups.get(day) ?? { day, records: [], quit: null, costCents: 0 };
      row.records.push(record);
      const price = record.priceCents ?? history.packPriceCents;
      const sticks = record.priceCents === null || record.priceCents === undefined
        ? history.sticksPerPack : record.sticksPerPack ?? history.sticksPerPack;
      row.costCents = row.costCents === null || price === null
        ? null : row.costCents + price / sticks;
      groups.set(day, row);
    }
    return [...groups.values()].sort((a, b) => b.day.localeCompare(a.day));
  }

  private render(): void {
    if (!this.content) return;
    for (const child of [...this.content.children]) child.destroy();
    const snapshot = this.store.readSnapshot();
    const history = this.store.readHistory();
    const palette = snapshot?.light ? LIGHT : DARK;
    this.paint(this.background, palette.bg);
    this.paint(this.navBackground, palette.bg);
    this.navBack.color = color(palette.fg);
    this.navTitle.color = color(palette.fg);
    const rows = history ? this.rows(history) : [];
    const count = Math.min(this.visible, rows.length);
    const bodyHeight = Math.max(this.height - 128,
      560 + (count ? count * 214 : 350) + (rows.length > count ? 110 : 0));
    this.content.getComponent(UITransform)!.setContentSize(DESIGN_WIDTH, bodyHeight);
    let cursor = bodyHeight / 2 - 32;
    if (!snapshot || !history) {
      this.label(this.content, 'JournalError', '日志暂时没有读到，请重试。',
        0, cursor - 45, 678, 90, 27, palette.fg);
      const retry = createRect('RetryJournal', this.content, 678, 90,
        palette.surface, 0, cursor - 155, 12, palette.rule);
      retry.addComponent(Button).transition = Button.Transition.NONE;
      createLabel('Text', retry, '重新读取', 27, palette.accent, 630, 76);
      retry.on(Button.EventType.CLICK, () => this.render());
      return;
    }
    this.label(this.content, 'JournalHeading', '戒烟日志', -160,
      cursor - 31, 356, 62, 48, palette.fg).isBold = true;
    this.label(this.content, 'JournalCopy',
      '抽了几支、哪天未抽，都在这里如实记录。', -119,
      cursor - 108, 440, 76, 23, palette.muted);
    const today = createRect('JournalToday', this.content, 206, 82,
      palette.surface, 236, cursor - 52, 12, palette.rule);
    today.addComponent(Button).transition = Button.Transition.NONE;
    createLabel('TodayText', today, '记录今天', 27, palette.accent, 180, 66);
    today.on(Button.EventType.CLICK, () => { this.dismiss(); this.onToday(); });
    cursor -= 158;
    createRect('SummaryTop', this.content, 678, 2, palette.rule, 0, cursor);
    const values = [snapshot.totalDays, snapshot.currentStreak, snapshot.longestStreak];
    const captions = ['未抽烟 / 天', '当前连续 / 天', '最长连续 / 天'];
    for (let index = 0; index < 3; index += 1) {
      const x = -226 + index * 226;
      this.label(this.content, `Value${index}`, String(values[index]), x,
        cursor - 47, 218, 58, 46, palette.accent,
        HorizontalTextAlignment.CENTER);
      this.label(this.content, `Caption${index}`, captions[index], x,
        cursor - 99, 218, 34, 20, palette.muted,
        HorizontalTextAlignment.CENTER);
    }
    createRect('SummaryDivider1', this.content, 2, 110, palette.rule, -113, cursor - 70);
    createRect('SummaryDivider2', this.content, 2, 110, palette.rule, 113, cursor - 70);
    cursor -= 140;
    createRect('SummaryBottom', this.content, 678, 2, palette.rule, 0, cursor);
    this.label(this.content, 'SummaryNote',
      '以上天数仅统计明确确认未抽烟的日期', 0, cursor - 26,
      678, 42, 22, palette.muted);
    cursor -= 60;
    const trend = createNode('JournalTrend', this.content, 678, 100, 0, cursor - 50);
    trend.addComponent(Button).transition = Button.Transition.NONE;
    this.label(trend, 'TrendLabel', '查看吸烟与烟费趋势', -73, 0,
      532, 64, 27, palette.accent);
    this.label(trend, 'TrendType', '折线图', 272, 0, 124, 64,
      23, palette.muted, HorizontalTextAlignment.RIGHT);
    createRect('TrendRule', this.content, 678, 1, palette.rule, 0, cursor - 100);
    trend.on(Button.EventType.CLICK, () => this.onTrend());
    cursor -= 128;
    if (!rows.length) {
      const empty = createRect('JournalEmpty', this.content, 678, 330,
        palette.surface, 0, cursor - 190, 12, palette.rule);
      this.label(empty, 'EmptyTitle', '还没有戒烟日志', 0, 103,
        610, 52, 31, palette.fg, HorizontalTextAlignment.CENTER).isBold = true;
      this.label(empty, 'EmptyCopy',
        '抽过真烟就记一支，确定未抽就确认今天。没有记录的日期不会自动计数。',
        0, 23, 590, 100, 23, palette.muted, HorizontalTextAlignment.CENTER);
      const emptyAction = createRect('EmptyAction', empty, 520, 74,
        palette.bg, 0, -105, 12, palette.rule);
      emptyAction.addComponent(Button).transition = Button.Transition.NONE;
      createLabel('Text', emptyAction, '去记录今天', 26, palette.accent, 490, 64);
      emptyAction.on(Button.EventType.CLICK, () => { this.dismiss(); this.onToday(); });
      return;
    }
    for (const [index, row] of rows.slice(0, count).entries()) {
      const card = createRect(`JournalDay${index}`, this.content, 678, 188,
        palette.surface, 0, cursor - 94, 12, palette.rule);
      const cardButton = card.addComponent(Button);
      cardButton.transition = Button.Transition.SCALE;
      cardButton.zoomScale = 0.98;
      const release = (): void => this.paintCard(card, palette.surface, palette.rule);
      card.on(Node.EventType.TOUCH_START, () => this.paintCard(card,
        snapshot.light ? '#dfddd8' : '#272b2c', palette.muted));
      card.on(Node.EventType.TOUCH_END, release);
      card.on(Node.EventType.TOUCH_CANCEL, release);
      this.label(card, 'Day', dayText(row.day), -105, 54,
        436, 42, 28, palette.fg).isBold = true;
      const lastAt = row.records.length
        ? Math.max(...row.records.map((item) => item.at)) : row.quit!.confirmedAt;
      const timeText = `${clock(lastAt)} ${row.records.length ? '最近记录' : '确认'}`
        + (!row.records.length && (row.quit?.revision ?? 1) > 1 ? ' · 感受已更新' : '');
      this.label(card, 'Time', timeText,
        -105, 14, 436, 34, 20, palette.muted);
      const statusText = row.records.length
        ? `已抽 ${row.records.length} 支` : '未抽真烟';
      const statusWidth = row.records.length
        ? 100 + (String(row.records.length).length - 1) * 12 : 84;
      const statusRight = 310;
      createRect('StatusMark', card, 13, 13, palette.accent,
        statusRight - statusWidth - 16, 48, 7);
      this.label(card, 'Status', statusText,
        statusRight - statusWidth / 2, 48, statusWidth, 40,
        20, palette.accent, HorizontalTextAlignment.LEFT);
      createRect('CardRule', card, 620, 2, palette.rule, 0, -25);
      const text = row.records.length
        ? row.costCents === null ? '设置烟价，计算烟费'
          : `烟费估算 ¥${(Math.round(row.costCents) / 100).toFixed(2)}`
        : row.quit!.feeling.replace(/\s+/g, ' ').trim() || '这次没有填写感受';
      this.label(card, 'DetailPreview', text, 0, -66,
        620, 58, 23, palette.muted);
      card.on(Button.EventType.CLICK, () => this.openDay(row));
      if (row.records.length && row.costCents === null) {
        const price = createNode('PriceLink', card, 620, 60, 0, -66);
        price.addComponent(Button).transition = Button.Transition.NONE;
        price.on(Button.EventType.CLICK, (event) => {
          event.propagationStopped = true;
          this.dismiss();
          this.onPrice();
        });
      }
      cursor -= 214;
    }
    if (rows.length > count) {
      const more = createNode('MoreJournal', this.content, 678, 88, 0, cursor - 44);
      more.addComponent(Button).transition = Button.Transition.NONE;
      createLabel('Text', more, '查看更多日期', 26, palette.accent, 650, 76);
      more.on(Button.EventType.CLICK, () => { this.visible += 20; this.render(); });
    }
  }

  private paintCard(node: Node, fill: string, stroke: string): void {
    const graphics = node.getComponent(Graphics)!;
    graphics.clear();
    graphics.fillColor = color(fill);
    graphics.roundRect(-339, -94, 678, 188, 12);
    graphics.fill();
    graphics.strokeColor = color(stroke);
    graphics.lineWidth = 2;
    graphics.roundRect(-339, -94, 678, 188, 12);
    graphics.stroke();
  }

  private openDay(row: DayRow): void {
    if (this.slide || this.detailSlide) return;
    this.detailDay = row.day;
    this.detailVisible = 20;
    this.renderDetail();
    this.detail.active = true;
    this.detailScroll.scrollToTop(0);
    this.detail.setPosition(view.getVisibleSize().width, 0);
    this.detailSlide = 'in';
    this.detailSlideTime = 0;
  }

  private closeDetail(): void {
    if (!this.detail.active || this.detailSlide) return;
    this.detailSlide = 'out';
    this.detailSlideTime = 0;
  }

  private renderDetail(): void {
    if (!this.detailContent || !this.detailDay) return;
    for (const child of [...this.detailContent.children]) child.destroy();
    const snapshot = this.store.readSnapshot();
    const history = this.store.readHistory();
    const palette = snapshot?.light ? LIGHT : DARK;
    this.paint(this.detailBackground, palette.bg);
    this.paint(this.detailNavBackground, palette.bg);
    this.detailBack.color = color(palette.fg);
    this.detailNavTitle.color = color(palette.fg);
    const row = history?.real ? this.rows(history).find((item) => item.day === this.detailDay)
      : undefined;
    const visibleRecords = row?.records.slice().sort((a, b) => b.at - a.at)
      .slice(0, this.detailVisible) ?? [];
    const hasMore = !!row && row.records.length > this.detailVisible;
    const needsPrice = !!row && row.records.length > 0 && row.costCents === null;
    const feeling = row?.quit?.feeling ?? '';
    const feelingHeight = Math.max(180, 90 + Math.ceil(Math.max(1, feeling.length) / 20) * 40);
    const bodyHeight = Math.max(this.height - 128, row?.records.length
      ? 700 + visibleRecords.length * 92 + (hasMore ? 100 : 0) + (needsPrice ? 120 : 0)
      : 710 + feelingHeight);
    this.detailContent.getComponent(UITransform)!.setContentSize(DESIGN_WIDTH, bodyHeight);
    let cursor = bodyHeight / 2 - 42;
    if (!snapshot || !history) {
      this.label(this.detailContent, 'DetailError',
        '这条记录暂时没有读到，请重试。', 0, cursor - 45,
        678, 90, 28, palette.fg);
      const retry = createRect('DetailRetry', this.detailContent, 678, 90,
        palette.surface, 0, cursor - 155, 12, palette.rule);
      retry.addComponent(Button).transition = Button.Transition.NONE;
      createLabel('Text', retry, '重新读取', 28, palette.accent, 630, 76);
      retry.on(Button.EventType.CLICK, () => this.renderDetail());
      return;
    }
    if (!row) {
      const missing = createRect('DetailMissing', this.detailContent, 678, 230,
        palette.surface, 0, cursor - 215, 12, palette.rule);
      this.label(missing, 'MissingTitle', '这条记录没有找到', 0, 54,
        610, 58, 31, palette.fg, HorizontalTextAlignment.CENTER).isBold = true;
      this.label(missing, 'MissingCopy',
        '这条本机记录可能已被清除，请使用左上角返回。', 0, -25,
        610, 80, 23, palette.muted, HorizontalTextAlignment.CENTER);
      return;
    }
    this.label(this.detailContent, 'DetailDate', dayText(row.day), 0,
      cursor - 32, 678, 64, 48, palette.fg).isBold = true;
    this.label(this.detailContent, 'DetailIntro', row.records.length
      ? '只统计你主动记录的真实吸烟。' : '这一天由你主动确认，不是系统推算。',
    0, cursor - 93, 678, 64, 23, palette.muted);
    cursor -= 150;
    if (row.records.length) {
      createRect('CountTop', this.detailContent, 678, 2, palette.rule, 0, cursor);
      this.label(this.detailContent, 'DayCount', `${row.records.length} 支`,
        -222, cursor - 63, 232, 72, 56, palette.fg).isBold = true;
      this.label(this.detailContent, 'DayCountLabel', '这一天已记',
        -222, cursor - 116, 232, 38, 22, palette.muted);
      this.label(this.detailContent, 'DayCost', row.costCents === null
        ? '烟费待设置' : `烟费估算 ¥${(Math.round(row.costCents) / 100).toFixed(2)}`,
      172, cursor - 83, 334, 70, 26, palette.muted,
      HorizontalTextAlignment.RIGHT);
      cursor -= 155;
      createRect('CountBottom', this.detailContent, 678, 2, palette.rule, 0, cursor);
      cursor -= 36;
      this.label(this.detailContent, 'DayDetailHeading', '当天明细', 0,
        cursor - 20, 678, 40, 30, palette.fg).isBold = true;
      cursor -= 54;
      for (const [index, record] of visibleRecords.entries()) {
        const date = new Date(record.at);
        const two = (value: number): string => value < 10 ? `0${value}` : String(value);
        const time = `${clock(record.at)}:${two(date.getSeconds())}`;
        const price = record.priceCents ?? history.packPriceCents;
        const sticks = record.priceCents === null || record.priceCents === undefined
          ? history.sticksPerPack : record.sticksPerPack ?? history.sticksPerPack;
        const cost = price === null ? '未设烟价'
          : `约 ¥${(Math.round(price / sticks) / 100).toFixed(2)}`;
        this.label(this.detailContent, `RecordTime${index}`, time,
          -205, cursor - 46, 268, 64, 26, palette.fg);
        this.label(this.detailContent, `RecordCost${index}`, `1 支 · ${cost}`,
          171, cursor - 46, 330, 64, 26, palette.muted,
          HorizontalTextAlignment.RIGHT);
        cursor -= 92;
        createRect(`RecordRule${index}`, this.detailContent, 678, 1,
          palette.rule, 0, cursor);
      }
      if (hasMore) {
        const more = createNode('DetailMore', this.detailContent, 678, 88,
          0, cursor - 44);
        more.addComponent(Button).transition = Button.Transition.NONE;
        createLabel('Text', more, '查看更多记录', 26, palette.accent, 650, 76);
        more.on(Button.EventType.CLICK, () => {
          this.detailVisible += 20;
          this.renderDetail();
        });
        cursor -= 88;
      }
      this.label(this.detailContent, 'CostFootnote',
        '烟费为按支数估算的消耗，非实际购买支出。', 0,
        cursor - 32, 678, 64, 21, palette.muted);
      cursor -= 88;
      if (needsPrice) {
        const price = createRect('SetDetailPrice', this.detailContent, 678, 92,
          palette.accent, 0, cursor - 46, 12);
        price.addComponent(Button).transition = Button.Transition.NONE;
        createLabel('Text', price, '设置烟价，计算烟费', 28,
          palette.bg, 634, 74);
        price.on(Button.EventType.CLICK, () => { this.dismiss(); this.onPrice(); });
        cursor -= 120;
      }
    } else {
      createRect('QuitStatusTop', this.detailContent, 678, 2, palette.rule, 0, cursor);
      const seal = createNode('QuitSeal', this.detailContent, 82, 82,
        -285, cursor - 73);
      const sealGraphics = seal.addComponent(Graphics);
      sealGraphics.lineWidth = 3;
      sealGraphics.strokeColor = color(palette.accent);
      sealGraphics.circle(0, 0, 40);
      sealGraphics.stroke();
      sealGraphics.lineWidth = 5;
      sealGraphics.moveTo(-19, 1);
      sealGraphics.lineTo(-5, -13);
      sealGraphics.lineTo(23, 16);
      sealGraphics.stroke();
      this.label(this.detailContent, 'QuitStatus', '今日确定未抽真烟', 65,
        cursor - 53, 530, 50, 30, palette.fg).isBold = true;
      const firstAt = row.quit!.firstConfirmedAt ?? row.quit!.confirmedAt;
      const revised = (row.quit!.revision ?? 1) > 1;
      this.label(this.detailContent, 'QuitConfirmedAt',
        `${clock(firstAt)} 首次确认`
          + (revised ? ` · ${clock(row.quit!.confirmedAt)} 更新感受` : ''),
        65, cursor - 104, 530, 52, 21, palette.muted);
      cursor -= 152;
      createRect('QuitStatusBottom', this.detailContent, 678, 2, palette.rule, 0, cursor);
      cursor -= 36;
      const panel = createRect('FeelingPanel', this.detailContent, 678, feelingHeight,
        palette.surface, 0, cursor - feelingHeight / 2, 0, palette.rule);
      this.label(panel, 'FeelingHeading', '当时的感受', 0,
        feelingHeight / 2 - 44, 618, 42, 21, palette.muted);
      const feelingCopy = this.label(panel, 'FeelingCopy',
        feeling || '这次没有填写感受。', 0, -12,
        618, feelingHeight - 98, 27, feeling ? palette.fg : palette.muted);
      feelingCopy.verticalAlign = VerticalTextAlignment.TOP;
      feelingCopy.overflow = Label.Overflow.CLAMP;
      cursor -= feelingHeight + 34;
    }
    this.label(this.detailContent, 'StorageNote',
      '记录只保存在这台设备里，完整删除数据后无法恢复。', 0,
      cursor - 30, 678, 60, 21, palette.muted,
      HorizontalTextAlignment.CENTER);
  }
}
