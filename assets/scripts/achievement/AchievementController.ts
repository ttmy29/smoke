import { _decorator, BlockInputEvents, Button, Component, Graphics,
  HorizontalTextAlignment, Label, Mask, Node, ScrollView, tween, UITransform,
  UIOpacity, Vec2, Vec3, view } from 'cc';
import { color, createLabel, createNode, createRect, DESIGN_WIDTH } from '../common/UiFactory';
import { ACHIEVEMENT_GROUPS, AchievementItem,
  SPECIAL_ACHIEVEMENT } from './AchievementCatalog';
import { createAchievementIcon } from './AchievementIcon';

const { ccclass } = _decorator;
type Filter = 'all' | 'incomplete' | 'completed';

export interface AchievementResult {
  id: string;
  completed: boolean;
  progressText?: string;
  firstAchievedLabel?: string;
  backMessage?: string;
  unread?: boolean;
}

export interface AchievementSource {
  readResults(): ReadonlyArray<AchievementResult> | null;
  markRead?(id: string): boolean;
}

export const emptyAchievementSource: AchievementSource = { readResults: () => [] };

const BG = '#101214';
const TEXT = '#eee5d8';
const MUTED = '#aaa093';
const GOLD = '#d0a16d';
const ROW_HEIGHT = 156;
const ROW_GAP = 12;

@ccclass('AchievementController')
export class AchievementController extends Component {
  private source!: AchievementSource;
  private onBack!: () => void;
  private routeShade!: Node;
  private routeShadeOpacity!: UIOpacity;
  private nav!: Node;
  private header!: Node;
  private toolbar!: Node;
  private viewport!: Node;
  private scroll!: ScrollView;
  private content!: Node;
  private scrollBar!: Node;
  private scrollThumb!: Node;
  private paintedViewportHeight = 0;
  private paintedContentHeight = 0;
  private countLabel!: Label;
  private progressFill!: Node;
  private progressTrack!: Node;
  private titleDot!: Node;
  private lastLocatedId = '';
  private filter: Filter = 'all';
  private results = new Map<string, AchievementResult>();
  private loadError = false;
  private flipped = new Set<string>();
  private flipping = new Set<string>();
  private height = 0;
  private slide: 'in' | 'out' | null = null;
  private slideTime = 0;
  private static readonly SLIDE_SECONDS = 0.3;

  public initialize(source: AchievementSource, onBack: () => void): void {
    this.source = source;
    this.onBack = onBack;
    this.build();
  }

  public present(): void {
    this.filter = 'all';
    this.flipped.clear();
    this.flipping.clear();
    this.lastLocatedId = '';
    this.results.clear();
    this.readResults();
    this.routeShade.active = true;
    this.routeShadeOpacity.opacity = 0;
    this.node.active = true;
    this.resize();
    this.render();
    this.scroll.scrollToTop(0);
    this.node.setPosition(view.getVisibleSize().width, 0);
    this.slide = 'in';
    this.slideTime = 0;
  }

  public dismiss(): void {
    this.slide = null;
    this.flipping.clear();
    this.routeShade.active = false;
    this.node.active = false;
  }

  protected update(dt: number): void {
    if (!this.node.active) return;
    this.resize();
    this.updateScrollBar();
    if (!this.slide) return;
    this.slideTime = Math.min(AchievementController.SLIDE_SECONDS,
      this.slideTime + Math.max(0, dt));
    const progress = this.slideTime / AchievementController.SLIDE_SECONDS;
    const eased = 1 - (1 - progress) ** 3;
    // The original wx.navigateTo push darkens the uncovered home page briefly.
    this.routeShadeOpacity.opacity = Math.round(68 * Math.sin(Math.PI * progress));
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
    this.slide = 'out';
    this.slideTime = 0;
  }

  private build(): void {
    this.routeShade = createRect('AchievementRouteShade', this.node.parent!,
      DESIGN_WIDTH, 2400, '#000000');
    this.routeShade.setSiblingIndex(this.node.getSiblingIndex());
    this.routeShade.addComponent(BlockInputEvents);
    this.routeShadeOpacity = this.routeShade.addComponent(UIOpacity);
    this.routeShadeOpacity.opacity = 0;
    this.routeShade.active = false;
    this.node.addComponent(BlockInputEvents);
    createRect('AchievementBackground', this.node, DESIGN_WIDTH, 2400, BG);
    this.viewport = createNode('AchievementViewport', this.node, DESIGN_WIDTH, 1000);
    this.viewport.addComponent(Mask);
    this.scroll = this.viewport.addComponent(ScrollView);
    this.scroll.horizontal = false;
    this.scroll.vertical = true;
    this.scroll.elastic = false;
    this.content = createNode('AchievementContent', this.viewport, DESIGN_WIDTH, 1000);
    this.scroll.content = this.content;
    this.scrollBar = createNode('AchievementScrollTrack', this.node, 3, 1000, 369, -212);
    this.scrollBar.addComponent(Graphics);
    this.scrollThumb = createNode('AchievementScrollThumb', this.scrollBar, 4, 100);
    this.scrollThumb.addComponent(Graphics);

    this.nav = createNode('AchievementNavigation', this.node, DESIGN_WIDTH, 128);
    createRect('NavigationBackground', this.nav, DESIGN_WIDTH, 128, BG);
    const back = createNode('AchievementBack', this.nav, 88, 88, -331, -12);
    back.addComponent(Button).transition = Button.Transition.NONE;
    createLabel('Arrow', back, '‹', 48, TEXT, 80, 78);
    back.on(Button.EventType.CLICK, () => this.close());
    createLabel('NavigationTitle', this.nav, '成就', 34, TEXT, 280, 56, 0, -12);

    this.header = createNode('AchievementHeader', this.node, DESIGN_WIDTH, 200);
    createLabel('PageTitle', this.header, '成就', 40, TEXT, 350, 60,
      -167, 64, HorizontalTextAlignment.LEFT).isBold = true;
    this.titleDot = createRect('UnreadDot', this.header, 10, 10,
      '#e88d62', -245, 67, 5);
    this.countLabel = createLabel('Completion', this.header, '已完成 0 / 80',
      24, '#dab17c', 300, 44, 184, 66, HorizontalTextAlignment.RIGHT);
    createLabel('Copy', this.header, '点亮成就，翻面看一句留给你的话。',
      24, MUTED, 684, 52, 0, 3, HorizontalTextAlignment.LEFT);
    this.progressTrack = createRect('ProgressTrack', this.header, 684, 6,
      '#30302d', 0, -55, 3);
    this.progressFill = createRect('ProgressFill', this.header, 1, 6, '#c8945e',
      -341.5, -55, 3);

    this.toolbar = createNode('AchievementToolbar', this.node, DESIGN_WIDTH, 96);
    createRect('ToolbarBackground', this.toolbar, DESIGN_WIDTH, 96, BG);
    createRect('ToolbarRule', this.toolbar, DESIGN_WIDTH, 1, '#353637', 0, -47);
    this.node.active = false;
  }

  private resize(): void {
    const height = view.getVisibleSize().height;
    if (height === this.height) return;
    this.height = height;
    this.routeShade.getComponent(UITransform)!.setContentSize(DESIGN_WIDTH, height);
    this.node.getComponent(UITransform)!.setContentSize(DESIGN_WIDTH, height);
    this.nav.setPosition(0, height / 2 - 64);
    this.header.setPosition(0, height / 2 - 228);
    this.toolbar.setPosition(0, height / 2 - 376);
    this.viewport.getComponent(UITransform)!.setContentSize(DESIGN_WIDTH,
      Math.max(220, height - 424));
    this.viewport.setPosition(0, -212);
    this.render();
    this.updateScrollBar();
  }

  private updateScrollBar(): void {
    if (!this.scrollBar || !this.content) return;
    const viewportHeight = this.viewport.getComponent(UITransform)!.height;
    const contentHeight = this.content.getComponent(UITransform)!.height;
    const maxOffset = contentHeight - viewportHeight;
    this.scrollBar.active = !this.loadError && maxOffset > 1;
    if (!this.scrollBar.active) return;
    this.scrollBar.setPosition(369, -212);
    const thumbHeight = Math.max(44, Math.min(viewportHeight,
      viewportHeight * viewportHeight / contentHeight));
    if (this.paintedViewportHeight !== viewportHeight
      || this.paintedContentHeight !== contentHeight) {
      this.paintedViewportHeight = viewportHeight;
      this.paintedContentHeight = contentHeight;
      this.scrollBar.getComponent(UITransform)!.setContentSize(3, viewportHeight);
      const track = this.scrollBar.getComponent(Graphics)!;
      track.clear();
      track.fillColor = color('#333536', 150);
      track.roundRect(-1.5, -viewportHeight / 2, 3, viewportHeight, 1.5);
      track.fill();
      this.scrollThumb.getComponent(UITransform)!.setContentSize(4, thumbHeight);
      const thumb = this.scrollThumb.getComponent(Graphics)!;
      thumb.clear();
      thumb.fillColor = color('#aaa093', 220);
      thumb.roundRect(-2, -thumbHeight / 2, 4, thumbHeight, 2);
      thumb.fill();
    }
    const offset = Math.max(0, Math.min(maxOffset, this.scroll.getScrollOffset().y));
    const position = viewportHeight / 2 - thumbHeight / 2
      - (offset / maxOffset) * (viewportHeight - thumbHeight);
    this.scrollThumb.setPosition(0, position);
  }

  private render(): void {
    if (!this.content) return;
    // A filter or viewport rebuild discards the old flippers. Do not keep their
    // click locks for the new row nodes.
    this.flipping.clear();
    this.renderHeader();
    this.toolbar.active = !this.loadError;
    if (!this.loadError) this.renderToolbar();
    for (const child of [...this.content.children]) child.destroy();
    if (this.loadError) {
      const bodyHeight = Math.max(300, this.height - 424);
      this.content.getComponent(UITransform)!.setContentSize(DESIGN_WIDTH, bodyHeight);
      createLabel('ErrorTitle', this.content, '成就暂时读不出来', 30,
        '#e0d1c3', 680, 65, 0, bodyHeight / 2 - 80,
        HorizontalTextAlignment.LEFT);
      createLabel('ErrorCopy', this.content, '记录仍保留在本机，可以稍后重试。',
        24, MUTED, 680, 55, 0, bodyHeight / 2 - 140,
        HorizontalTextAlignment.LEFT);
      const retry = createNode('Retry', this.content, 210, 64,
        -235, bodyHeight / 2 - 225);
      retry.addComponent(Button).transition = Button.Transition.NONE;
      createLabel('Text', retry, '重新读取', 26, GOLD, 200, 60);
      retry.on(Button.EventType.CLICK, () => {
        this.readResults();
        this.render();
      });
      return;
    }
    const availableGroups = this.results.get(SPECIAL_ACHIEVEMENT.id)?.completed
      ? [...ACHIEVEMENT_GROUPS, { id: 'ordeal', title: '八十一难',
        items: [SPECIAL_ACHIEVEMENT] }] : ACHIEVEMENT_GROUPS;
    const groups = availableGroups.map((group) => ({
      ...group,
      visible: group.items.filter((item) => this.matches(item)),
    })).filter((group) => group.visible.length > 0);
    const bodyHeight = Math.max(this.height - 424, groups.reduce((sum, group) =>
      sum + 88 + (group.id === 'mysteries' ? 48 : 0)
        + group.visible.length * (ROW_HEIGHT + ROW_GAP) + 36, 32));
    this.content.getComponent(UITransform)!.setContentSize(DESIGN_WIDTH, bodyHeight);
    let top = bodyHeight / 2 - 32;
    if (!groups.length) {
      const message = this.filter === 'completed'
        ? '还没有已完成的成就，先从一次体验开始。' : '这一页已全部点亮。';
      createLabel('Empty', this.content, message, 26, MUTED, 670, 100,
        0, top - 110);
      return;
    }
    for (const group of groups) {
      const complete = group.items.filter((item) => this.isCompleted(item)).length;
      const count = group.id === 'mysteries' ? `已揭晓 ${complete}/10`
        : group.id === 'ordeal' ? '已发现'
          : `已完成 ${complete}/${group.items.length}`;
      createLabel('GroupTitle', this.content, group.title, 29, '#e3d9cc',
        360, 50, -162, top - 25, HorizontalTextAlignment.LEFT).isBold = true;
      if (group.items.some((item) => this.results.get(item.id)?.unread)) {
        createRect(`GroupUnreadDot-${group.id}`, this.content, 10, 10, '#e88d62',
          Math.min(18, -342 + group.title.length * 29 + 17), top - 25, 5);
      }
      createLabel('GroupCount', this.content, count, 22, '#b5a28c',
        250, 46, 210, top - 25, HorizontalTextAlignment.RIGHT);
      if (group.id === 'mysteries') {
        createLabel('GroupNote', this.content, '名字是线索，完成后揭晓条件。',
          22, '#a69b8d', 670, 38, 0, top - 63, HorizontalTextAlignment.LEFT);
        top -= 48;
      }
      top -= 88;
      for (const item of group.visible) {
        this.renderRow(item, group.id, top - ROW_HEIGHT / 2);
        top -= ROW_HEIGHT + ROW_GAP;
      }
      top -= 36;
    }
  }

  private renderHeader(): void {
    const completed = ACHIEVEMENT_GROUPS.reduce((sum, group) =>
      sum + group.items.filter((item) => this.isCompleted(item)).length, 0);
    const total = ACHIEVEMENT_GROUPS.reduce((sum, group) => sum + group.items.length, 0);
    this.countLabel.string = `已完成 ${completed} / ${total}`;
    this.countLabel.node.active = !this.loadError;
    this.progressTrack.active = !this.loadError;
    this.progressFill.active = !this.loadError;
    this.titleDot.active = [...this.results.values()].some((item) => item.unread);
    const width = Math.max(1, 684 * completed / total);
    this.progressFill.getComponent(UITransform)!.setContentSize(width, 6);
    this.progressFill.setPosition(-342 + width / 2, -55);
    const graphic = this.progressFill.getComponent(Graphics)!;
    graphic.clear();
    if (completed > 0) {
      graphic.fillColor = color('#c8945e');
      graphic.roundRect(-width / 2, -3, width, 6, 3);
      graphic.fill();
    }
  }

  private renderToolbar(): void {
    for (const child of [...this.toolbar.children]) {
      if (child.name.startsWith('Filter') || child.name === 'Unread') child.destroy();
    }
    const entries: ReadonlyArray<[Filter, string]> = [
      ['all', '全部'], ['incomplete', '未完成'], ['completed', '已完成'],
    ];
    entries.forEach(([filter, title], index) => {
      const active = this.filter === filter;
      const x = -250 + index * 190;
      const button = createNode(`Filter${filter}`, this.toolbar, 190, 88, x, 4);
      button.addComponent(Button).transition = Button.Transition.NONE;
      createLabel('Text', button, title, 25, active ? '#e6bb85' : '#aaa297',
        180, 70).isBold = active;
      if (active) createRect('Underline', button, 150, 3, '#d09257', 0, -43);
      button.on(Button.EventType.CLICK, () => {
        if (this.filter === filter) return;
        this.filter = filter;
        this.flipped.clear();
        this.render();
        this.scroll.scrollToTop(0);
      });
    });
    if ([...this.results.values()].some((item) => item.unread)) {
      const unread = createNode('Unread', this.toolbar, 162, 88, 277, 4);
      unread.addComponent(Button).transition = Button.Transition.NONE;
      createLabel('Text', unread, '下一条未读', 22, GOLD, 158, 70);
      unread.on(Button.EventType.CLICK, () => this.locateUnread());
    }
  }

  private renderRow(item: AchievementItem, groupId: string, y: number): void {
    const result = this.results.get(item.id);
    const complete = !!result?.completed;
    const flipped = complete && this.flipped.has(item.id);
    const row = createRect(`AchievementRow-${item.id}`, this.content, 684,
      ROW_HEIGHT, complete ? '#1c1b18' : '#17191a', 0, y, 10,
      complete ? '#514233' : '#343637');
    createAchievementIcon(row, item.id, complete,
      groupId === 'mysteries' && !complete, -284, 0);
    // Keep the shell and icon still; the old page flips only the text column.
    const flipper = createNode('Flipper', row, 568, 132, 56, 0);
    const front = createNode('Front', flipper, 568, 132);
    const back = createNode('Back', flipper, 568, 132);
    createLabel('Name', front, item.title, 28, '#e5dbce', 420, 42,
      -75, 47, HorizontalTextAlignment.LEFT).isBold = true;
    const unreadDot = createRect('UnreadDot', front, 10, 10,
      '#e88d62', Math.min(160, -229 + item.title.length * 28 + 13) - 56,
      48, 5);
    unreadDot.active = !!result?.unread;
    const condition = groupId === 'mysteries' && !complete
      ? '条件：？？？' : item.condition;
    createLabel('Condition', front, condition, 24,
      groupId === 'mysteries' && !complete ? '#bca182' : '#b0a699',
      470, 50, -49, 2, HorizontalTextAlignment.LEFT);
    if (result?.progressText && !complete) createLabel('Progress', front,
      `进度 ${result.progressText}`, 22, '#c7a782', 470, 35, -49, -37,
      HorizontalTextAlignment.LEFT);
    createLabel('Status', front, complete ? '已完成' : '未完成', 22,
      complete ? GOLD : '#a3998c', 112, 34, 197, -52,
      HorizontalTextAlignment.RIGHT);
    if (complete) {
      createLabel('BackMessage', back, result?.backMessage || item.backMessage,
        27, '#ebd4b5', 500, 104, -21, 0, HorizontalTextAlignment.LEFT);
      if (result?.firstAchievedLabel) createLabel('BackTime', back,
        result.firstAchievedLabel, 21, '#b3a18b', 440, 35, 31, 49,
        HorizontalTextAlignment.RIGHT);
    }
    front.active = !flipped;
    back.active = flipped;
    if (complete) {
      row.addComponent(Button).transition = Button.Transition.NONE;
      row.on(Button.EventType.CLICK, () => {
        if (this.flipping.has(item.id)) return;
        this.flipping.add(item.id);
        tween(flipper).to(0.18, { scale: new Vec3(1, 0.03, 1) }).call(() => {
          if (!this.node.active || !flipper.isValid) {
            this.flipping.delete(item.id);
            return;
          }
          const showBack = !this.flipped.has(item.id);
          front.active = !showBack;
          back.active = showBack;
          if (showBack) {
            this.flipped.add(item.id);
          } else this.flipped.delete(item.id);
        }).to(0.18, { scale: new Vec3(1, 1, 1) })
          .call(() => {
            if (this.flipping.has(item.id) && flipper.isValid
              && this.node.active && this.flipped.has(item.id)) {
              const current = this.results.get(item.id);
              if (current?.unread && this.source.markRead?.(item.id)) {
                this.results.set(item.id, { ...current, unread: false });
                unreadDot.active = false;
                this.refreshUnreadDecorations(groupId);
              }
            }
            this.flipping.delete(item.id);
          }).start();
      });
    }
  }

  private refreshUnreadDecorations(groupId: string): void {
    this.titleDot.active = [...this.results.values()].some((result) => result.unread);
    const group = ACHIEVEMENT_GROUPS.find((entry) => entry.id === groupId);
    const ids = group?.items.map((item) => item.id) ?? [SPECIAL_ACHIEVEMENT.id];
    const dot = this.content.getChildByName(`GroupUnreadDot-${groupId}`);
    if (dot) dot.active = ids.some((id) => this.results.get(id)?.unread);
    this.renderToolbar();
  }

  private isCompleted(item: AchievementItem): boolean {
    return !!this.results.get(item.id)?.completed;
  }

  private readResults(): void {
    this.results.clear();
    try {
      const values = this.source.readResults();
      this.loadError = values === null;
      for (const result of values ?? []) this.results.set(result.id, result);
    } catch {
      this.loadError = true;
    }
  }

  private matches(item: AchievementItem): boolean {
    return this.filter === 'all' ||
      this.isCompleted(item) === (this.filter === 'completed');
  }

  private locateUnread(): void {
    const unreadItems = [...ACHIEVEMENT_GROUPS.flatMap((group) => group.items),
      SPECIAL_ACHIEVEMENT]
      .filter((item) => this.results.get(item.id)?.unread);
    const last = unreadItems.findIndex((item) => item.id === this.lastLocatedId);
    const unread = unreadItems[(last + 1) % unreadItems.length];
    if (!unread) return;
    if (!this.matches(unread)) {
      this.filter = 'completed';
      this.render();
    }
    this.lastLocatedId = unread.id;
    const row = [...this.content.children].reverse()
      .find((child) => child.name === `AchievementRow-${unread.id}`);
    if (row) this.scroll.scrollToOffset(new Vec2(0,
      Math.max(0, this.content.getComponent(UITransform)!.height / 2 - row.position.y - 80)), 0.3);
  }
}
