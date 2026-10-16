import { _decorator, BlockInputEvents, Component, Graphics, HorizontalTextAlignment,
  Label, Mask, Node, screen, ScrollView, UITransform, UIOpacity,
  VerticalTextAlignment, view } from 'cc';
import { color, createLabel, createNode, createRect, DESIGN_WIDTH } from '../common/UiFactory';
import { UIButton } from '../common/UIButton';

const { ccclass } = _decorator;
const BG = '#0d0f11';
const SCALE = DESIGN_WIDTH / 750;

export interface SettingsActions {
  soundEnabled(): boolean;
  toggleSound(): void;
  localBytes(): number | null;
  openDesktopGuide(): void;
}

// Palette colors from V1.0.8 background-picker; the session currently uses its original background.
const PALETTES: ReadonlyArray<[string, string]> = [
  ['原色', '#725034'], ['墨色', '#171c22'], ['石板', '#38414b'], ['咖啡', '#503629'],
  ['琥珀', '#754421'], ['落日', '#663c47'], ['玫瑰', '#66354b'], ['酒红', '#541f31'],
  ['梅紫', '#493055'], ['鸢尾', '#3e456b'], ['午夜', '#183551'], ['冰川', '#315b6b'],
  ['泻湖', '#1f5756'], ['碧玉', '#355948'], ['森林', '#263f2c'], ['青苔', '#4b5535'],
  ['沙色', '#615141'], ['月色', '#48596a'], ['极光', '#215747'], ['海洋', '#263e79'],
  ['余烬', '#682e24'], ['薰衣草', '#51475f'], ['铜色', '#565044'], ['樱色', '#714555'],
];

@ccclass('SettingsController')
export class SettingsController extends Component {
  private actions!: SettingsActions;
  private onBack!: () => void;
  private page!: Node;
  private nav!: Node;
  private viewport!: Node;
  private scroll!: ScrollView;
  private content!: Node;
  private shell: Node | null = null;
  private detail!: Node;
  private toast!: Label;
  private soundSummary: Label | null = null;
  private capacityLabel: Label | null = null;
  private soundTrack: Graphics | null = null;
  private toastSeconds = 0;
  private layoutKey = '';
  private height = 0;
  private cardWidth = 664;
  private cssWidth = 375;
  private slide: 'in' | 'out' | null = null;
  private slideElapsed = 0;

  public initialize(actions: SettingsActions, onBack: () => void): void {
    this.actions = actions;
    this.onBack = onBack;
    // Keep the full-screen input shield stationary while the page slides.
    this.node.addComponent(BlockInputEvents);
    this.page = createNode('SettingsPage', this.node, DESIGN_WIDTH, 1672);
    this.viewport = createNode('SettingsViewport', this.page, DESIGN_WIDTH, 1500);
    this.viewport.addComponent(Mask);
    this.scroll = this.viewport.addComponent(ScrollView);
    this.scroll.horizontal = false;
    this.scroll.vertical = true;
    this.scroll.elastic = false;
    this.content = createNode('SettingsContent', this.viewport, DESIGN_WIDTH, 1500);
    this.scroll.content = this.content;
    this.nav = createNode('SettingsNavigation', this.page, DESIGN_WIDTH, 100);
    this.detail = createNode('SettingsDetail', this.page, DESIGN_WIDTH, 1672);
    this.detail.addComponent(BlockInputEvents);
    this.detail.active = false;
    this.toast = createLabel('SettingsToast', this.page, '', 25, '#f2ddbf', 800, 80);
    this.toast.node.active = false;
    // Build while the application starts, so opening only updates dynamic values.
    this.resize();
    this.node.active = false;
  }

  public present(): void {
    this.node.active = true;
    this.detail.active = false;
    this.toast.node.active = false;
    this.resize();
    this.refreshData();
    this.scroll.stopAutoScroll();
    this.scroll.scrollToTop(0);
    this.page.setPosition(view.getVisibleSize().width, 0);
    this.slide = 'in';
    this.slideElapsed = 0;
  }

  public dismiss(): void {
    this.slide = null;
    this.node.active = false;
    if (this.detail) this.detail.active = false;
  }

  protected update(dt: number): void {
    this.resize();
    if (this.toastSeconds > 0) {
      this.toastSeconds -= Math.max(0, dt);
      if (this.toastSeconds <= 0) this.toast.node.active = false;
    }
    if (!this.slide) return;
    this.slideElapsed = Math.min(0.3, this.slideElapsed + Math.max(0, dt));
    const p = this.slideElapsed / 0.3;
    const eased = 1 - (1 - p) ** 3;
    this.page.setPosition(view.getVisibleSize().width * (this.slide === 'in' ? 1 - eased : eased), 0);
    if (p >= 1) {
      const leaving = this.slide === 'out';
      this.slide = null;
      if (leaving) { this.dismiss(); this.onBack(); }
    }
  }

  private close(): void {
    if (this.slide) return;
    if (this.detail.active) { this.detail.active = false; return; }
    this.slide = 'out';
    this.slideElapsed = 0;
  }

  private resize(): void {
    this.height = view.getVisibleSize().height;
    this.cssWidth = screen.windowSize.width / (screen.devicePixelRatio || 1) || 375;
    const key = `${this.height}:${this.cssWidth}`;
    if (key === this.layoutKey) return;
    this.layoutKey = key;
    this.detail.active = false;
    const navHeight = 44 * DESIGN_WIDTH / this.cssWidth;
    this.page.getComponent(UITransform)!.setContentSize(DESIGN_WIDTH, this.height);
    let background = this.page.getChildByName('SettingsBackground');
    if (!background) {
      background = createRect('SettingsBackground', this.page, DESIGN_WIDTH, this.height, BG);
      background.setSiblingIndex(0);
    }
    const graphics = background.getComponent(Graphics)!;
    graphics.clear();
    graphics.fillColor = color(BG);
    graphics.rect(-DESIGN_WIDTH / 2, -this.height / 2, DESIGN_WIDTH, this.height);
    graphics.fill();
    background.getComponent(UITransform)!.setContentSize(DESIGN_WIDTH, this.height);
    this.viewport.getComponent(UITransform)!.setContentSize(DESIGN_WIDTH, Math.max(1, this.height - navHeight));
    this.viewport.setPosition(0, -navHeight / 2);
    this.clearChildren(this.nav);
    this.nav.setPosition(0, this.height / 2 - navHeight / 2);
    createRect('NavigationBackground', this.nav, DESIGN_WIDTH, navHeight, BG);
    const back = createNode('Back', this.nav, navHeight, navHeight, -DESIGN_WIDTH / 2 + navHeight / 2);
    createLabel('Arrow', back, '‹', navHeight * 0.6, '#eee5da', navHeight, navHeight);
    this.bind(back, () => this.close());
    createLabel('Title', this.nav, '设置', 17 * DESIGN_WIDTH / this.cssWidth,
      '#eee5da', 300, navHeight);
    this.toast.node.setPosition(0, -this.height / 2 + 100 * SCALE);
    this.renderBody();
    this.scroll.stopAutoScroll();
    this.scroll.scrollToTop(0);
  }

  private clearChildren(parent: Node): void {
    for (const child of [...parent.children]) { child.removeFromParent(); child.destroy(); }
  }

  private font(rpx: number, minimum = 12): number {
    return Math.max(rpx, minimum * 750 / this.cssWidth);
  }

  /** Top/left coordinates in the legacy 750rpx space; measure actual Label wrapping. */
  private text(parent: Node, name: string, value: string, size: number, width: number,
    left: number, top: number, ink = '#928c84', bold = false, line = 1.5): Label {
    const label = createLabel(name, parent, value, size, ink, width, size * line);
    label.isBold = bold;
    label.lineHeight = size * line;
    label.horizontalAlign = HorizontalTextAlignment.LEFT;
    label.verticalAlign = VerticalTextAlignment.TOP;
    label.overflow = Label.Overflow.RESIZE_HEIGHT;
    label.updateRenderData(true);
    const transform = label.node.getComponent(UITransform)!;
    label.node.setPosition(left + width / 2, -top - transform.height / 2);
    return label;
  }

  private textHeight(label: Label): number { return label.node.getComponent(UITransform)!.height; }

  private bind(node: Node, action: () => void): void {
    UIButton.bind(node, () => { if (!this.slide) action(); });
    const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
    node.on(Node.EventType.TOUCH_START, () => { opacity.opacity = 205; });
    const release = (): void => { opacity.opacity = 255; };
    node.on(Node.EventType.TOUCH_END, release);
    node.on(Node.EventType.TOUCH_CANCEL, release);
  }

  private notice(message: string): void {
    this.toast.string = message;
    this.toast.node.active = true;
    this.toastSeconds = 2;
  }

  private unavailable(title: string): void { this.notice(`${title}暂未开放`); }

  private refreshData(): void {
    if (this.soundSummary) this.soundSummary.string = this.actions.soundEnabled() ? '已开启  ›' : '已关闭  ›';
    if (this.capacityLabel) {
      const bytes = this.actions.localBytes();
      const usage = bytes === null ? '读取失败' : bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
      this.capacityLabel.string = `已用空间（估算）  ${usage}`;
    }
  }

  private row(parent: Node, top: number, title: string, note: string,
    action?: () => void, value = '›', checked?: boolean): number {
    const width = this.cardWidth - 48;
    const row = createNode(title, parent, width, 112, 0, -top);
    row.getComponent(UITransform)!.setAnchorPoint(0.5, 1);
    const copyWidth = width - 145;
    const heading = this.text(row, 'Title', title, this.font(26), copyWidth,
      -width / 2, 18, '#e7e0d6', false, 1.35);
    const titleHeight = this.textHeight(heading);
    let used = titleHeight;
    if (note) used += 7 + this.textHeight(this.text(row, 'Note', note, this.font(20), copyWidth,
      -width / 2, 18 + titleHeight + 7));
    const height = Math.max(112, used + 36);
    row.getComponent(UITransform)!.setContentSize(width, height);
    const right = createNode('Control', row, 130, height, width / 2 - 65, -height / 2);
    if (checked !== undefined) {
      const g = right.addComponent(Graphics);
      this.paintSwitch(g, checked, false);
      this.text(row, 'Unavailable', '暂未开放', this.font(18), 130,
        width / 2 - 130, height / 2 + 24, '#827d76');
    } else {
      const label = createLabel('Value', right, value, this.font(21), '#c5885f', 130, height - 16);
      if (title === '音效设置') this.soundSummary = label;
    }
    if (action) this.bind(row, action);
    return height;
  }

  private paintSwitch(g: Graphics, enabled: boolean, available: boolean): void {
    g.clear();
    g.fillColor = color(available && enabled ? '#d37a3d' : '#393b3c');
    g.roundRect(-45, -24, 90, 48, 24); g.fill();
    g.fillColor = color(available ? '#f5eee5' : '#827d76');
    g.circle(enabled ? 21 : -21, 0, 20); g.fill();
  }

  private card(parent: Node, name: string, top: number, build: (node: Node) => number): number {
    const card = createNode(name, parent, this.cardWidth, 1, 0, -top);
    card.getComponent(UITransform)!.setAnchorPoint(0.5, 1);
    const height = build(card);
    card.getComponent(UITransform)!.setContentSize(this.cardWidth, height);
    createRect('CardBackground', card, this.cardWidth, height, '#16181a',
      0, -height / 2, 24, '#36383a').setSiblingIndex(0);
    return height;
  }

  private renderBody(): void {
    if (this.shell) { this.shell.removeFromParent(); this.shell.destroy(); }
    this.soundSummary = null;
    this.capacityLabel = null;
    this.cardWidth = 720 - (this.cssWidth <= 340 ? 44 : 56);
    const left = -this.cardWidth / 2;
    const shell = this.shell = createNode('SettingsShell', this.content, 750, 1);
    shell.getComponent(UITransform)!.setAnchorPoint(0.5, 1);
    shell.setScale(SCALE, SCALE, 1);
    let top = 34;
    this.text(shell, 'Heading', '设置', 50, 240, left + 4, top, '#f0e9df', true, 1.15);
    const desktop = createRect('DesktopGuide', shell, 360, 64, '#281e17',
      -left - 180, -top - 32, 32, '#956439');
    createLabel('Text', desktop, '👉 每天可额外领烟票', this.font(22), '#e4bc87', 340, 60);
    this.bind(desktop, () => this.actions.openDesktopGuide());
    top += 64 + 12;
    top += this.textHeight(this.text(shell, 'Subtitle', '记录、烟票与偏好留在本机。',
      this.font(24), this.cardWidth - 8, left + 4, top, '#aaa39a', false, 1.6)) + 32;
    const profileHeight = 154;
    const profile = createRect('SocialCard', shell, this.cardWidth, profileHeight,
      '#191715', 0, -top - profileHeight / 2, 26, '#4b4038');
    const avatar = createRect('Avatar', profile, 96, 96, '#252728', left + 72, 0, 48, '#765038');
    const avatarGraphic = avatar.getComponent(Graphics)!;
    avatarGraphic.fillColor = color('#918a81');
    avatarGraphic.circle(0, 13, 14); avatarGraphic.fill();
    avatarGraphic.roundRect(-28, -32, 56, 34, 16); avatarGraphic.fill();
    this.text(profile, 'ProfileLabel', '派烟名片', this.font(19), 300, left + 140, -52, '#bf8158');
    this.text(profile, 'Nickname', '未设置', 29, 300, left + 140, -19, '#eee5da', true, 1.3);
    this.text(profile, 'Manage', '去设置  ›', this.font(21), 120, -left - 140, -14, '#c5885f');
    this.bind(profile, () => this.unavailable('派烟名片'));
    top += profileHeight + 14;
    top += this.textHeight(this.text(shell, 'ProfileBoundary', '头像和昵称仅存本机，主动派烟时才随分享发出。',
      this.font(20), this.cardWidth - 8, left + 4, top, '#827d76', false, 1.55)) + 48;
    top += this.textHeight(this.text(shell, 'Experience', '体验', this.font(27), this.cardWidth - 8,
      left + 4, top, '#e3dcd2', true, 1.4)) + 18;
    top += this.card(shell, 'ExperienceCard', top, (card) => {
      let y = 0;
      const add = (title: string, note: string, action?: () => void, value?: string, checked?: boolean): void => {
        if (y > 0) createRect('Divider', card, this.cardWidth - 48, 1, '#2d2f31', 0, -y);
        y += this.row(card, y, title, note, action, value, checked);
      };
      add('音效设置', '管理点火、吸气、吐气与弹灰声音', () => this.openSound(),
        this.actions.soundEnabled() ? '已开启  ›' : '已关闭  ›');
      add('趣味体验', '纯净模式 · 反向抽烟', () => this.unavailable('趣味体验'));
      add('自然燃烧', '关闭后仅吸气时消耗，切到后台也不会燃烧', undefined, undefined, true);
      add('轻触觉', '点亮和吸入封顶时提供轻反馈', undefined, undefined, false);
      add('晃动弹烟灰', '累计打卡1天解锁，解锁后需手动开启', undefined, undefined, false);
      add('减少动态效果', '缩短抽取位移并减少烟雾粒子', undefined, undefined, false);
      y += this.buildPalette(card, y);
      add('开盒与出盒动效', '标准切换 · 暂未开放切换', undefined, '标准切换');
      return y;
    });
    top += 48;
    top += this.textHeight(this.text(shell, 'DataHeading', '本地数据与帮助', this.font(27),
      this.cardWidth - 8, left + 4, top, '#e3dcd2', true, 1.4)) + 9;
    top += this.textHeight(this.text(shell, 'DataCaption', '查看本机数据占用、隐私说明，或清空全部记录。',
      this.font(21), this.cardWidth - 8, left + 4, top, '#918b83', false, 1.6));
    for (const [title, note, content] of [
      ['隐私边界与使用说明', '查看数据保存范围与功能说明', '当前演示数据保存在本浏览器中，包括烟盒、烟票、打卡、戒烟与成就记录。清理浏览器数据会丢失这些记录。\n\n屏幕里的烟不会真的燃烧。无需跟着吸气或憋气。'],
      ['关于', '来一根再说 · 音乐鸣谢', '来一根再说\n\n屏幕里的互动体验。\n\n音乐鸣谢内容待补充。'],
    ]) {
      top += 18;
      top += this.card(shell, title, top, (card) => this.row(card, 0, title, note,
        () => this.openInformation(title, content)));
    }
    top += 24;
    top += this.card(shell, 'FeedbackCard', top, (card) => {
      let y = 28;
      y += this.textHeight(this.text(card, 'Title', '问题反馈', this.font(27), this.cardWidth - 56,
        left + 28, y, '#e3dcd2', true)) + 12;
      y += this.textHeight(this.text(card, 'Note', '如遇到问题，可在这里导出诊断日志，发送给开发者。',
        this.font(21), this.cardWidth - 56, left + 28, y)) + 18;
      y += this.textHeight(this.text(card, 'DiagnosticNote',
        '诊断日志仅包含版本、运行环境、存储占用、完整性检查结果和技术错误信息。导出后由你选择发送对象。',
        this.font(20), this.cardWidth - 56, left + 28, y)) + 18;
      const retry = createRect('ReloadData', card, this.cardWidth - 56, 88, '#252321',
        0, -y - 44, 14, '#665039');
      createLabel('Text', retry, '重新读取数据', this.font(26), '#e6c797', this.cardWidth - 80, 80);
      this.bind(retry, () => { this.refreshData(); this.notice('已重新读取'); });
      y += 106;
      y += this.textHeight(this.text(card, 'Contact', '微信号  暂未配置',
        this.font(24), this.cardWidth - 56, left + 28, y, '#d3c7b4')) + 18;
      const buttonWidth = (this.cardWidth - 72) / 2;
      for (const [index, title] of ['发送诊断日志', '复制诊断信息'].entries()) {
        const button = createRect(`Diagnostic${index}`, card, buttonWidth, 96, '#252321',
          (index === 0 ? -1 : 1) * (buttonWidth + 16) / 2, -y - 48, 14, '#665039');
        createLabel('Text', button, title, this.font(24), '#bbaa91', buttonWidth - 16, 88);
        this.bind(button, () => this.unavailable(title));
      }
      y += 114;
      y += this.textHeight(this.text(card, 'Unavailable', '诊断导出与开发者联系方式暂未开放。',
        this.font(20), this.cardWidth - 56, left + 28, y));
      return y + 28;
    });
    top += 18;
    top += this.card(shell, 'DataCard', top, (card) => {
      let y = 28;
      y += this.textHeight(this.text(card, 'CapacityTitle', '本地记录占用', this.font(25),
        this.cardWidth - 48, left + 24, y, '#ddd6cc', true)) + 12;
      this.capacityLabel = this.text(card, 'Capacity', '已用空间（估算）  读取中', this.font(24),
        this.cardWidth - 48, left + 24, y, '#e1a66b');
      y += this.textHeight(this.capacityLabel) + 24;
      const dangerTop = y;
      y += 24;
      y += this.textHeight(this.text(card, 'DangerTitle', '清空全部本地数据', this.font(27),
        this.cardWidth - 48, left + 24, y, '#e4d9d2', true)) + 10;
      y += this.textHeight(this.text(card, 'DangerNote', '会清空本机烟票、库存、记录和设置。此操作暂未开放。',
        this.font(21), this.cardWidth - 48, left + 24, y, '#a4938d')) + 20;
      const button = createRect('ClearData', card, this.cardWidth - 48, 98, '#211b1a',
        0, -y - 49, 18, '#4b3934');
      createLabel('Text', button, '清空全部本地数据', this.font(27), '#a59189', this.cardWidth - 80, 88);
      y += 122;
      createRect('DangerBackground', card, this.cardWidth - 4, y - dangerTop, '#211716',
        0, -(dangerTop + y) / 2, 20).setSiblingIndex(0);
      return y;
    });
    top += 64;
    shell.getComponent(UITransform)!.setContentSize(750, top);
    const viewportHeight = this.viewport.getComponent(UITransform)!.height;
    const contentHeight = Math.max(viewportHeight, top * SCALE);
    this.content.getComponent(UITransform)!.setContentSize(DESIGN_WIDTH, contentHeight);
    shell.setPosition(0, contentHeight / 2);
    this.refreshData();
  }

  private buildPalette(parent: Node, top: number): number {
    const left = -this.cardWidth / 2 + 24;
    let used = 28;
    used += this.textHeight(this.text(parent, 'BackgroundTitle', '默认背景', this.font(26),
      this.cardWidth - 48, left, top + used, '#e7e0d6')) + 7;
    used += this.textHeight(this.text(parent, 'BackgroundNote', '24 种夜色 · 左右滑动查看 · 暂未开放切换',
      this.font(20), this.cardWidth - 48, left, top + used)) + 12;
    const px = 750 / this.cssWidth;
    const height = 92 * px;
    const viewport = createNode('BackgroundPalette', parent, this.cardWidth - 48, height,
      0, -top - used - height / 2);
    viewport.addComponent(Mask);
    const scroll = viewport.addComponent(ScrollView);
    scroll.horizontal = true; scroll.vertical = false; scroll.elastic = false;
    const width = (24 * 60 + 8) * px;
    const content = createNode('PaletteContent', viewport, width, height);
    scroll.content = content;
    PALETTES.forEach(([title, ink], index) => {
      const x = -width / 2 + (4 + 26 + index * 60) * px;
      const swatch = createNode(`Palette${index}`, content, 52 * px, height, x);
      const g = swatch.addComponent(Graphics);
      g.fillColor = color(ink); g.circle(0, 10 * px, 18 * px); g.fill();
      g.strokeColor = color(index === 0 ? '#edb473' : '#77736d');
      g.lineWidth = px; g.circle(0, 10 * px, (index === 0 ? 22 : 18) * px); g.stroke();
      if (index === 0) createLabel('Check', swatch, '✓', 18 * px, '#fff1db', 36 * px, 36 * px, 0, 10 * px);
      createLabel('Title', swatch, title, 12 * px, '#bdb4a9', 52 * px, 24 * px, 0, -28 * px);
    });
    scroll.scrollToLeft(0);
    return used + height + 10;
  }

  private openInformation(title: string, copy: string): void {
    this.buildDetail(title, (body) => {
      this.text(body, 'Copy', copy, this.font(25), 640, -320, 40, '#aaa39a', false, 1.7);
    });
  }

  private openSound(): void {
    this.buildDetail('音效设置', (body) => {
      this.text(body, 'Heading', '音效总开关', this.font(28), 420, -320, 40, '#eee5da', true);
      this.text(body, 'Note', '控制点火、吸气、吐气和弹灰声音。', this.font(22), 620, -320, 110);
      const toggle = createNode('SoundSwitch', body, 120, 100, 265, -64);
      this.soundTrack = toggle.addComponent(Graphics);
      this.paintSwitch(this.soundTrack, this.actions.soundEnabled(), true);
      this.bind(toggle, () => {
        this.actions.toggleSound();
        this.paintSwitch(this.soundTrack!, this.actions.soundEnabled(), true);
        if (this.soundSummary) this.soundSummary.string = this.actions.soundEnabled() ? '已开启  ›' : '已关闭  ›';
      });
    });
  }

  private buildDetail(title: string, build: (body: Node) => void): void {
    this.clearChildren(this.detail);
    this.detail.active = true;
    const viewportHeight = this.viewport.getComponent(UITransform)!.height;
    this.detail.getComponent(UITransform)!.setContentSize(DESIGN_WIDTH, this.height);
    this.detail.setPosition(0, -((this.height - viewportHeight) / 2));
    createRect('Background', this.detail, DESIGN_WIDTH, this.height, BG);
    const body = createNode('Body', this.detail, 750, viewportHeight / SCALE);
    body.getComponent(UITransform)!.setAnchorPoint(0.5, 1);
    body.setScale(SCALE, SCALE, 1);
    body.setPosition(0, viewportHeight / 2);
    this.text(body, 'Title', title, 44, 640, -320, 30, '#eee5da', true);
    const content = createNode('Content', body, 750, 1000, 0, -110);
    build(content);
    // Navigation remains above this detail layer so Back returns to the settings list.
    this.detail.setSiblingIndex(this.page.children.length - 1);
    this.nav.setSiblingIndex(this.page.children.length - 1);
    this.toast.node.setSiblingIndex(this.page.children.length - 1);
    this.detail.active = true;
  }
}
