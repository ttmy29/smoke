import { _decorator, BlockInputEvents, Button, Component, Graphics, HorizontalTextAlignment,
  Label, Mask, Node,
  ScrollView, UITransform, view } from 'cc';
import { color, createLabel, createNode, createRect, DESIGN_HEIGHT, DESIGN_WIDTH } from '../common/UiFactory';
import { CanvasTexture } from '../session/effects/CanvasTexture';
import { CheckInSnapshot, CheckInStore } from '../persistence/CheckInStore';
import { PreviewRewardedVideoGateway, RewardedVideoGateway, RewardedVideoResult } from '../services/RewardedVideo';

const { ccclass } = _decorator;

@ccclass('CheckInController')
export class CheckInController extends Component {
  private pageRoot!: Node;
  private slideDirection: 'in' | 'out' | null = null;
  private slideElapsed = 0;
  private static readonly SLIDE_DURATION = 0.3;
  private content!: Node;
  private shellRoot!: Node;
  private navRoot!: Node;
  private shellGradient!: CanvasTexture;
  private viewport!: Node;
  private scroll!: ScrollView;
  private viewportHeight = 0;
  private ticketPaper!: Node;
  private dateLabel!: Label;
  private weekdayLabel!: Label;
  private serialLabel!: Label;
  private ticketTitle!: Label;
  private ticketNote!: Label;
  private issuedStamp!: Node;
  private streakLabel!: Label;
  private streakUnitLabel!: Label;
  private balanceLabel!: Label;
  private checkButton!: Button;
  private checkButtonLabel!: Label;
  private extraButton!: Node;
  private extraDone!: Node;
  private notice!: Label;
  private adOverlay!: Node;
  private unlockOverlay!: Node;
  private unlockTitle!: Label;
  private unlockDescription!: Label;
  private adResolver: ((result: RewardedVideoResult) => void) | null = null;
  private adGateway!: RewardedVideoGateway;
  private busy = false;
  private checkPressed = false;
  private snapshot: CheckInSnapshot | null = null;
  private onBack: (() => void) | null = null;
  private onChanged: (() => void) | null = null;
  private store!: CheckInStore;

  public initialize(store: CheckInStore, onBack: () => void, onChanged: () => void,
    gateway?: RewardedVideoGateway): void {
    this.store = store;
    this.onBack = onBack;
    this.onChanged = onChanged;
    this.build();
    this.adGateway = gateway ?? new PreviewRewardedVideoGateway(() => this.presentPreviewAd());
  }

  public present(): void {
    this.busy = false;
    this.adOverlay.active = false;
    this.unlockOverlay.active = false;
    this.notice.string = '';
    this.refresh();
    this.resizeViewport();
    this.scroll.scrollToTop(0);
    this.slideDirection = 'in';
    this.slideElapsed = 0;
    this.pageRoot.setPosition(view.getVisibleSize().width, 0);
  }

  public dismiss(): void {
    this.resolvePreviewAd('cancelled');
    this.busy = false;
    this.slideDirection = null;
    this.pageRoot?.setPosition(0, 0);
  }

  protected onDestroy(): void {
    this.dismiss();
    this.shellGradient?.dispose();
  }

  protected update(deltaTime: number): void {
    this.resizeViewport();
    if (this.slideDirection) {
      this.slideElapsed = Math.min(CheckInController.SLIDE_DURATION,
        this.slideElapsed + Math.max(0, deltaTime));
      const progress = this.slideElapsed / CheckInController.SLIDE_DURATION;
      const ease = 1 - Math.pow(1 - progress, 3);
      const width = view.getVisibleSize().width;
      this.pageRoot.setPosition(this.slideDirection === 'in'
        ? width * (1 - ease) : width * ease, 0);
      if (progress >= 1) {
        const closing = this.slideDirection === 'out';
        this.slideDirection = null;
        if (closing) this.onBack?.();
      }
    }
  }

  private beginBack(): void {
    if (this.busy || this.slideDirection || this.unlockOverlay.active || this.adOverlay.active) return;
    this.slideDirection = 'out';
    this.slideElapsed = 0;
  }

  private resizeViewport(): void {
    if (!this.viewport) return;
    const height = view.getVisibleSize().height;
    if (height === this.viewportHeight) return;
    this.viewportHeight = height;
    this.viewport.getComponent(UITransform)?.setContentSize(DESIGN_WIDTH, height);
    this.navRoot.setPosition(0, height / 2 - 44);
    this.scroll.scrollToTop(0);
  }

  private refresh(): void {
    const now = Date.now();
    const date = new Date(now);
    const two = (value: number): string => value < 10 ? `0${value}` : String(value);
    const snapshot = this.store.readSnapshot(now);
    this.snapshot = snapshot;
    this.dateLabel.string = `${date.getMonth() + 1} 月 ${date.getDate()} 日`;
    this.weekdayLabel.string = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][date.getDay()];
    this.serialLabel.string = `NO. ${date.getFullYear()}${two(date.getMonth() + 1)}${two(date.getDate())}`;
    const checked = snapshot?.checkedToday ?? false;
    this.ticketTitle.string = checked ? '今日已领取' : '今日烟票';
    this.ticketNote.string = checked ? '明天再来，票机不会重复出票。' : '打卡后，烟票余额 +1 张。';
    this.ticketTitle.node.setPosition(-119, checked ? 46 : 28);
    this.ticketPaper.getComponent(Graphics)!.fillColor = color(checked ? '#c8c0b2' : '#d6cdbd');
    this.paintTicketPaper(checked);
    this.issuedStamp.active = checked;
    this.streakLabel.string = String(snapshot?.streak ?? 0);
    this.streakUnitLabel.node.setPosition(-315 + this.streakLabel.string.length * 28 + 22, -23);
    this.balanceLabel.string = snapshot === null ? '--' :
      snapshot.ticketBalance < 100 ? two(snapshot.ticketBalance)
        : String(snapshot.ticketBalance);
    this.checkButton.interactable = !checked && !this.busy && snapshot !== null;
    this.checkButtonLabel.string = this.busy ? '正在出票' : checked ? '今天已领取' : '打卡，领 1 张烟票';
    this.paintCheckButton();
    this.extraButton.active = checked && !snapshot?.extraTicketClaimed;
    this.extraDone.active = checked && !!snapshot?.extraTicketClaimed;
    if (snapshot === null) this.notice.string = '本机存档不可用，暂时无法打卡';
  }

  private checkInToday(): void {
    if (this.busy || this.snapshot?.checkedToday || !this.snapshot) return;
    const previousDays = this.snapshot.cumulativeDays;
    this.busy = true;
    this.refresh();
    const result = this.store.checkInToday();
    this.busy = false;
    this.refresh();
    if (result === 'checked') {
      this.notice.string = '烟票 +1';
      this.onChanged?.();
      const currentDays = this.snapshot?.cumulativeDays ?? previousDays;
      this.showUnlocks(previousDays, currentDays);
    } else {
      this.notice.string = result === 'already-checked' ? '今天已经领过了' : '打卡没完成，请重试';
    }
  }

  private showUnlocks(previousDays: number, currentDays: number): void {
    const unlocked: string[] = [];
    if (previousDays < 1 && currentDays >= 1) unlocked.push('晃动弹烟灰');
    if (previousDays < 2 && currentDays >= 2) unlocked.push('烟圈编队', '烟雾实验室');
    if (previousDays < 3 && currentDays >= 3) unlocked.push('指向烟圈', '记录');
    if (previousDays < 4 && currentDays >= 4) unlocked.push('手指拨烟');
    if (unlocked.length === 0) return;
    this.unlockTitle.string = `打卡第 ${currentDays} 天`;
    this.unlockDescription.string = `解锁：${unlocked.join('、')}`;
    this.unlockOverlay.active = true;
  }

  private async claimExtraTicket(): Promise<void> {
    if (this.busy || !this.snapshot?.checkedToday || this.snapshot.extraTicketClaimed) return;
    this.busy = true;
    let result: RewardedVideoResult;
    try {
      result = await this.adGateway.show({ placement: 'checkin:extra-ticket',
        resourceId: new Date().toDateString() });
    } catch {
      result = 'error';
    }
    if (!this.isValid || !this.node.active) return;
    this.busy = false;
    if (result === 'completed') {
      if (this.store.claimExtraTicket()) {
        this.notice.string = '额外烟票 +1';
        this.onChanged?.();
      } else {
        this.notice.string = '额外烟票领取失败';
      }
    } else if (result === 'error' || result === 'unavailable') {
      this.notice.string = '广告暂不可用，请稍后再试';
    }
    this.refresh();
  }

  private presentPreviewAd(): Promise<RewardedVideoResult> {
    if (this.adResolver) return Promise.resolve('error');
    this.adOverlay.active = true;
    return new Promise((resolve) => { this.adResolver = resolve; });
  }

  private resolvePreviewAd(result: RewardedVideoResult): void {
    if (this.adOverlay) this.adOverlay.active = false;
    const resolve = this.adResolver;
    this.adResolver = null;
    resolve?.(result);
  }

  private paintTicketPaper(checked: boolean): void {
    const graphics = this.ticketPaper.getComponent(Graphics)!;
    graphics.clear();
    graphics.fillColor = color(checked ? '#c8c0b2' : '#d6cdbd');
    graphics.moveTo(-311, 86);
    graphics.lineTo(311, 86);
    graphics.lineTo(323, 74);
    graphics.lineTo(323, -74);
    graphics.lineTo(311, -86);
    graphics.lineTo(-311, -86);
    graphics.lineTo(-323, -74);
    graphics.lineTo(-323, 74);
    graphics.close();
    graphics.fill();
  }

  private paintCheckButton(): void {
    const graphics = this.checkButton.node.getComponent(Graphics)!;
    graphics.clear();
    graphics.fillColor = color(this.checkButton.interactable
      ? this.checkPressed ? '#ad5933' : '#c66a3d' : '#282a29');
    graphics.roundRect(-341, -50, 682, 100, 12);
    graphics.fill();
    this.checkButtonLabel.color = color(this.checkButton.interactable ? '#191512' : '#aba59b');
  }

  private build(): void {
    const shield = createNode('CheckInputShield', this.node, DESIGN_WIDTH, 2400);
    shield.addComponent(BlockInputEvents);
    this.pageRoot = createNode('CheckPageRoot', this.node, DESIGN_WIDTH, DESIGN_HEIGHT);
    createRect('CheckBackground', this.pageRoot, DESIGN_WIDTH, 2400, '#101214');
    this.viewport = createNode('CheckViewport', this.pageRoot, DESIGN_WIDTH, DESIGN_HEIGHT);
    this.viewport.addComponent(Mask);
    this.scroll = this.viewport.addComponent(ScrollView);
    this.scroll.horizontal = false;
    this.scroll.vertical = true;
    this.scroll.elastic = false;
    this.content = createNode('CheckContent', this.viewport, DESIGN_WIDTH, DESIGN_HEIGHT);
    this.scroll.content = this.content;
    this.shellRoot = createNode('CheckShell', this.content, DESIGN_WIDTH, DESIGN_HEIGHT);
    this.navRoot = createNode('CheckNav', this.pageRoot, DESIGN_WIDTH, 88);
    createRect('NavBarBackground', this.navRoot, DESIGN_WIDTH, 88, '#101214');
    const back = createRect('Back', this.navRoot, 76, 66, '#1b1d1d', -325, -11, 10, '#474946');
    back.addComponent(Button).transition = Button.Transition.SCALE;
    createLabel('BackGlyph', back, '‹', 48, '#e2dccf', 64, 60);
    back.on(Button.EventType.CLICK, () => this.beginBack());
    createLabel('NavTitle', this.navRoot, '每日烟票', 32, '#e2dccf', 300, 54, 0, -11);
    createRect('TopLine', this.navRoot, 682, 2, '#434442', 0, -62);

    this.shellGradient = new CanvasTexture('CheckShellGradient', this.shellRoot, 750, 360);
    this.shellGradient.node.setPosition(0, 532);
    this.shellGradient.redraw((ctx) => {
      const gradient = ctx.createLinearGradient(0, 180, 0, -180);
      gradient.addColorStop(0, 'rgba(34,35,35,0.82)');
      gradient.addColorStop(1, 'rgba(34,35,35,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(-375, -180, 750, 360);
    });

    createLabel('CheckTitle', this.shellRoot, '今天领一张烟票', 52, '#e2dccf',
      430, 80, -126, 640, HorizontalTextAlignment.LEFT).isBold = true;
    createLabel('CheckSubtitle', this.shellRoot, '每天一次，只保存在这台设备里。', 24,
      '#9f9990', 430, 52, -126, 577, HorizontalTextAlignment.LEFT);
    const badge = createNode('DateBadge', this.shellRoot, 154, 84, 264, 624);
    createRect('BadgeTop', badge, 154, 2, '#5b5b57', 0, 42);
    createRect('BadgeBottom', badge, 154, 2, '#343532', 0, -42);
    this.dateLabel = createLabel('Date', badge, '', 24, '#c1baae', 126, 38,
      0, 16, HorizontalTextAlignment.RIGHT);
    this.weekdayLabel = createLabel('Weekday', badge, '', 24, '#928d85', 126, 34,
      0, -20, HorizontalTextAlignment.RIGHT);

    const machine = createRect('TicketMachine', this.shellRoot, 682, 238,
      '#191b1c', 0, 412, 16, '#474946');
    createLabel('DailyPass', machine, 'DAILY PASS', 24, '#969089', 280, 34,
      -172, 86, HorizontalTextAlignment.LEFT);
    this.serialLabel = createLabel('Serial', machine, '', 24, '#969089', 320, 34,
      166, 86, HorizontalTextAlignment.RIGHT);
    this.ticketPaper = createNode('TicketPaper', machine, 646, 172, 0, -17);
    this.ticketPaper.addComponent(Graphics);
    this.paintTicketPaper(false);
    this.ticketTitle = createLabel('TicketTitle', this.ticketPaper, '今日烟票', 42,
      '#30271f', 340, 60, -119, 28, HorizontalTextAlignment.LEFT);
    this.ticketTitle.isBold = true;
    this.ticketNote = createLabel('TicketNote', this.ticketPaper,
      '打卡后，烟票余额 +1 张。', 24, '#5d5148', 355, 74,
      -110, -34, HorizontalTextAlignment.LEFT);
    this.ticketNote.overflow = Label.Overflow.RESIZE_HEIGHT;
    const perforation = createNode('Perforation', this.ticketPaper, 2, 116, 175, 0)
      .addComponent(Graphics);
    perforation.strokeColor = color('#8e8174');
    perforation.lineWidth = 1;
    for (let y = -58; y < 58; y += 12) {
      perforation.moveTo(0, y);
      perforation.lineTo(0, Math.min(58, y + 6));
    }
    perforation.stroke();
    createLabel('StubValue', this.ticketPaper, '+1', 66, '#a64f2c', 125, 80, 249, 19).isBold = true;
    createLabel('StubLabel', this.ticketPaper, '烟票', 24, '#5d5148', 125, 40, 249, -40);
    this.issuedStamp = createNode('IssuedStamp', machine, 166, 44, 80, -65);
    const stampFrame = this.issuedStamp.addComponent(Graphics);
    stampFrame.strokeColor = color('#a45232');
    stampFrame.lineWidth = 1.5;
    stampFrame.rect(-83, -22, 166, 44);
    stampFrame.rect(-79, -18, 158, 36);
    stampFrame.stroke();
    this.issuedStamp.setRotationFromEuler(0, 0, -7);
    createLabel('IssuedStampText', this.issuedStamp, '已 出 票', 24, '#a45232', 150, 34);

    const board = createRect('StatusBoard', this.shellRoot, 682, 122, '#151718', 0, 208);
    createRect('BoardTop', board, 682, 2, '#444542', 0, 61);
    createRect('BoardBottom', board, 682, 2, '#2f312f', 0, -61);
    createRect('BoardDivider', board, 2, 82, '#343633');
    createLabel('StreakCaption', board, '连续打卡', 24, '#969087', 240, 32,
      -195, 27, HorizontalTextAlignment.LEFT);
    this.streakLabel = createLabel('StreakValue', board, '0', 48, '#d9d2c6', 130, 58,
      -250, -19, HorizontalTextAlignment.LEFT);
    this.streakUnitLabel = createLabel('StreakUnit', board, '天', 24, '#8a857d', 48, 40, -252, -23);
    createLabel('BalanceCaption', board, '当前烟票', 24, '#969087', 240, 32,
      195, 27, HorizontalTextAlignment.RIGHT);
    this.balanceLabel = createLabel('BalanceValue', board, '00', 48, '#d9d2c6', 130, 58,
      204, -19, HorizontalTextAlignment.RIGHT);
    createLabel('BalanceUnit', board, '张', 24, '#8a857d', 48, 40, 291, -23);

    const check = createNode('CheckButton', this.shellRoot, 682, 100, 0, 73);
    check.addComponent(Graphics);
    this.checkButton = check.addComponent(Button);
    this.checkButton.transition = Button.Transition.SCALE;
    this.checkButton.zoomScale = 0.98;
    this.checkButtonLabel = createLabel('CheckButtonText', check, '', 28, '#191512', 650, 70);
    check.on(Button.EventType.CLICK, () => this.checkInToday());
    check.on(Node.EventType.TOUCH_START, () => {
      this.checkPressed = true;
      this.paintCheckButton();
    });
    const clearCheckPress = (): void => {
      this.checkPressed = false;
      this.paintCheckButton();
    };
    check.on(Node.EventType.TOUCH_END, clearCheckPress);
    check.on(Node.EventType.TOUCH_CANCEL, clearCheckPress);
    createLabel('LocalNote', this.shellRoot, '同一天重复进入不会重复加票', 24,
      '#928d85', 650, 48, 0, -18);
    this.extraButton = createNode('ExtraTicket', this.shellRoot, 682, 142, 0, -105);
    createLabel('ExtraHeading', this.extraButton, '每日可选加领', 34,
      '#e6d7c4', 650, 42, 0, 50).isBold = true;
    const extraAction = createRect('ExtraAction', this.extraButton, 682, 88,
      '#33261c', 0, -26, 20, '#87623f');
    extraAction.addComponent(Button).transition = Button.Transition.SCALE;
    createLabel('ExtraTicketText', extraAction, '看广告 +1',
      26, '#f3dab8', 650, 65);
    extraAction.on(Button.EventType.CLICK, () => { void this.claimExtraTicket(); });
    this.extraDone = createNode('ExtraDone', this.shellRoot, 682, 48, 0, -66);
    createLabel('ExtraDoneText', this.extraDone, '今日额外烟票已领取 · +1 张',
      22, '#b8a58d', 650, 48);
    this.notice = createLabel('CheckNotice', this.shellRoot, '', 22, '#d8bc87',
      650, 52, 0, -224);

    this.adOverlay = createRect('AdOverlay', this.pageRoot, DESIGN_WIDTH, 2400, '#070808');
    this.adOverlay.addComponent(BlockInputEvents);
    const adModal = createRect('AdModal', this.adOverlay, 600, 460, '#191b1b',
      0, 0, 18, '#766342');
    createLabel('AdTitle', adModal, '广告预览', 36, '#e2dccf', 510, 60, 0, 150);
    createLabel('AdDescription', adModal, '真实激励广告暂未接入\n仅供测试额外烟票流程',
      22, '#c7ad89', 520, 100, 0, 48);
    const adComplete = createRect('AdComplete', adModal, 470, 78, '#49301d',
      0, -70, 12, '#b57f4a');
    adComplete.addComponent(Button).transition = Button.Transition.SCALE;
    createLabel('AdCompleteText', adComplete, '模拟广告完成', 27, '#ffe0a2', 450, 64);
    adComplete.on(Button.EventType.CLICK, () => this.resolvePreviewAd('completed'));
    const adCancel = createRect('AdCancel', adModal, 470, 70, '#242626',
      0, -164, 12, '#64635e');
    adCancel.addComponent(Button).transition = Button.Transition.SCALE;
    createLabel('AdCancelText', adCancel, '关闭，不领取', 25, '#e2dccf', 450, 62);
    adCancel.on(Button.EventType.CLICK, () => this.resolvePreviewAd('cancelled'));
    this.adOverlay.active = false;

    this.unlockOverlay = createRect('UnlockOverlay', this.pageRoot, DESIGN_WIDTH, 2400, '#070808');
    this.unlockOverlay.addComponent(BlockInputEvents);
    const unlockCard = createRect('UnlockCard', this.unlockOverlay, 600, 420,
      '#191c1b', 0, 0, 28, '#8b7149');
    createLabel('UnlockEyebrow', unlockCard, '新的内容已解锁', 22, '#cdb181', 500, 42, 0, 145);
    this.unlockTitle = createLabel('UnlockTitle', unlockCard, '', 40, '#f0e4d0', 520, 70, 0, 76);
    this.unlockDescription = createLabel('UnlockDescription', unlockCard, '', 25,
      '#c7b9a0', 510, 106, 0, -14);
    const unlockClose = createRect('UnlockClose', unlockCard, 420, 72,
      '#5c4930', 0, -137, 12, '#d6b477');
    unlockClose.addComponent(Button).transition = Button.Transition.SCALE;
    createLabel('UnlockCloseText', unlockClose, '知道了', 26, '#f0e4d0', 400, 60);
    unlockClose.on(Button.EventType.CLICK, () => { this.unlockOverlay.active = false; });
    this.unlockOverlay.active = false;
  }
}
