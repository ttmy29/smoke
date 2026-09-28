import { _decorator, BlockInputEvents, Button, Component, Graphics, Label, Node, view } from 'cc';
import { createButton, createLabel, createNode, createRect, DESIGN_HEIGHT, DESIGN_WIDTH, Palette, color } from '../common/UiFactory';
import { PackSnapshot } from '../persistence/PackStore';
import { PreviewRewardedVideoGateway, RewardedVideoGateway, RewardedVideoResult } from '../services/RewardedVideo';

const { ccclass } = _decorator;

@ccclass('SupplyController')
export class SupplyController extends Component {
  private contentRoot!: Node;
  private adOverlay!: Node;
  private notice!: Label;
  private packCodeLabel!: Label;
  private adResolver: ((result: RewardedVideoResult) => void) | null = null;
  private adGateway!: RewardedVideoGateway;
  private onBack: (() => void) | null = null;
  private onRefill: ((instanceId: string) => boolean) | null = null;
  private packInstanceId = '';
  private busy = false;

  public initialize(onBack: () => void, onRefill: (instanceId: string) => boolean,
    gateway?: RewardedVideoGateway): void {
    this.onBack = onBack;
    this.onRefill = onRefill;
    this.build();
    this.adGateway = gateway ?? new PreviewRewardedVideoGateway(() => this.presentPreviewAd());
  }

  public present(pack: PackSnapshot): void {
    this.packInstanceId = pack.instanceId;
    this.packCodeLabel.string = `WANG·XI · 第 ${pack.sequence} 盒`;
    this.notice.string = '';
    this.busy = false;
    this.adOverlay.active = false;
  }

  public dismiss(): void {
    this.resolvePreviewAd('cancelled');
    this.busy = false;
  }

  protected onDestroy(): void {
    this.resolvePreviewAd('cancelled');
  }

  protected update(): void {
    if (!this.contentRoot) return;
    this.contentRoot.setScale(Math.min(1, view.getVisibleSize().height / DESIGN_HEIGHT),
      Math.min(1, view.getVisibleSize().height / DESIGN_HEIGHT), 1);
  }

  private build(): void {
    createRect('SupplyBackground', this.node, DESIGN_WIDTH, 2400, '#0e1011');
    this.contentRoot = createNode('SupplyContent', this.node, DESIGN_WIDTH, DESIGN_HEIGHT);
    createButton('Back', this.contentRoot, '‹', 64, 64, '#0e1011', Palette.white,
      -330, 705, () => { if (!this.busy) this.onBack?.(); });
    createLabel('PageTitle', this.contentRoot, '选一盒', 26, Palette.white, 280, 52, 0, 705);
    createLabel('PackName', this.contentRoot, '王溪', 31, Palette.white, 260, 50, -246, 588);
    this.packCodeLabel = createLabel('PackCode', this.contentRoot, 'WANG·XI · 第 1 盒',
      16, Palette.muted, 370, 34, -200, 548);
    createRect('TicketBalanceBox', this.contentRoot, 116, 60, '#111313', 275, 574, 0, '#47433d');
    createLabel('TicketBalance', this.contentRoot, '▣ × 0', 22, Palette.gold, 110, 50, 275, 574);
    createRect('ToolbarDivider', this.contentRoot, 750, 2, '#383b3a', 0, 516);

    const slotsBar = createRect('EmptySlotsBar', this.contentRoot, 560, 64, '#141617', 0, 417, 0, '#41413c');
    for (let index = 0; index < 10; index += 1) {
      const slot = createNode(`EmptySlot${index}`, slotsBar, 44, 36, -243 + index * 54, 0);
      const graphic = slot.addComponent(Graphics);
      graphic.strokeColor = color('#46433c');
      graphic.lineWidth = 1;
      graphic.ellipse(0, 0, 21, 15);
      graphic.stroke();
    }

    const panel = createRect('SupplyPanel', this.contentRoot, 610, 720, '#191b1b', 0, -85, 0, '#57554e');
    createLabel('EmptyTitle', panel, '这盒空了', 46, Palette.white, 510, 78, 0, 280);
    createLabel('RefillDescription', panel, '补满 10 根，继续抽这一款烟。', 23,
      Palette.gold, 530, 48, 0, 212);
    createLabel('MethodsTitle', panel, '两种方式，任选一种', 22, Palette.white, 460, 42, 0, 135);
    const ticketButton = createButton('TicketRefill', panel, '1 张烟票', 240, 86,
      '#222425', Palette.muted, -135, 64, () => undefined, '#414440');
    ticketButton.interactable = false;
    createLabel('Or', panel, '或', 23, Palette.white, 50, 50, 0, 64);
    createButton('AdRefill', panel, '看广告', 238, 86, '#49301d', '#ffe0a2',
      135, 64, () => { void this.requestAd(); }, '#b57f4a');
    createLabel('TicketHint', panel, '烟票不足，看完广告也能补满，不扣烟票。', 19,
      Palette.gold, 550, 43, 0, -24);
    createLabel('ReturnHint', panel, '补好后回首页，点“来一根”开始。', 19,
      Palette.gold, 520, 42, 0, -88);
    createRect('MethodDivider', panel, 520, 2, '#3c3e3d', 0, -145);
    createLabel('OrSwitch', panel, '或者', 21, Palette.muted, 140, 36, 0, -145);
    createButton('SwitchPack', panel, '换其他烟盒', 520, 86, '#242626', Palette.white,
      0, -235, () => { this.notice.string = '其他烟盒暂未开放'; }, '#64635e');
    createLabel('SwitchHint', panel, '不补当前盒', 17, Palette.goldMuted, 210, 40, 145, -235);
    this.notice = createLabel('Notice', this.contentRoot, '', 20, Palette.gold,
      600, 52, 0, -532);

    this.adOverlay = createRect('AdPreviewOverlay', this.contentRoot, DESIGN_WIDTH, 2400,
      '#070808', 0, 0);
    this.adOverlay.addComponent(BlockInputEvents);
    const modal = createRect('AdPreviewModal', this.adOverlay, 600, 460,
      '#191b1b', 0, 0, 0, '#766342');
    createLabel('PreviewTitle', modal, '广告预览', 36, Palette.white, 500, 60, 0, 150);
    createLabel('PreviewDescription', modal, '真实激励广告暂未接入\n仅供测试补盒流程', 22,
      Palette.gold, 520, 100, 0, 45);
    createButton('PreviewComplete', modal, '模拟广告完成', 470, 78,
      '#49301d', '#ffe0a2', 0, -72, () => this.resolvePreviewAd('completed'), '#b57f4a');
    createButton('PreviewCancel', modal, '关闭，不补盒', 470, 70,
      '#242626', Palette.white, 0, -163, () => this.resolvePreviewAd('cancelled'), '#64635e');
    this.adOverlay.active = false;
  }

  private async requestAd(): Promise<void> {
    if (this.busy || !this.packInstanceId) return;
    this.busy = true;
    this.notice.string = '';
    const instanceId = this.packInstanceId;
    let result: RewardedVideoResult;
    try {
      result = await this.adGateway.show({ placement: 'pack:refill', resourceId: instanceId });
    } catch {
      result = 'error';
    }
    if (!this.isValid || !this.node.active || this.packInstanceId !== instanceId) return;
    this.busy = false;
    if (result === 'completed') {
      if (this.onRefill?.(instanceId)) return;
      this.notice.string = '补盒失败，请检查本机存档';
    } else if (result === 'unavailable' || result === 'error') {
      this.notice.string = '广告暂不可用，请稍后再试';
    }
  }

  private presentPreviewAd(): Promise<RewardedVideoResult> {
    if (this.adResolver) return Promise.resolve('error');
    this.adOverlay.active = true;
    return new Promise<RewardedVideoResult>((resolve) => { this.adResolver = resolve; });
  }

  private resolvePreviewAd(result: RewardedVideoResult): void {
    this.adOverlay.active = false;
    const resolve = this.adResolver;
    this.adResolver = null;
    resolve?.(result);
  }
}
