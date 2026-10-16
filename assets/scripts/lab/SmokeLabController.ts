import { _decorator, BlockInputEvents, Component, Graphics, HorizontalTextAlignment, Label,
  Mask, Node, screen, ScrollView, sys, UITransform, UIOpacity, Vec2, VerticalTextAlignment, view } from 'cc';
import { color, createLabel, createNode, DESIGN_WIDTH, DESIGN_HEIGHT } from '../common/UiFactory';
import { UIButton } from '../common/UIButton';
import { ENABLE_AD_PREVIEW, ENABLE_SMOKE_LAB_UI_PREVIEW } from '../config/InitialSettings';
import { SmokeLabStore, LabSnapshot } from '../persistence/SmokeLabStore';
import { CanvasTexture } from '../session/effects/CanvasTexture';
import { EXHALE_STYLES, LAB_TABS, LabOption, LabScope, LabTab, RING_FORMATIONS,
  RING_SHAPES, sameScheme, SMOKE_AMOUNTS, SMOKE_COLORS, SmokeScheme, SmokeLabUIHooks } from './SmokeLabModel';
import { SmokeLabPreview } from './SmokeLabPreview';

const { ccclass } = _decorator;
const SCALE = DESIGN_WIDTH / 750;
// Scale the old 375px phone composition as a whole, including CSS px dimensions.
// Actual viewport width is only used to select the narrow-screen layout.
const REFERENCE_PX = 750 / 375;
const TEXT = '#eee2cf', MUTED = '#b5a795', GOLD = '#d8ad76';
const SCOPE_NAME = { box: '本盒方案', type: '本烟种方案', global: '全局方案', default: '系统默认' };
type Dialog = { title: string; copy: string; confirm?: string; run?: () => void;
  cancel?: string; choices?: Array<{ label: string; copy: string; run(): void }> };

/** Full page version of the old smoke-lab-panel. Fixed header/tabs/footer, scrolling options. */
@ccclass('SmokeLabController')
export class SmokeLabController extends Component {
  private store!: SmokeLabStore;
  private onBack!: () => void;
  private background!: CanvasTexture;
  private stage!: Node;
  private header!: Node;
  private context!: Node;
  private tabs!: Node;
  private viewport!: Node;
  private content!: Node;
  private scroll!: ScrollView;
  private footer!: Node;
  private modal!: Node;
  private toast!: Label;
  private snapshot: LabSnapshot | null = null;
  private draft: SmokeScheme | null = null;
  private activeTab: LabTab = 'exhale-color';
  private dialog: Dialog | null = null;
  private height = 0;
  private topInset = 0;
  private bottomInset = 0;
  private cursor = 0;
  private scrollHeight = 0;
  private toastUntil = 0;
  private entryDay = '';
  private nextDayCheck = 0;
  private cssWidth = 375;
  private readonly preview = new SmokeLabPreview();
  private hooks: SmokeLabUIHooks = {};
  private selectionTextures: CanvasTexture[] = [];

  public get modalOpen(): boolean { return this.dialog !== null; }
  private get dirty(): boolean { return !!this.draft && !!this.snapshot && !sameScheme(this.draft, this.snapshot.scheme); }

  public initialize(store: SmokeLabStore, onBack: () => void, hooks: SmokeLabUIHooks = {}): void {
    this.store = store; this.onBack = onBack; this.hooks = hooks;
    this.node.addComponent(BlockInputEvents);
    this.background = new CanvasTexture('LabBackground', this.node, DESIGN_WIDTH, DESIGN_HEIGHT);
    this.stage = createNode('LabStage', this.node, 750, 1332);
    this.stage.setScale(SCALE, SCALE, 1);
    this.header = createNode('LabHeader', this.stage, 750, 100);
    this.context = createNode('LabContext', this.stage, 698, 100);
    this.tabs = createNode('LabTabs', this.stage, 698, 192);
    this.viewport = createNode('LabViewport', this.stage, 750, 800);
    this.viewport.addComponent(Mask);
    this.scroll = this.viewport.addComponent(ScrollView);
    this.scroll.horizontal = false; this.scroll.vertical = true; this.scroll.elastic = false;
    this.content = createNode('LabContent', this.viewport, 750, 1);
    this.content.getComponent(UITransform)!.setAnchorPoint(0.5, 1);
    this.scroll.content = this.content;
    this.footer = createNode('LabFooter', this.stage, 750, 170);
    this.modal = createNode('LabDialog', this.stage, 750, 1332);
    this.modal.addComponent(BlockInputEvents); this.modal.active = false;
    this.toast = createLabel('LabToast', this.stage, '', 26, '#f6ddba', 680, 100);
    this.toast.node.active = false;
    this.node.active = false;
  }

  public present(): void {
    this.snapshot = this.readSnapshot();
    this.draft = this.snapshot ? { ...this.snapshot.scheme } : null;
    this.entryDay = this.snapshot?.day ?? '';
    this.activeTab = 'exhale-color'; this.dialog = null;
    this.node.active = true; this.height = 0; this.layout();
    this.scroll.scrollToTop(0);
  }

  public dismiss(): void {
    this.dialog = null; this.draft = null; this.snapshot = null;
    if (this.modal) this.modal.active = false;
    if (this.toast) this.toast.node.active = false;
    this.node.active = false;
  }

  protected onDestroy(): void { this.releaseSelectionTextures(); this.background?.dispose(); }
  protected update(): void {
    this.layout();
    if (this.toast.node.active && Date.now() >= this.toastUntil) this.toast.node.active = false;
    if (ENABLE_SMOKE_LAB_UI_PREVIEW) return;
    if (Date.now() < this.nextDayCheck) return;
    this.nextDayCheck = Date.now() + 1000;
    const day = this.store.snapshot()?.day;
    if (day && day !== this.entryDay) {
      this.entryDay = day; this.snapshot = this.store.snapshot();
      this.draft = this.snapshot ? { ...this.snapshot.scheme } : null;
      this.dialog = null; this.render(); this.notify('日期已更新，请重新确认今日权限');
    }
  }

  private readSnapshot(): LabSnapshot | null {
    const snapshot = this.store.snapshot();
    return ENABLE_SMOKE_LAB_UI_PREVIEW ? this.preview.resolve(snapshot) : snapshot;
  }

  private granted(id: string): boolean {
    if (!ENABLE_SMOKE_LAB_UI_PREVIEW) return this.store.granted(id);
    if (id === 'ring:unlimited') return this.preview.granted(id);
    if (id.indexOf('lab:') === 0 || id === 'ring:circle') return true;
    if (id.indexOf('formation:') === 0) return this.preview.granted('ring:unlimited');
    return this.store.eligible(id);
  }

  private emitHook(run: () => void): void {
    try { run(); } catch (error) { console.warn('[SmokeLab] UI callback failed', error); }
  }

  private schemeEvent(): { scheme: SmokeScheme; context: LabSnapshot['context']; preview: boolean } {
    return { scheme: { ...this.draft! }, context: { ...this.snapshot!.context }, preview: ENABLE_SMOKE_LAB_UI_PREVIEW };
  }

  private releaseSelectionTextures(): void {
    for (const texture of this.selectionTextures) texture.dispose();
    this.selectionTextures = [];
  }

  private clear(node: Node): void { for (const child of [...node.children]) { child.removeFromParent(); child.destroy(); } }
  private text(parent: Node, name: string, copy: string, font: number, tint: string,
    x: number, top: number, width: number, align = HorizontalTextAlignment.LEFT, lineHeight = font * 1.45): number {
    const label = createLabel(name, parent, copy, font, tint, width, 1, x, -top, align);
    label.node.getComponent(UITransform)!.setAnchorPoint(0.5, 1);
    label.verticalAlign = VerticalTextAlignment.TOP;
    label.lineHeight = Math.ceil(lineHeight);
    label.overflow = Label.Overflow.RESIZE_HEIGHT;
    label.updateRenderData(true);
    return label.node.getComponent(UITransform)!.height;
  }

  private frame(node: Node, width: number, height: number, fill = '#151817', border = '#45423c', cut = 12): void {
    node.getComponent(UITransform)!.setContentSize(width, height);
    const g = node.getComponent(Graphics) ?? node.addComponent(Graphics);
    g.clear(); g.fillColor = color(fill); g.strokeColor = color(border); g.lineWidth = 1;
    g.moveTo(-width / 2 + cut, height / 2); g.lineTo(width / 2 - cut, height / 2);
    g.lineTo(width / 2, height / 2 - cut); g.lineTo(width / 2, -height / 2 + cut);
    g.lineTo(width / 2 - cut, -height / 2); g.lineTo(-width / 2 + cut, -height / 2);
    g.lineTo(-width / 2, -height / 2 + cut); g.lineTo(-width / 2, height / 2 - cut);
    g.close(); g.fill(); g.stroke();
  }

  private button(parent: Node, name: string, copy: string, x: number, y: number,
    width: number, height: number, run: () => void, selected = false, enabled = true): Node {
    const node = createNode(name, parent, width, height, x, y);
    const face = createNode('Face', node, width, height);
    this.frame(face, width, height, selected ? '#3c281e' : '#121514', selected ? '#c17749' : '#454139');
    const control = UIButton.bind(node, run);
    control.visualTarget = face; control.refreshFeedback();
    control.interactable = enabled;
    const label = createLabel('Label', face, copy, 26, enabled ? selected ? '#f0d9c3' : TEXT : '#786f65', width - 16, height - 8);
    label.enableWrapText = true;
    return node;
  }

  private layout(): void {
    const size = view.getVisibleSize(), height = size.height / SCALE;
    const safe = sys.getSafeAreaRect(false);
    const topInset = Math.max(0, size.height - safe.y - safe.height) / SCALE;
    const bottomInset = Math.max(0, safe.y) / SCALE;
    const cssWidth = screen.windowSize.width / (screen.devicePixelRatio || 1) || 375;
    if (height === this.height && topInset === this.topInset && bottomInset === this.bottomInset && cssWidth === this.cssWidth) return;
    this.height = height;
    this.cssWidth = cssWidth;
    this.topInset = topInset; this.bottomInset = bottomInset;
    this.background.resize(size.width, size.height);
    this.background.redraw((ctx) => {
      const gradient = ctx.createLinearGradient(0, height / 2, 0, -height / 2);
      gradient.addColorStop(0, '#101314'); gradient.addColorStop(1, '#080a0b');
      ctx.fillStyle = gradient; ctx.fillRect(-size.width / 2, -size.height / 2, size.width, size.height);
      const glow = ctx.createRadialGradient(size.width * 0.32, size.height * 0.43, 0,
        size.width * 0.32, size.height * 0.43, size.width * 0.48);
      glow.addColorStop(0, 'rgba(196,105,50,0.14)'); glow.addColorStop(1, 'rgba(196,105,50,0)');
      ctx.fillStyle = glow; ctx.fillRect(-size.width / 2, -size.height / 2, size.width, size.height);
    });
    this.header.setPosition(0, height / 2 - topInset - 50);
    this.context.setPosition(0, height / 2 - topInset - 156);
    this.tabs.setPosition(0, height / 2 - topInset - 312);
    const top = 426 + topInset, bottom = 180 + bottomInset;
    this.scrollHeight = Math.max(1, height - top - bottom);
    this.viewport.getComponent(UITransform)!.setContentSize(750, this.scrollHeight);
    this.viewport.setPosition(0, height / 2 - top - this.scrollHeight / 2);
    this.footer.setPosition(0, -height / 2 + bottomInset + 90);
    this.modal.getComponent(UITransform)!.setContentSize(750, height);
    this.toast.node.setPosition(0, -height / 2 + bottomInset + 232);
    this.render();
  }

  private render(resetScroll = false): void {
    const offset = resetScroll ? 0 : this.scroll.getScrollOffset().y;
    this.releaseSelectionTextures();
    for (const node of [this.header, this.context, this.tabs, this.content, this.footer]) this.clear(node);
    this.button(this.header, 'Back', '‹', -316, 0, 88, 84, () => this.requestClose());
    this.text(this.header, 'Title', '烟雾实验室', 36, '#f4eadc', 0, -27, 420);
    this.frame(this.context, 698, 100, '#171a1b', '#5b4c3b', 16);
    const s = this.snapshot;
    this.text(this.context, 'EditingLabel', '当前编辑', 22, '#978b7c', -120, -40, 420);
    const editName = s ? s.context.boxId ? `${s.context.packName} · 第 ${s.context.sequence} 盒` : '当前没有可编辑烟盒' : '暂时读不出来';
    this.text(this.context, 'EditingValue', editName, 25, '#ddd3c6', -120, -3, 420);
    this.text(this.context, 'SourceLabel', ENABLE_SMOKE_LAB_UI_PREVIEW ? '预览方案' : '当前生效', 21, '#978b7c', 244, -38, 160, HorizontalTextAlignment.RIGHT);
    this.text(this.context, 'SourceValue', s ? SCOPE_NAME[s.source] : '—', 24, GOLD, 244, -2, 160, HorizontalTextAlignment.RIGHT);
    LAB_TABS.forEach((tab, index) => {
      this.button(this.tabs, tab.id, tab.label, (index % 3 - 1) * 238, 49 - Math.floor(index / 3) * 100,
        222, 88, () => {
          if (tab.id === 'restore') { this.chooseRestore(); return; }
          this.activeTab = tab.id; this.render(true);
        }, tab.id === this.activeTab, !!s && s.days >= 2);
    });
    this.cursor = 0;
    if (!s || !this.draft) this.note('烟雾方案暂时读不出来，请返回后重试。');
    else if (s.days < 2) this.note('打卡2天解锁');
    else if (this.activeTab === 'style') this.styles();
    else if (this.activeTab === 'ring') this.rings();
    else this.colors();
    const contentHeight = Math.max(this.scrollHeight, this.cursor + 24);
    this.content.getComponent(UITransform)!.setContentSize(750, contentHeight);
    this.content.setPosition(0, this.scrollHeight / 2);
    this.scroll.stopAutoScroll();
    this.scroll.scrollToOffset(new Vec2(0, Math.max(0, Math.min(offset, contentHeight - this.scrollHeight))), 0);
    this.renderFooter(); this.renderDialog();
  }

  private note(copy: string, tint = MUTED): void {
    this.cursor += this.text(this.content, 'Note', copy, 24, tint, 0, this.cursor, 698) + 18;
  }
  private title(copy: string): void { this.cursor += this.text(this.content, 'SectionTitle', copy, 30, TEXT, 0, this.cursor, 698) + 12; }
  private updateDraft(field: keyof SmokeScheme, id: string): void {
    if (!this.draft) return;
    this.draft = { ...this.draft, [field]: id }; this.render();
    this.emitHook(() => this.hooks.onSelectionChanged?.({ ...this.schemeEvent(), field }));
  }

  private access(id: string, label: string): void {
    if (this.granted(id)) return;
    this.button(this.content, 'DailyAccess', label, 0, -this.cursor - 44, 698, 88, () => this.unlock(id));
    this.cursor += 106;
    if (!ENABLE_SMOKE_LAB_UI_PREVIEW) this.note(ENABLE_AD_PREVIEW ? '分享服务未接入；当前可使用广告预览模拟今日解锁。' : '分享及真实广告服务尚未接入，暂不可解锁。', '#978b7c');
  }

  private colors(): void {
    const field = this.activeTab === 'idle' ? 'idleSmokeColor' : this.activeTab === 'exhale-color' ? 'exhaleColor' : 'ringColor';
    const columns = this.cssWidth <= 340 ? 1 : 2;
    const contentWidth = 750 - (columns === 1 ? 24 : 26) * 2;
    this.cursor += this.text(this.content, 'SectionTitle', LAB_TABS.find((tab) => tab.id === this.activeTab)!.label,
      18 * REFERENCE_PX, '#f0e6d8', 0, this.cursor, contentWidth, HorizontalTextAlignment.LEFT, 18 * REFERENCE_PX * 1.4) + 9;
    this.cursor += this.text(this.content, 'Note', ENABLE_SMOKE_LAB_UI_PREVIEW ? '静态色块仅用于选择，当前仅预览界面状态。'
      : '静态色块仅用于选择；保存后可在线上抽烟时看到效果。', 12 * REFERENCE_PX,
      MUTED, 0, this.cursor, contentWidth, HorizontalTextAlignment.LEFT, 12 * REFERENCE_PX * 1.6) + 20;
    const placement = `lab:${this.activeTab}`;
    this.access(placement, '分享畅用今日全部颜色');
    const gap = 8 * REFERENCE_PX;
    const width = (contentWidth - gap * (columns - 1)) / columns;
    const minHeight = 64 * REFERENCE_PX;
    const font = 14 * REFERENCE_PX, noteFont = 12 * REFERENCE_PX;
    const cards: Array<{ node: Node; face: Node; name: Node; note: Node; copyHeight: number;
      nameHeight: number; selected: boolean; enabled: boolean; hex: string; height: number }> = [];
    SMOKE_COLORS.forEach((option) => {
      const enabled = this.granted(placement) && !option.national;
      const selected = this.draft![field] === option.id;
      const hit = this.button(this.content, option.id, '', 0, 0, width, minHeight,
        () => this.updateDraft(field, option.id), selected, enabled);
      const face = hit.getChildByName('Face')!;
      // Legacy layout: 12rpx padding, 34rpx round swatch, 10rpx gap, text, 28rpx check.
      const textWidth = width - 12 * 2 - 34 - 28 - 10 * 2;
      const textX = -width / 2 + 12 + 34 + 10 + textWidth / 2;
      const nameHeight = this.text(face, 'ColorName', option.label, font, '#e9dfd2', textX, 0, textWidth,
        HorizontalTextAlignment.LEFT, font * 1.35);
      const copy = option.national ? '节日集藏奖励 · 锁定' : option.description;
      const noteHeight = this.text(face, 'ColorDescription', copy, noteFont, '#b5a795', textX, 0, textWidth);
      const name = face.getChildByName('ColorName')!, note = face.getChildByName('ColorDescription')!;
      name.getComponent(Label)!.isBold = true;
      const copyHeight = nameHeight + 4 + noteHeight;
      cards.push({ node: hit, face, name, note, nameHeight, copyHeight, selected, enabled,
        hex: option.hex!, height: Math.max(minHeight, copyHeight + 24) });
    });
    for (let row = 0; row < cards.length; row += columns) {
      const group = cards.slice(row, row + columns);
      const height = Math.max(...group.map((card) => card.height));
      group.forEach((card, column) => {
        card.node.getComponent(UITransform)!.setContentSize(width, height);
        card.node.setPosition(-contentWidth / 2 + width / 2 + column * (width + gap), -this.cursor - height / 2);
        this.colorCardFace(card.face, width, height, card.selected);
        card.name.setPosition(card.name.position.x, card.copyHeight / 2);
        card.note.setPosition(card.note.position.x, card.copyHeight / 2 - card.nameHeight - 4);
        const swatch = createNode('ColorSwatch', card.face, 42, 42, -width / 2 + 29, 0);
        const g = swatch.addComponent(Graphics);
        g.strokeColor = color('#ffffff', 9); g.lineWidth = 4; g.circle(0, 0, 19); g.stroke();
        g.fillColor = color(card.hex); g.circle(0, 0, 17); g.fill();
        g.strokeColor = color('#ffffff', 87); g.lineWidth = 2; g.circle(0, 0, 17); g.stroke();
        this.selectionCheck(card.face, width / 2 - 26, card.selected);
        if (!card.enabled) card.face.addComponent(UIOpacity).opacity = 117;
        const feedback = card.node.getComponent(UIButton)!;
        feedback.pressScale = 1; feedback.refreshFeedback();
        const pressed = createNode('PressedHighlight', card.face, width, height);
        const overlay = pressed.addComponent(Graphics);
        this.cardPath(overlay, width, height);
        overlay.fillColor = color('#ffffff', 12); overlay.fill(); pressed.active = false;
        card.node.on(Node.EventType.TOUCH_START, () => { if (feedback.interactable) pressed.active = true; });
        for (const event of [Node.EventType.TOUCH_END, Node.EventType.TOUCH_CANCEL, Node.EventType.MOUSE_LEAVE]) {
          card.node.on(event, () => { pressed.active = false; });
        }
      });
      this.cursor += height + gap;
    }
    if (!this.granted(placement)) this.note('已保存的方案会保留；解锁后可继续调整，也可恢复默认。');
  }

  private cardPath(path: Graphics | CanvasRenderingContext2D, width: number, height: number): void {
    const x = width / 2, y = height / 2, cutX = width * 0.04, cutY = height * 0.16;
    path.moveTo(-x + cutX, y); path.lineTo(x - cutX, y); path.lineTo(x, y - cutY);
    path.lineTo(x, -y + cutY); path.lineTo(x - cutX, -y); path.lineTo(-x + cutX, -y);
    path.lineTo(-x, -y + cutY); path.lineTo(-x, y - cutY);
    if (path instanceof Graphics) path.close(); else path.closePath();
  }

  private colorCardFace(face: Node, width: number, height: number, selected: boolean): void {
    face.getComponent(UITransform)!.setContentSize(width, height);
    const g = face.getComponent(Graphics)!;
    g.clear(); this.cardPath(g, width, height);
    g.fillColor = color('#151817'); g.fill();
    if (selected) {
      const fill = new CanvasTexture('SelectedGradient', face, width, height);
      this.selectionTextures.push(fill);
      fill.redraw((ctx) => {
        ctx.beginPath(); this.cardPath(ctx, width, height); ctx.clip();
        const gradient = ctx.createLinearGradient(-width / 2, height * 0.09, width / 2, -height * 0.09);
        gradient.addColorStop(0, 'rgba(128,75,39,0.28)'); gradient.addColorStop(1, 'rgba(24,27,28,0.96)');
        ctx.fillStyle = gradient; ctx.fillRect(-width / 2, -height / 2, width, height);
      });
      fill.node.setSiblingIndex(0);
    }
    const outline = createNode('Outline', face, width, height).addComponent(Graphics);
    this.cardPath(outline, width, height);
    outline.strokeColor = color(selected ? '#c08b57' : '#45423c'); outline.lineWidth = 1; outline.stroke();
  }

  private selectionCheck(parent: Node, x: number, selected: boolean, y = 0): void {
    const check = createNode('SelectionCheck', parent, 28, 28, x, y);
    const g = check.addComponent(Graphics);
    g.strokeColor = color('#5d5851'); g.lineWidth = 1; g.circle(0, 0, 14); g.stroke();
    if (selected) createLabel('Checkmark', check, '✓', 24, '#eaa06a', 28, 28);
  }

  private option(option: LabOption, selected: boolean, enabled: boolean, run: () => void, extra = ''): void {
    const copyHeight = Math.max(42, Math.ceil((option.description.length + extra.length) / 23) * 32);
    const height = Math.max(112, 64 + copyHeight);
    const hit = this.button(this.content, option.id, '', 0, -this.cursor - height / 2, 698, height, run, selected, enabled);
    const face = hit.getChildByName('Face')!;
    if (selected) this.colorCardFace(face, 698, height, true);
    this.text(face, 'Name', `${option.label}${!enabled ? ' · 锁定' : ''}`, 27,
      enabled ? TEXT : '#978b7c', -23, -height / 2 + 16, 604);
    this.text(face, 'Description', extra || option.description, 23, MUTED, -23, -height / 2 + 58, 604);
    this.selectionCheck(face, 309, selected);
    this.cursor += height + 16;
  }

  private styles(): void {
    this.title('吐雾方式'); this.note('只改变烟雾轨迹，不改变烟支消耗、吸入时长或进度。');
    this.access('lab:style', '分享畅用今日烟量与吐雾方式');
    const granted = this.granted('lab:style');
    EXHALE_STYLES.forEach((o) => this.option(o, this.draft!.exhaleStyle === o.id, granted, () => this.updateDraft('exhaleStyle', o.id)));
    this.cursor += 12; this.title('烟量');
    SMOKE_AMOUNTS.forEach((o, index) => {
      const hit = this.button(this.content, o.id, o.label, (index - 1) * 238, -this.cursor - 54, 222, 108,
        () => this.updateDraft('smokeAmount', o.id), this.draft!.smokeAmount === o.id, granted);
      const label = hit.getChildByName('Face')!.getChildByName('Label')!;
      label.setPosition(0, 18);
      createLabel('AmountDescription', hit.getChildByName('Face')!, o.description, 18, MUTED, 210, 34, 0, -25);
    });
    this.cursor += 140;
    this.handSmoke();
  }

  private handSmoke(): void {
    const s = this.snapshot!;
    this.title('手指拨烟'); this.note('呼气时滑动，烟雾随手势方向飘动。所有烟盒共用，切换后立即生效。');
    if (s.days < 4) this.note(`累计打卡4天解锁 · ${Math.min(4, s.days)}/4 天`);
    this.button(this.content, 'HandSmoke', s.interaction.handSmoke ? '已开启' : s.days < 4 ? '锁定' : '已关闭',
      0, -this.cursor - 44, 698, 88, () => this.changeInteraction({ handSmoke: !s.interaction.handSmoke }), s.interaction.handSmoke, s.days >= 4);
    this.cursor += 112;
  }

  private rings(): void {
    const s = this.snapshot!;
    this.title('今日无限烟圈');
    this.note(this.granted('ring:unlimited') ? '∞ 已解锁 · 今日不限次数，次日重新解锁。' : '每支烟默认3次；解锁后，今天所有烟支均可无限吐圈。');
    this.access('ring:unlimited', '看广告，今日随便吐烟圈');
    this.title('烟圈形状'); this.note('烟圈形状与吐雾方式彼此独立，可任意组合。');
    const group = this.store.groupState('ring');
    if (!ENABLE_SMOKE_LAB_UI_PREVIEW) this.note(`已发现 ${group.count}/${group.total} 种可用样式`);
    if (!ENABLE_SMOKE_LAB_UI_PREVIEW && group.complete && !group.granted) this.access('group:ring', '分享1次，今日整组畅用');
    RING_SHAPES.forEach((o) => {
      const eligible = o.id === 'circle' || this.store.eligible(`ring:${o.id}`);
      const granted = this.granted(`ring:${o.id}`);
      const note = o.national ? '节日集藏奖励尚未接入' : !eligible ? `任务样式 · 完成记录页任务 ${o.task} 后开放；奖励服务待接入`
        : !granted ? '分享解锁，今天随便吐' : o.description;
      this.option(o, this.draft!.ringShape === o.id, eligible,
        () => granted ? this.updateDraft('ringShape', o.id) : this.unlock(`ring:${o.id}`), note);
    });
    this.cursor += 12; this.title('指向烟圈');
    this.note(s.days >= 3 ? '已解锁 · 从吐烟圈按钮向左、右或上方滑动，距离和速度影响初速度。'
      : `累计打卡第3天永久解锁 · ${Math.min(3, s.days)}/3 天`);
    this.title('烟圈编队');
    const unlimited = this.granted('ring:unlimited');
    this.note('累计打卡2天开放；需要今日无限烟圈与编队样式权限，开启后在吐气时触发。');
    const formationGroup = this.store.groupState('formation');
    if (!ENABLE_SMOKE_LAB_UI_PREVIEW) this.note(`已发现 ${formationGroup.count}/${formationGroup.total} 种编队`);
    if (!ENABLE_SMOKE_LAB_UI_PREVIEW && formationGroup.complete && !formationGroup.granted && unlimited) this.access('group:formation', '分享1次，今日编队整组畅用');
    RING_FORMATIONS.forEach((o) => this.option(o, s.interaction.formation === o.id,
      unlimited, () => {
        if (!this.granted(`formation:${o.id}`)) this.unlock(`formation:${o.id}`);
        else this.changeInteraction({ formation: o.id });
      }, !unlimited ? '先解锁今日无限烟圈' : !this.granted(`formation:${o.id}`) ? '分享解锁，今天随便吐' : o.description));
    const canEnable = unlimited && this.granted(`formation:${s.interaction.formation}`);
    this.button(this.content, 'FormationToggle', s.interaction.formationEnabled ? '编队已开启' : '编队已关闭',
      0, -this.cursor - 44, 698, 88, () => this.changeInteraction({ formationEnabled: !s.interaction.formationEnabled }),
      s.interaction.formationEnabled && canEnable, canEnable || s.interaction.formationEnabled);
    this.cursor += 116;
  }

  private changeInteraction(change: Parameters<SmokeLabStore['setInteraction']>[0]): void {
    if (ENABLE_SMOKE_LAB_UI_PREVIEW) this.preview.setInteraction({ ...this.snapshot!.interaction, ...change });
    else if (!this.store.setInteraction(change)) { this.notify('开关没能保存，请检查解锁状态'); return; }
    this.snapshot = this.readSnapshot(); this.render();
    this.emitHook(() => this.hooks.onInteractionChanged?.({ interaction: { ...this.snapshot!.interaction },
      context: { ...this.snapshot!.context }, preview: ENABLE_SMOKE_LAB_UI_PREVIEW }));
  }

  private renderFooter(): void {
    this.frame(this.footer, 750, 180, '#0b0e0f', '#3e382f', 0);
    const s = this.snapshot;
    this.text(this.footer, 'DraftState', `${ENABLE_SMOKE_LAB_UI_PREVIEW ? 'UI预览 · ' : ''}${this.dirty ? '有未保存修改' : !s?.context.boxId ? '当前没有可编辑烟盒，可先保存为全局方案。' : '选择后保存，预留效果接入。'}`,
      22, this.dirty ? GOLD : '#978b7c', 0, -74, 698);
    const unlocked = this.activeTab === 'ring' || this.granted(`lab:${this.activeTab}`);
    const scopes: Array<{ id: LabScope; title: string; note: string; allowed: boolean }> = [
      { id: 'box', title: '保存本盒', note: '只影响这一盒', allowed: !!s?.context.boxId },
      { id: 'type', title: '保存本烟种', note: '该烟种全部烟盒', allowed: !!s?.context.boxId && !!s.context.typeId },
      { id: 'global', title: '全局保存', note: '所有自有烟盒', allowed: true },
    ];
    scopes.forEach((scope, index) => {
      const node = this.button(this.footer, scope.id, '', (index - 1) * 238, -17, 222, 112,
        () => this.save(scope.id), scope.id === (s?.context.boxId ? 'box' : 'global'), !!s && this.dirty && scope.allowed && unlocked);
      const face = node.getChildByName('Face')!;
      const enabled = node.getComponent(UIButton)!.interactable;
      createLabel('SaveTitle', face, scope.title, 26, enabled ? TEXT : '#786f65', 210, 44, 0, 18);
      createLabel('SaveDescription', face, scope.note, 20, enabled ? MUTED : '#786f65', 210, 34, 0, -26);
    });
  }

  private save(scope: LabScope): void {
    const expectedBox = this.snapshot?.context.boxId ?? null;
    const run = (): void => {
      const latest = this.store.snapshot();
      if (!this.draft || !latest || latest.context.boxId !== expectedBox
        || !(ENABLE_SMOKE_LAB_UI_PREVIEW ? this.preview.save(scope, this.draft, latest.context) : this.store.save(scope, this.draft, expectedBox))) {
        this.notify('方案没有保存好，请检查权限或烟盒状态'); return;
      }
      this.reload();
      this.emitHook(() => this.hooks.onSaveScheme?.({ ...this.schemeEvent(), scope }));
      this.notify(ENABLE_SMOKE_LAB_UI_PREVIEW ? '已保存界面预览，烟雾效果后续接入'
        : scope === 'box' ? '已保存到当前烟盒' : scope === 'type' ? '已保存为本烟种方案' : '已应用到所有自有烟盒');
    };
    if (scope === 'box') run();
    else this.openDialog({ title: scope === 'type' ? `保存为“${this.snapshot?.context.packName}”烟种方案？` : '应用到所有烟盒？',
      copy: scope === 'type' ? '该烟种现有和以后获得的烟盒都会使用当前效果；已有的单盒方案将被清除。'
        : '全部自有烟盒都会使用当前效果，已有的本盒和本烟种方案将被清除。好友锁定特效不会被修改。',
      confirm: scope === 'type' ? '确认保存' : '全局应用', cancel: '继续编辑', run });
  }

  private reload(): void {
    this.snapshot = this.readSnapshot(); this.draft = this.snapshot ? { ...this.snapshot.scheme } : null;
    this.render();
  }

  private chooseRestore(): void {
    const s = this.snapshot;
    if (!s) return;
    const choices: NonNullable<Dialog['choices']> = [];
    if (s.context.boxId) choices.push({ label: '恢复本盒', copy: '只恢复当前这一盒', run: () => this.confirmRestore('box') });
    if (s.context.boxId && s.context.typeId) choices.push({ label: '恢复本烟种', copy: '清除该烟种的本盒覆盖', run: () => this.confirmRestore('type') });
    choices.push({ label: '恢复所有烟盒', copy: '清除全部自有烟盒方案', run: () => this.confirmRestore('global') });
    this.openDialog({ title: '选择恢复范围', copy: '恢复后将重新使用系统默认烟雾效果。', choices });
  }

  private confirmRestore(scope: LabScope): void {
    const expectedBox = this.snapshot?.context.boxId ?? null;
    this.openDialog({ title: scope === 'box' ? '恢复本盒默认效果？' : scope === 'type' ? '恢复本烟种默认效果？' : '恢复所有烟盒默认效果？',
      copy: scope === 'box' ? '只恢复当前这一盒；同烟种其他烟盒不会受到影响。' : scope === 'type'
        ? '该烟种恢复默认，并清除该烟种已有的本盒方案。' : '全部本盒、本烟种和全局方案都会被清除；互动能力不受影响。',
      confirm: scope === 'global' ? '确认全部恢复' : '确认恢复', run: () => {
        const latest = this.store.snapshot();
        if (!latest || latest.context.boxId !== expectedBox
          || !(ENABLE_SMOKE_LAB_UI_PREVIEW ? this.preview.restore(scope, latest.context) : this.store.restore(scope, expectedBox))) {
          this.notify('默认方案没有恢复好'); return;
        }
        this.reload();
        this.emitHook(() => this.hooks.onRestoreScheme?.({ ...this.schemeEvent(), scope }));
        this.notify(ENABLE_SMOKE_LAB_UI_PREVIEW ? '界面预览已恢复默认' : '已恢复默认');
      } });
  }

  private unlock(placement: string): void {
    if (ENABLE_SMOKE_LAB_UI_PREVIEW) {
      this.openDialog({ title: '界面预览', copy: '此操作只预览解锁后的界面状态；实际权限与烟雾效果后续通过接口接入。',
        confirm: '预览解锁', run: () => { this.preview.grant(placement); this.render(); } });
      return;
    }
    if (!ENABLE_AD_PREVIEW) { this.notify('分享及真实广告服务尚未接入'); return; }
    const requestedDay = this.snapshot?.day ?? '';
    this.openDialog({ title: '广告预览', copy: '当前为开发预览，不会播放真实广告。点击“模拟完成”后获得今天的对应权限；取消不解锁。',
      confirm: '模拟完成', run: () => {
        if (!this.store.grantAccess(placement, requestedDay)) { this.notify('解锁未完成，请检查日期或前置权限'); return; }
        this.render(); this.notify('已模拟解锁今日权限');
      } });
  }

  private requestClose(): void {
    if (this.dirty) this.openDialog({ title: '尚有未保存的修改', copy: '是否放弃本次修改？',
      confirm: '放弃修改', cancel: '继续编辑', run: () => this.onBack() });
    else this.onBack();
  }
  private notify(copy: string): void { this.toast.string = copy; this.toast.node.active = true; this.toastUntil = Date.now() + 2200; }
  private openDialog(dialog: Dialog): void { this.dialog = dialog; this.renderDialog(); }

  private renderDialog(): void {
    this.clear(this.modal); this.modal.active = !!this.dialog;
    const dialog = this.dialog;
    if (!dialog) return;
    const scrim = createNode('Scrim', this.modal, 750, this.height);
    const g = scrim.addComponent(Graphics); g.fillColor = color('#000000', 180);
    g.rect(-375, -this.height / 2, 750, this.height); g.fill();
    UIButton.bind(scrim, () => { this.dialog = null; this.renderDialog(); });
    // Make long dialog text scroll inside its own viewport on short displays.
    const maxHeight = Math.max(180, this.height - this.topInset - this.bottomInset - 96);
    const body = createNode('DialogCard', this.modal, 650, maxHeight);
    const dialogY = (this.bottomInset - this.topInset) / 2;
    body.setPosition(0, dialogY);
    const bodyMask = body.addComponent(Mask);
    bodyMask.enabled = true;
    const scroll = body.addComponent(ScrollView); scroll.horizontal = false; scroll.elastic = false;
    const inner = createNode('DialogContent', body, 650, 1);
    inner.getComponent(UITransform)!.setAnchorPoint(0.5, 1); scroll.content = inner;
    let top = 32;
    top += this.text(inner, 'Title', dialog.title, 31, '#f0dfc6', 0, top, 586) + 20;
    top += this.text(inner, 'Copy', dialog.copy, 25, MUTED, 0, top, 586) + 28;
    for (const choice of dialog.choices ?? []) {
      const hit = this.button(inner, 'Scope', `${choice.label}\n${choice.copy}`, 0, -top - 55, 586, 110, () => choice.run());
      // The dialog itself blocks input; nested controls are explicit modal actions.
      UIButton.bind(hit, () => choice.run());
      top += 126;
    }
    if (dialog.run) {
      const confirm = this.button(inner, 'Confirm', dialog.confirm ?? '确认', 151, -top - 44, 284, 88, () => undefined, true);
      UIButton.bind(confirm, () => { this.dialog = null; this.renderDialog(); dialog.run!(); });
      const cancel = this.button(inner, 'Cancel', dialog.cancel ?? '取消', -151, -top - 44, 284, 88, () => undefined);
      UIButton.bind(cancel, () => { this.dialog = null; this.renderDialog(); });
    } else {
      const cancel = this.button(inner, 'Cancel', '取消', 0, -top - 44, 586, 88, () => undefined);
      UIButton.bind(cancel, () => { this.dialog = null; this.renderDialog(); });
    }
    top += 120;
    const height = Math.min(maxHeight, top);
    body.getComponent(UITransform)!.setContentSize(650, height);
    const face = createNode('DialogBackground', this.modal, 650, height);
    face.setPosition(0, dialogY);
    this.frame(face, 650, height, '#181a18', '#8b6847', 18);
    face.setSiblingIndex(1);
    inner.getComponent(UITransform)!.setContentSize(650, top);
    inner.setPosition(0, height / 2); scroll.scrollToTop(0);
  }
}
