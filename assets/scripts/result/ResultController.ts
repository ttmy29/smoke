import { _decorator, Button, Component, Label, Node, view } from 'cc';
import { createButton, createLabel, createNode, createRect, DESIGN_HEIGHT, DESIGN_WIDTH, formatDuration, Palette } from '../common/UiFactory';
import { SessionSnapshot } from '../domain/SessionModel';
import { countAvailableSlots, PackSnapshot } from '../persistence/PackStore';

const { ccclass } = _decorator;

@ccclass('ResultController')
export class ResultController extends Component {
  private inhaleValue!: Label;
  private durationValue!: Label;
  private ashValue!: Label;
  private savedHint!: Label;
  private slotsLabel!: Label;
  private inventoryNote!: Label;
  private againButton!: Button;
  private againLabel!: Label;
  private contentRoot!: Node;
  private hasAvailableSlot = false;

  public initialize(onAgain: () => void, onHome: () => void, onSupply: () => void): void {
    this.build(onAgain, onHome, onSupply);
  }

  public present(snapshot: Readonly<SessionSnapshot>, smokedCount: number | null,
    pack: PackSnapshot | null): void {
    this.inhaleValue.string = `${snapshot.inhaleCount}`;
    this.durationValue.string = formatDuration(snapshot.elapsedSeconds);
    this.ashValue.string = `${snapshot.ashFlickCount}`;
    this.savedHint.string = smokedCount === null
      ? '本机存档失败，本次未计入累计'
      : `已保存本机 · 累计抽了 ${smokedCount} 根`;
    const remaining = pack ? countAvailableSlots(pack) : 0;
    this.slotsLabel.string = pack ? pack.slots.map((slot) => slot === 'available' ? '●' : '○').join('  ')
      : '烟盒存档不可用';
    this.inventoryNote.string = pack ? `本盒剩余 ${remaining}/10 支` : '烟盒存档不可用';
    this.hasAvailableSlot = remaining > 0;
    this.againButton.interactable = !!pack;
    this.againLabel.string = pack === null ? '烟盒不可用' : remaining > 0 ? '再 来 一 根' : '去 补 一 盒';
  }

  protected update(): void {
    if (!this.contentRoot) return;
    const scale = Math.min(1, view.getVisibleSize().height / DESIGN_HEIGHT);
    this.contentRoot.setScale(scale, scale, 1);
  }

  private build(onAgain: () => void, onHome: () => void, onSupply: () => void): void {
    createRect('ResultBackground', this.node, DESIGN_WIDTH, 2400, '#111210');
    this.contentRoot = createNode('ResultContent', this.node, DESIGN_WIDTH, DESIGN_HEIGHT);
    createLabel('PageTitle', this.contentRoot, '本 次 记 录', 26, Palette.goldMuted, 500, 50, 0, 680);
    createLabel('OutcomeTitle', this.contentRoot, '这一根，抽完了', 44, Palette.white, 600, 70, 0, 560);
    this.savedHint = createLabel('SavedHint', this.contentRoot, '本机存档待写入', 18, Palette.muted, 500, 36, 0, 505);

    const pack = createRect('PackSummary', this.contentRoot, 560, 220, Palette.surface, 0, 365, 18, '#39352b');
    createLabel('Pack', pack, '王溪  WANG · XI', 28, Palette.gold, 440, 45, 0, 60);
    this.slotsLabel = createLabel('Slots', pack, '●  ●  ●  ●  ●    ●  ●  ●  ●  ●', 24, Palette.goldMuted, 480, 50, 0, -5);
    this.inventoryNote = createLabel('InventoryNote', pack, '本盒剩余 10/10 支', 16, Palette.muted, 440, 32, 0, -62);

    this.inhaleValue = this.buildStat('本根口数', -210, 100);
    this.durationValue = this.buildStat('本次用时', 0, 100);
    this.ashValue = this.buildStat('弹灰次数', 210, 100);

    createRect('Timeline', this.contentRoot, 560, 2, Palette.goldMuted, 0, -115);
    createLabel('TimelineText', this.contentRoot, '现在                         完成', 17, Palette.muted, 560, 35, 0, -148);

    this.againButton = createButton('Again', this.contentRoot, '再 来 一 根', 430, 86,
      Palette.orange, Palette.background, 0, -350,
      () => { if (this.hasAvailableSlot) onAgain(); else onSupply(); });
    this.againLabel = this.againButton.node.getChildByName('Label')!.getComponent(Label)!;
    createButton('Home', this.contentRoot, '回 首 页', 430, 76, Palette.surface, Palette.gold, 0, -450, onHome, Palette.goldMuted);
    createLabel('Disabled', this.contentRoot, '换一盒、分享这根：演示版暂未开放', 17, Palette.muted, 560, 35, 0, -530);
  }

  private buildStat(title: string, x: number, y: number): Label {
    createLabel(`${title}Title`, this.contentRoot, title, 17, Palette.goldMuted, 170, 32, x, y + 35);
    return createLabel(`${title}Value`, this.contentRoot, '0', 36, Palette.white, 170, 55, x, y - 15);
  }
}
