import { _decorator, BlockInputEvents, Button, Component, EventTouch, Graphics,
  HorizontalTextAlignment, Label, Mask, Node, ScrollView, UITransform, Vec3, view } from 'cc';
import { color, createLabel, createNode, createRect, DESIGN_WIDTH } from '../common/UiFactory';
import { QuitStore } from '../persistence/QuitStore';
import { buildQuitTrend, TrendData, TrendDay } from './QuitTrendModel';

const { ccclass } = _decorator;
type Palette = { bg: string; surface: string; fg: string; muted: string;
  rule: string; accent: string; button: string; ink: string };
const DARK: Palette = { bg: '#101213', surface: '#1b1d1e', fg: '#f5f4f0',
  muted: '#b6b8ba', rule: '#36393b', accent: '#f5f4f0',
  button: '#f5f4f0', ink: '#101213' };
const LIGHT: Palette = { bg: '#f5f4f0', surface: '#eae9e5', fg: '#161819',
  muted: '#606467', rule: '#c9cbcc', accent: '#161819',
  button: '#161819', ink: '#f5f4f0' };
type ChartKind = 'count' | 'cost';
type ChartWindow = { start: number; span: number };
type Gesture = { kind: ChartKind; stage: Node; x: number; y: number;
  start: number; span: number; distance: number; lastDistance: number;
  moved: boolean; pinch: boolean };

function localDay(at: number): string {
  const date = new Date(at);
  const two = (value: number): string => value < 10 ? `0${value}` : String(value);
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
}

function selectedText(day: TrendDay | undefined): string {
  if (!day) return '暂无记录';
  return `${day.count === null ? '未记录' : `${day.count} 支`} · ${day.costCents === null
    ? '烟费未知' : `烟费估算 ¥${(day.costCents / 100).toFixed(2)}`}`;
}

@ccclass('QuitTrendController')
export class QuitTrendController extends Component {
  private store!: QuitStore;
  private background!: Node;
  private nav!: Node;
  private navBackground!: Node;
  private navBack!: Label;
  private navTitle!: Label;
  private viewport!: Node;
  private scroll!: ScrollView;
  private content!: Node;
  private height = 0;
  private slide: 'in' | 'out' | null = null;
  private slideTime = 0;
  private range: 7 | 30 = 7;
  private data: TrendData | null = null;
  private selectedDay = '';
  private calendarOpen = false;
  private calendarMonth = '';
  private countWindow: ChartWindow = { start: 0, span: 6 };
  private costWindow: ChartWindow = { start: 0, span: 6 };
  private gesture: Gesture | null = null;
  private static readonly SLIDE_SECONDS = 0.3;

  public initialize(store: QuitStore): void {
    this.store = store;
    this.build();
  }

  public present(): void {
    this.range = 7;
    this.selectedDay = localDay(Date.now());
    this.calendarMonth = this.selectedDay.slice(0, 7);
    this.calendarOpen = false;
    this.resetWindows();
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
    this.gesture = null;
    this.node.active = false;
  }

  public close(): void {
    if (this.slide || !this.node.active) return;
    this.slide = 'out';
    this.slideTime = 0;
  }

  protected update(dt: number): void {
    if (!this.node.active) return;
    this.resize();
    if (!this.slide) return;
    this.slideTime = Math.min(QuitTrendController.SLIDE_SECONDS,
      this.slideTime + Math.max(0, dt));
    const progress = this.slideTime / QuitTrendController.SLIDE_SECONDS;
    const eased = 1 - (1 - progress) ** 3;
    this.node.setPosition(view.getVisibleSize().width *
      (this.slide === 'in' ? 1 - eased : eased), 0);
    if (progress >= 1) {
      const leaving = this.slide === 'out';
      this.slide = null;
      if (leaving) this.dismiss();
    }
  }

  private build(): void {
    this.node.addComponent(BlockInputEvents);
    this.background = createRect('TrendBackground', this.node,
      DESIGN_WIDTH, 2400, DARK.bg);
    this.viewport = createNode('TrendViewport', this.node, DESIGN_WIDTH, 1000);
    this.viewport.addComponent(Mask);
    this.scroll = this.viewport.addComponent(ScrollView);
    this.scroll.horizontal = false;
    this.scroll.vertical = true;
    this.scroll.elastic = false;
    this.content = createNode('TrendContent', this.viewport, DESIGN_WIDTH, 2800);
    this.scroll.content = this.content;
    this.nav = createNode('TrendNavigation', this.node, DESIGN_WIDTH, 128);
    this.navBackground = createRect('TrendNavigationBackground', this.nav,
      DESIGN_WIDTH, 128, DARK.bg);
    const back = createNode('TrendBack', this.nav, 88, 88, -331, -12);
    back.addComponent(Button).transition = Button.Transition.NONE;
    this.navBack = createLabel('TrendBackText', back, '‹', 48, DARK.fg, 80, 78);
    back.on(Button.EventType.CLICK, () => this.close());
    this.navTitle = createLabel('TrendNavigationTitle', this.nav,
      '个人数据趋势', 34, DARK.fg, 330, 56, 0, -12);
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
    this.render();
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

  private load(): void {
    const history = this.store.readHistory();
    this.data = history ? buildQuitTrend(history, this.range) : null;
    if (this.data && !this.data.days.some((day) => day.day === this.selectedDay)) {
      this.selectedDay = this.data.days[this.data.days.length - 1].day;
    }
    this.render();
  }

  private resetWindows(): void {
    this.countWindow = { start: 0, span: this.range - 1 };
    this.costWindow = { start: 0, span: this.range - 1 };
  }

  private rerender(): void {
    const offset = this.scroll.getScrollOffset();
    this.render();
    this.scroll.scrollToOffset(offset, 0);
  }

  private render(): void {
    if (!this.content) return;
    for (const child of [...this.content.children]) child.destroy();
    const palette = this.store.readSnapshot()?.light ? LIGHT : DARK;
    this.paint(this.background, palette.bg);
    this.paint(this.navBackground, palette.bg);
    this.navBack.color = color(palette.fg);
    this.navTitle.color = color(palette.fg);
    const calendarHeight = this.calendarOpen ? this.calendarHeight() : 0;
    const bodyHeight = Math.max(this.height - 128, 2600 + calendarHeight);
    this.content.getComponent(UITransform)!.setContentSize(DESIGN_WIDTH, bodyHeight);
    let cursor = bodyHeight / 2 - 42;
    this.label(this.content, 'TrendTitle', '看见自己的节奏', 0,
      cursor - 32, 686, 64, 48, palette.fg).isBold = true;
    this.label(this.content, 'TrendCopy', '真实记录，慢慢调整。', 0,
      cursor - 87, 686, 46, 26, palette.muted);
    cursor -= 126;
    for (const [index, range] of ([7, 30] as const).entries()) {
      const active = this.range === range;
      const button = createRect(`Range${range}`, this.content, 335, 92,
        active ? palette.button : palette.surface,
        index === 0 ? -175.5 : 175.5, cursor - 46, 12,
        active ? palette.button : palette.rule);
      button.addComponent(Button).transition = Button.Transition.NONE;
      createLabel('Text', button, `最近 ${range} 天`, 28,
        active ? palette.ink : palette.muted, 309, 74);
      button.on(Button.EventType.CLICK, () => {
        if (this.range === range) return;
        this.range = range;
        this.resetWindows();
        this.calendarOpen = false;
        this.load();
      });
    }
    cursor -= 124;
    if (!this.data) {
      this.label(this.content, 'TrendError', '趋势暂时没有读到，请重试。',
        0, cursor - 42, 686, 80, 28, palette.fg);
      const retry = createRect('RetryTrend', this.content, 686, 90,
        palette.surface, 0, cursor - 150, 12, palette.rule);
      retry.addComponent(Button).transition = Button.Transition.NONE;
      createLabel('Text', retry, '重试', 28, palette.accent, 650, 74);
      retry.on(Button.EventType.CLICK, () => this.load());
      return;
    }
    this.label(this.content, 'CountCaption', '已记支数', -175,
      cursor - 18, 335, 36, 24, palette.muted);
    this.label(this.content, 'CostCaption', '烟费估算', 175,
      cursor - 18, 335, 36, 24, palette.muted);
    this.label(this.content, 'CountValue', `${this.data.totalCount} 支`, -175,
      cursor - 79, 335, 66, 46, palette.accent).isBold = true;
    this.label(this.content, 'CostValue', this.data.totalCostCents === null
      ? '— 元' : `${(this.data.totalCostCents / 100).toFixed(2)} 元`,
    175, cursor - 79, 335, 66, 46, palette.accent).isBold = true;
    cursor -= 124;
    this.label(this.content, 'Coverage',
      `${this.range} 天中有 ${this.data.knownDays} 天记录；今天尚未结束。`
        + (this.data.unknownCosts ? '部分记录未设烟价。' : ''),
      0, cursor - 31, 686, 62, 23, palette.muted);
    cursor -= 75;
    createRect('YesterdayTop', this.content, 686, 2, palette.rule, 0, cursor);
    this.label(this.content, 'YesterdayLabel', '昨天', -257,
      cursor - 43, 172, 64, 25, palette.fg);
    this.label(this.content, 'YesterdayValue',
      selectedText(this.data.days[this.data.days.length - 2]), 106,
      cursor - 43, 465, 64, 25, palette.muted,
      HorizontalTextAlignment.RIGHT);
    cursor -= 86;
    createRect('YesterdayBottom', this.content, 686, 2, palette.rule, 0, cursor);
    cursor -= 32;
    this.drawChart('count', cursor - 310, palette);
    cursor -= 652;
    this.drawChart('cost', cursor - 310, palette);
    cursor -= 652;
    createRect('SelectionTop', this.content, 686, 2, palette.rule, 0, cursor);
    const picker = createNode('TrendPicker', this.content, 686, 100,
      0, cursor - 50);
    picker.addComponent(Button).transition = Button.Transition.NONE;
    this.label(picker, 'SelectedDay', this.selectedDay, -183,
      0, 320, 66, 28, palette.fg);
    this.label(picker, 'PickerAction', this.calendarOpen ? '收起日历' : '更换日期',
      221, 0, 210, 66, 25, palette.accent,
      HorizontalTextAlignment.RIGHT);
    picker.on(Button.EventType.CLICK, () => {
      this.calendarOpen = !this.calendarOpen;
      this.calendarMonth = this.selectedDay.slice(0, 7);
      this.rerender();
    });
    cursor -= 100;
    if (this.calendarOpen) {
      this.drawCalendar(cursor, palette);
      cursor -= calendarHeight;
    }
    this.label(this.content, 'SelectedValue',
      selectedText(this.data.days.find((day) => day.day === this.selectedDay)),
      0, cursor - 28, 686, 56, 30, palette.fg);
    cursor -= 56;
    if (this.selectedDay === this.data.days[this.data.days.length - 1].day) {
      this.label(this.content, 'InProgress', '今天还在进行中',
        0, cursor - 20, 686, 40, 23, palette.muted);
      cursor -= 40;
    }
    cursor -= 18;
    createRect('SelectionBottom', this.content, 686, 2, palette.rule, 0, cursor);
    const notes = [
      '点折线查看数值，双指缩放、左右拖动。也可以使用图下按钮与日期选择器。',
      '没有记录的日期留空；明确确认未抽烟的日期记为 0。折线只连接相邻且都有记录的日期。',
      '已设价记录按原价估算；未设价记录按当前烟价补算。不代表实际购买支出，仅保存在本机。',
    ];
    for (const [index, note] of notes.entries()) {
      this.label(this.content, `TrendNote${index}`, note, 0,
        cursor - 58, 686, 102, 23, palette.muted);
      cursor -= 112;
    }
  }

  private drawChart(kind: ChartKind, y: number, palette: Palette): void {
    const title = kind === 'count' ? '吸烟支数' : '烟费估算';
    const unit = kind === 'count' ? '支' : '元';
    const card = createRect(`${kind}Chart`, this.content, 686, 620,
      palette.surface, 0, y, 16, palette.rule);
    this.label(card, 'ChartTitle', title, -125, 270,
      360, 50, 30, palette.fg).isBold = true;
    this.label(card, 'ChartUnit', unit, 255, 270,
      100, 50, 24, palette.muted, HorizontalTextAlignment.RIGHT);
    const stage = createNode('ChartStage', card, 640, 400, 0, 0);
    this.paintChart(stage, kind, palette);
    stage.on(Node.EventType.TOUCH_START, (event: EventTouch) => {
      const point = event.getUILocation();
      const touches = event.getTouches();
      this.gesture = { kind, stage, x: point.x, y: point.y,
        start: this.window(kind).start, span: this.window(kind).span,
        distance: touches.length > 1 ? this.touchDistance(event) : 0,
        lastDistance: touches.length > 1 ? this.touchDistance(event) : 0,
        moved: false, pinch: touches.length > 1 };
    });
    stage.on(Node.EventType.TOUCH_MOVE, (event: EventTouch) => {
      const gesture = this.gesture;
      if (!gesture || gesture.stage !== stage) return;
      const point = event.getUILocation();
      if (event.getTouches().length > 1) {
        if (!gesture.distance) gesture.distance = this.touchDistance(event);
        gesture.lastDistance = this.touchDistance(event);
        gesture.pinch = true;
        gesture.moved = true;
      } else if (Math.hypot(point.x - gesture.x, point.y - gesture.y) > 8) {
        gesture.moved = true;
      }
    });
    stage.on(Node.EventType.TOUCH_END, (event: EventTouch) => this.endChartTouch(event));
    stage.on(Node.EventType.TOUCH_CANCEL, () => { this.gesture = null; });
    for (const [index, titleText] of ['前移', '放大', '缩小', '后移', '重置'].entries()) {
      const control = createRect(`ChartControl${index}`, card, 126, 78,
        palette.surface, -260 + index * 130, -260, 8);
      const current = this.window(kind);
      const enabled = index === 0 ? current.start > 0.01
        : index === 1 ? current.span > 4.01
          : index === 2 ? current.span < this.range - 1.01
            : index === 3 ? current.start + current.span < this.range - 1.01 : true;
      const controlText = createLabel('Text', control, titleText, 24,
        enabled ? palette.fg : palette.muted, 122, 66);
      if (enabled) {
        control.addComponent(Button).transition = Button.Transition.NONE;
        const restore = (): void => {
          if (!control.isValid) return;
          this.paintControl(control, palette.surface);
          controlText.color = color(palette.fg);
        };
        control.on(Node.EventType.TOUCH_START, () => {
          this.paintControl(control, palette.button);
          controlText.color = color(palette.ink);
        });
        control.on(Node.EventType.TOUCH_END, restore);
        control.on(Node.EventType.TOUCH_CANCEL, restore);
        control.on(Button.EventType.CLICK, () => this.chartControl(kind, index));
      }
    }
  }

  private paintControl(node: Node, fill: string): void {
    const graphic = node.getComponent(Graphics)!;
    graphic.clear();
    graphic.fillColor = color(fill);
    graphic.roundRect(-63, -39, 126, 78, 8);
    graphic.fill();
  }

  private window(kind: ChartKind): ChartWindow {
    return kind === 'count' ? this.countWindow : this.costWindow;
  }

  private setWindow(kind: ChartKind, start: number, span: number): void {
    const max = this.range - 1;
    const nextSpan = Math.min(max, Math.max(Math.min(4, max), span));
    const nextStart = Math.min(max - nextSpan, Math.max(0, start));
    if (kind === 'count') this.countWindow = { start: nextStart, span: nextSpan };
    else this.costWindow = { start: nextStart, span: nextSpan };
    this.rerender();
  }

  private chartControl(kind: ChartKind, index: number): void {
    const current = this.window(kind);
    if (index === 0) this.setWindow(kind,
      current.start - Math.max(1, current.span / 2), current.span);
    else if (index === 1) this.setWindow(kind,
      current.start + current.span / 4, current.span / 2);
    else if (index === 2) this.setWindow(kind,
      current.start - current.span / 2, current.span * 2);
    else if (index === 3) this.setWindow(kind,
      current.start + Math.max(1, current.span / 2), current.span);
    else this.setWindow(kind, 0, this.range - 1);
  }

  private touchDistance(event: EventTouch): number {
    const touches = event.getTouches();
    if (touches.length < 2) return 0;
    const a = touches[0].getUILocation();
    const b = touches[1].getUILocation();
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private endChartTouch(event: EventTouch): void {
    const gesture = this.gesture;
    this.gesture = null;
    if (!gesture || !this.data) return;
    const point = event.getUILocation();
    if (gesture.pinch) {
      const distance = gesture.lastDistance;
      if (distance && gesture.distance) {
        const span = gesture.span * gesture.distance / distance;
        this.setWindow(gesture.kind, gesture.start + (gesture.span - span) / 2, span);
      }
      return;
    }
    if (gesture.moved) {
      if (Math.abs(point.x - gesture.x) > 8) {
        this.setWindow(gesture.kind,
          gesture.start - (point.x - gesture.x) / 520 * gesture.span, gesture.span);
      }
      return;
    }
    const local = gesture.stage.getComponent(UITransform)!.convertToNodeSpaceAR(
      new Vec3(point.x, point.y, 0));
    const window = this.window(gesture.kind);
    const fraction = Math.max(0, Math.min(1, (local.x + 250) / 520));
    const index = Math.max(0, Math.min(this.data.days.length - 1,
      Math.round(window.start + fraction * window.span)));
    this.selectedDay = this.data.days[index].day;
    this.rerender();
  }

  private paintChart(stage: Node, kind: ChartKind, palette: Palette): void {
    if (!this.data) return;
    const graph = stage.addComponent(Graphics);
    const current = this.window(kind);
    const data = this.data.days;
    const values = data.map((day) => kind === 'count' ? day.count
      : day.costCents === null ? null : day.costCents / 100);
    const subset = values.slice(Math.floor(current.start),
      Math.ceil(current.start + current.span) + 1);
    const highest = Math.max(0, ...subset.map((value) => value ?? 0));
    const maxValue = kind === 'count'
      ? Math.max(4, Math.ceil(highest / 4) * 4)
      : Math.max(1, Math.ceil(highest * 1.15 * 4) / 4);
    const left = -250;
    const right = 270;
    const bottom = -145;
    const top = 145;
    const xAt = (index: number): number => left + (index - current.start) / current.span * (right - left);
    const yAt = (value: number): number => bottom + value / maxValue * (top - bottom);
    graph.lineWidth = 1;
    graph.strokeColor = color(palette.rule);
    for (let tick = 0; tick <= 4; tick += 1) {
      const y = bottom + tick / 4 * (top - bottom);
      graph.moveTo(left, y);
      graph.lineTo(right, y);
      graph.stroke();
      this.label(stage, `YTick${tick}`,
        kind === 'count' ? String(maxValue * tick / 4)
          : (maxValue * tick / 4).toFixed(2),
        -285, y, 58, 30, 18, palette.muted,
        HorizontalTextAlignment.RIGHT);
    }
    graph.lineWidth = 3;
    graph.strokeColor = color(palette.accent);
    let connected = false;
    for (let index = Math.ceil(current.start); index <= Math.floor(current.start + current.span);
      index += 1) {
      const value = values[index];
      if (value === null || value === undefined) { connected = false; continue; }
      const x = xAt(index);
      if (connected) graph.lineTo(x, yAt(value));
      else graph.moveTo(x, yAt(value));
      connected = true;
    }
    graph.stroke();
    graph.fillColor = color(palette.accent);
    for (let index = 0; index < data.length; index += 1) {
      const value = values[index];
      if (value === null || index < current.start - 0.1
        || index > current.start + current.span + 0.1) continue;
      graph.circle(xAt(index), yAt(value), 4);
      graph.fill();
    }
    const selectedIndex = data.findIndex((day) => day.day === this.selectedDay);
    if (selectedIndex >= current.start && selectedIndex <= current.start + current.span) {
      const selectedX = xAt(selectedIndex);
      graph.lineWidth = 2;
      graph.strokeColor = color(palette.fg, 230);
      for (let dash = bottom; dash < top; dash += 17) {
        graph.moveTo(selectedX, dash);
        graph.lineTo(selectedX, Math.min(top, dash + 10));
      }
      graph.stroke();
      const selectedValue = values[selectedIndex];
      if (selectedValue !== null) {
        graph.fillColor = color(palette.button);
        graph.circle(selectedX, yAt(selectedValue), 7);
        graph.fill();
      }
    }
    const step = Math.max(1, Math.ceil(current.span / 5));
    for (let index = Math.ceil(current.start); index <= Math.floor(current.start + current.span);
      index += 1) {
      if (index % step !== 0 && index !== data.length - 1) continue;
      this.label(stage, `XTick${index}`, data[index].day.slice(5).replace('-', '/'),
        xAt(index), -175, 76, 32, 18, palette.muted,
        HorizontalTextAlignment.CENTER);
    }
    if (!subset.some((value) => value !== null)) {
      this.label(stage, 'NoChartData', '这段时间暂无可绘制记录',
        0, 0, 440, 64, 23, palette.muted,
        HorizontalTextAlignment.CENTER);
    }
  }

  private calendarHeight(): number {
    const [year, month] = this.calendarMonth.split('-').map(Number);
    const offset = (new Date(year, month - 1, 1, 12).getDay() + 6) % 7;
    const count = new Date(year, month, 0).getDate();
    return 185 + Math.ceil((offset + count) / 7) * 70;
  }

  private drawCalendar(top: number, palette: Palette): void {
    if (!this.data) return;
    const height = this.calendarHeight();
    createRect('CalendarTop', this.content, 686, 1, palette.rule, 0, top);
    const [year, month] = this.calendarMonth.split('-').map(Number);
    const earliest = this.data.days[0].day.slice(0, 7);
    const latest = this.data.days[this.data.days.length - 1].day.slice(0, 7);
    this.label(this.content, 'CalendarTitle', `${year} 年 ${month} 月`, 0,
      top - 38, 480, 62, 30, palette.fg,
      HorizontalTextAlignment.CENTER).isBold = true;
    const move = (delta: -1 | 1, x: number, enabled: boolean): void => {
      const button = createNode(delta < 0 ? 'PreviousMonth' : 'NextMonth',
        this.content, 82, 72, x, top - 38);
      const arrow = createLabel('Text', button, delta < 0 ? '‹' : '›', 36,
        enabled ? palette.fg : palette.muted, 72, 64);
      if (enabled) {
        button.addComponent(Button).transition = Button.Transition.NONE;
        button.on(Button.EventType.CLICK, () => {
          const date = new Date(year, month - 1 + delta, 1, 12);
          this.calendarMonth = localDay(date.getTime()).slice(0, 7);
          this.rerender();
        });
      } else arrow.color = color(palette.muted, 102);
    };
    move(-1, -300, this.calendarMonth > earliest);
    move(1, 300, this.calendarMonth < latest);
    for (const [index, weekday] of ['一', '二', '三', '四', '五', '六', '日'].entries()) {
      this.label(this.content, `Weekday${index}`, weekday,
        -294 + index * 98, top - 94, 90, 44, 24,
        palette.muted, HorizontalTextAlignment.CENTER);
    }
    const firstOffset = (new Date(year, month - 1, 1, 12).getDay() + 6) % 7;
    const count = new Date(year, month, 0).getDate();
    const available = new Set(this.data.days.map((day) => day.day));
    for (let cell = 0; cell < Math.ceil((firstOffset + count) / 7) * 7; cell += 1) {
      const date = new Date(year, month - 1, 1 - firstOffset + cell, 12);
      const day = localDay(date.getTime());
      const inMonth = date.getMonth() === month - 1;
      const enabled = inMonth && available.has(day);
      const selected = enabled && day === this.selectedDay;
      const x = -294 + cell % 7 * 98;
      const y = top - 148 - Math.floor(cell / 7) * 70;
      if (selected) createRect(`Selected${cell}`, this.content, 78, 62,
        palette.button, x, y, 10);
      const node = createNode(`CalendarDay${cell}`, this.content, 84, 64, x, y);
      const dayLabel = createLabel('Text', node, String(date.getDate()), 28,
        selected ? palette.ink : enabled ? palette.fg : palette.muted, 76, 58);
      if (!enabled) dayLabel.color = color(palette.muted, 102);
      if (enabled) {
        node.addComponent(Button).transition = Button.Transition.NONE;
        node.on(Button.EventType.CLICK, () => {
          this.selectedDay = day;
          this.calendarOpen = false;
          this.rerender();
        });
      }
    }
    this.label(this.content, 'CalendarNote',
      `可选最近 ${this.range} 天；点日期查看当天数值`, 0,
      top - height + 34, 686, 50, 22, palette.muted);
    createRect('CalendarBottom', this.content, 686, 1,
      palette.rule, 0, top - height);
  }
}
