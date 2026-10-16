import { _decorator, BlockInputEvents, Component, Graphics, HorizontalTextAlignment,
  Label, Mask, Node, screen, ScrollView, UITransform, UIOpacity,
  VerticalTextAlignment, view } from 'cc';
import { color, createLabel, createNode, createRect, DESIGN_WIDTH } from './UiFactory';
import { UIButton } from './UIButton';

const { ccclass } = _decorator;
const SCALE = DESIGN_WIDTH / 750;
const WIDTH = 680;

/** Shared V1.0.8 add-to-my-mini-program tutorial; browser builds cannot verify rewards. */
@ccclass('DesktopGuide')
export class DesktopGuide extends Component {
  private viewport!: Node;
  private content!: Node;
  private scroll!: ScrollView;
  private status: Label | null = null;
  private layoutKey = '';
  private cssWidth = 375;
  private onClose: (() => void) | null = null;

  public initialize(onClose?: () => void): void {
    this.onClose = onClose ?? null;
    this.node.addComponent(BlockInputEvents);
    this.render();
    this.node.active = false;
  }

  public present(): void {
    this.node.active = true;
    this.node.setSiblingIndex(this.node.parent!.children.length - 1);
    this.render();
    this.scroll.stopAutoScroll();
    this.scroll.scrollToTop(0);
  }

  public dismiss(): void {
    if (!this.node.active) return;
    this.node.active = false;
    this.onClose?.();
  }

  protected update(): void { this.render(); }

  private font(rpx: number, minimum = 12): number {
    return Math.max(rpx, minimum * 750 / this.cssWidth);
  }

  private text(parent: Node, name: string, copy: string, size: number,
    width: number, left: number, top: number, ink = '#b6aa9c', bold = false): Label {
    const label = createLabel(name, parent, copy, size, ink, width, size * 1.5);
    label.lineHeight = size * 1.5;
    label.isBold = bold;
    label.horizontalAlign = HorizontalTextAlignment.LEFT;
    label.verticalAlign = VerticalTextAlignment.TOP;
    label.overflow = Label.Overflow.RESIZE_HEIGHT;
    label.updateRenderData(true);
    const transform = label.node.getComponent(UITransform)!;
    label.node.setPosition(left + width / 2, -top - transform.height / 2);
    return label;
  }

  private height(label: Label): number { return label.node.getComponent(UITransform)!.height; }

  private bind(node: Node, callback: () => void): void {
    UIButton.bind(node, callback);
    const opacity = node.addComponent(UIOpacity);
    node.on(Node.EventType.TOUCH_START, () => { opacity.opacity = 205; });
    const release = (): void => { opacity.opacity = 255; };
    node.on(Node.EventType.TOUCH_END, release);
    node.on(Node.EventType.TOUCH_CANCEL, release);
  }

  private render(): void {
    const size = view.getVisibleSize();
    this.cssWidth = screen.windowSize.width / (screen.devicePixelRatio || 1) || 375;
    const key = `${size.width}:${size.height}:${this.cssWidth}`;
    if (key === this.layoutKey) return;
    this.layoutKey = key;
    for (const child of [...this.node.children]) { child.removeFromParent(); child.destroy(); }
    this.node.getComponent(UITransform)!.setContentSize(size.width, size.height);
    const backdrop = createNode('DesktopGuideScrim', this.node, size.width, size.height);
    const scrim = backdrop.addComponent(Graphics);
    // Graphics uploads its own vertex colors; put the CSS alpha in fillColor itself.
    // UIOpacity on an opaque Graphics rectangle does not update those mesh colors.
    scrim.fillColor = color('#020404', Math.round(255 * 0.82));
    scrim.rect(-size.width / 2, -size.height / 2, size.width, size.height);
    scrim.fill();
    UIButton.bind(backdrop, () => this.dismiss());

    const dialog = createNode('DesktopGuideDialog', this.node, WIDTH, 1);
    dialog.setScale(SCALE, SCALE, 1);
    dialog.addComponent(BlockInputEvents);
    const header = createNode('Header', dialog, WIDTH, 1);
    header.getComponent(UITransform)!.setAnchorPoint(0.5, 1);
    const closeSize = Math.max(80, 44 * 750 / this.cssWidth);
    const title = this.text(header, 'Title', '添加到我的小程序', 34,
      WIDTH - 28 - 24 - closeSize - 12, -WIDTH / 2 + 28, 28, '#f0e9df', true);
    const headingHeight = Math.max(48, this.height(title));
    const close = createNode('Close', header, closeSize, closeSize,
      WIDTH / 2 - 14 - closeSize / 2, -14 - closeSize / 2);
    const cross = close.addComponent(Graphics);
    cross.strokeColor = color('#c5b7a6'); cross.lineWidth = 2;
    cross.moveTo(-10, -10); cross.lineTo(10, 10);
    cross.moveTo(-10, 10); cross.lineTo(10, -10); cross.stroke();
    this.bind(close, () => this.dismiss());

    const rewardTop = 28 + headingHeight + 14;
    const claimWidth = Math.min(98 * 750 / this.cssWidth,
      Math.max(160, 84 * 750 / this.cssWidth));
    const copyWidth = WIDTH - 28 - 24 - 20 - claimWidth;
    const reward = this.text(header, 'RewardTitle', '首次添加，送 2 张烟票', this.font(26, 14),
      copyWidth, -WIDTH / 2 + 28, rewardTop, '#f1c593', true);
    const note = this.text(header, 'RewardNote', '从次日起每天可再领 1 张', this.font(21),
      copyWidth, -WIDTH / 2 + 28, rewardTop + this.height(reward) + 4);
    const claimHeight = Math.max(76, 44 * 750 / this.cssWidth);
    const rewardHeight = Math.max(claimHeight, this.height(reward) + 4 + this.height(note));
    const claim = createRect('ClaimReward', header, claimWidth, claimHeight, '#302820',
      WIDTH / 2 - 24 - claimWidth / 2, -rewardTop - rewardHeight / 2, 14, '#5f4c3a');
    createLabel('Text', claim, '领 2 张烟票', this.font(23, 13), '#b6aa9c', claimWidth - 16, claimHeight - 12);
    UIButton.bind(claim).interactable = false;
    this.status = this.text(header, 'Status', '当前浏览器无法检查微信添加状态，请在微信小程序中操作。',
      this.font(22), WIDTH - 56, -WIDTH / 2 + 28, rewardTop + rewardHeight + 18, '#edb780');
    const headerHeight = rewardTop + rewardHeight + 18 + this.height(this.status) + 22;

    const footerHeight = 22 + Math.max(88, 44 * 750 / this.cssWidth) + 26;
    this.viewport = createNode('DesktopGuideViewport', dialog, WIDTH, 1);
    this.viewport.addComponent(Mask);
    this.scroll = this.viewport.addComponent(ScrollView);
    this.scroll.horizontal = false; this.scroll.vertical = true; this.scroll.elastic = false;
    this.content = createNode('DesktopGuideContent', this.viewport, WIDTH, 1);
    this.content.getComponent(UITransform)!.setAnchorPoint(0.5, 1);
    this.scroll.content = this.content;
    const bodyHeight = this.buildSteps();
    const available = Math.max(1, size.height / SCALE - 48);
    const viewportHeight = Math.max(1, Math.min(bodyHeight, available - headerHeight - footerHeight));
    const dialogHeight = headerHeight + viewportHeight + footerHeight;
    dialog.getComponent(UITransform)!.setContentSize(WIDTH, dialogHeight);
    header.setPosition(0, dialogHeight / 2);
    const frame = createRect('DialogBackground', dialog, WIDTH, dialogHeight, '#191a19',
      0, 0, 26, '#66503d');
    frame.setSiblingIndex(0);
    createRect('HeaderRule', dialog, WIDTH - 2, 1, '#35332f', 0, dialogHeight / 2 - headerHeight);
    this.viewport.getComponent(UITransform)!.setContentSize(WIDTH - 2, viewportHeight);
    this.viewport.setPosition(0, dialogHeight / 2 - headerHeight - viewportHeight / 2);
    this.content.getComponent(UITransform)!.setContentSize(WIDTH, Math.max(bodyHeight, viewportHeight));
    this.content.setPosition(0, viewportHeight / 2);
    const footer = createNode('Footer', dialog, WIDTH, footerHeight,
      0, -dialogHeight / 2 + footerHeight / 2);
    createRect('Rule', footer, WIDTH - 2, 1, '#35332f', 0, footerHeight / 2);
    const confirmHeight = footerHeight - 48;
    const confirm = createRect('Confirm', footer, WIDTH - 56, confirmHeight, '#e29a61',
      0, -2, 16);
    createLabel('Text', confirm, '重新检查', this.font(26, 14), '#29180d', WIDTH - 96, confirmHeight - 16).isBold = true;
    this.bind(confirm, () => {
      if (this.status) this.status.string = '当前浏览器无法检查微信添加状态，请在微信小程序中操作。';
    });
    // V1.0.8: bottom sheet on mobile, centered at CSS widths >= 600px.
    dialog.setPosition(0, this.cssWidth >= 600 ? 0 : -size.height / 2 + (24 + dialogHeight / 2) * SCALE);
    this.scroll.scrollToTop(0);
  }

  private step(number: string, title: string, top: number): number {
    const marker = createRect(`Step${number}`, this.content, 40, 40, '#35281e', -WIDTH / 2 + 48, -top - 20, 20);
    createLabel('Number', marker, number, this.font(23), '#efbc88', 40, 40).isBold = true;
    const label = this.text(this.content, `Step${number}Title`, title, this.font(26, 14),
      WIDTH - 110, -WIDTH / 2 + 82, top, '#e6dfd5', true);
    return Math.max(40, this.height(label));
  }

  private buildSteps(): number {
    let top = 26;
    top += this.step('1', '点击右上角“···”', top) + 18;
    const preview = createRect('WechatMenuPreview', this.content, WIDTH - 56, 116, '#101214',
      0, -top - 58, 16, '#3a3b38');
    createLabel('AppName', preview, '来一根再说', this.font(24), '#c9c2b9', 300, 64,
      -WIDTH / 2 + 198, 0, HorizontalTextAlignment.LEFT);
    const capsule = createRect('Capsule', preview, 160, 58, '#101214', WIDTH / 2 - 128, 0, 29, '#74726c');
    const dots = createRect('MenuDots', capsule, 72, 44, '#352419', -36, 0, 22, '#dc965e');
    const g = dots.getComponent(Graphics)!;
    g.fillColor = color('#f1c593');
    for (const x of [-13, 0, 13]) { g.circle(x, 0, 3.5); g.fill(); }
    createRect('Divider', capsule, 1, 28, '#6c6b65', 10);
    const icon = createNode('MiniProgramClose', capsule, 25, 25, 45);
    const ring = icon.addComponent(Graphics);
    ring.strokeColor = color('#ddd7cd'); ring.lineWidth = 4; ring.circle(0, 0, 10.5); ring.stroke();
    top += 116 + 30;
    top += this.step('2', '选择“添加到我的小程序”', top) + 18;
    const labelFont = this.font(23);
    const hintFont = this.font(20);
    const optionHeight = 20 + 58 + 16 + labelFont * 3 + 6 + hintFont * 1.5 + 20;
    const optionsHeight = optionHeight + 40;
    const options = createRect('MenuOptions', this.content, WIDTH - 56, optionsHeight,
      '#101214', 0, -top - optionsHeight / 2, 16);
    const optionWidth = (WIDTH - 116) / 2;
    for (let index = 0; index < 2; index++) {
      const x = (index === 0 ? -1 : 1) * (optionWidth + 20) / 2;
      const option = createRect(index === 0 ? 'AddToMy' : 'AddToDesktop', options,
        optionWidth, optionHeight, index === 0 ? '#2d2118' : '#101214', x, 0, 12,
        index === 0 ? '#bd8452' : undefined);
      const iconY = optionHeight / 2 - 49;
      const mark = createNode('Illustration', option, 58, 58, 0, iconY);
      const graphic = mark.addComponent(Graphics);
      if (index === 0) {
        graphic.fillColor = color('#edb780');
        for (const x of [-13.5, 13.5]) for (const y of [-13.5, 13.5]) {
          graphic.circle(x, y, 10.5); graphic.fill();
        }
      } else {
        graphic.strokeColor = color('#a99476'); graphic.lineWidth = 4;
        graphic.roundRect(-18, -27, 36, 54, 5); graphic.stroke();
        graphic.fillColor = color('#a99476'); graphic.circle(0, -20, 3); graphic.fill();
      }
      const labelHeight = labelFont * 1.5 * (index === 0 ? 2 : 1);
      const labelTop = iconY - 29 - 16;
      const label = createLabel('Label', option, index === 0 ? '添加到\n我的小程序' : '添加到桌面',
        labelFont, index === 0 ? '#f1c593' : '#c9c2b9', optionWidth - 20,
        labelHeight, 0, labelTop - labelHeight / 2);
      label.lineHeight = labelFont * 1.5; label.isBold = index === 0;
      createLabel('Hint', option, index === 0 ? '选择这一项' : '仅快捷入口', hintFont,
        index === 0 ? '#d1af8c' : '#b6aa9c', optionWidth - 20, hintFont * 1.5,
        0, labelTop - labelHeight - 6 - hintFont * 0.75);
    }
    return top + optionsHeight + 26;
  }
}
