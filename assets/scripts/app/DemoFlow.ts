import { _decorator, BlockInputEvents, Component, Graphics, Mask, Node,
  UIOpacity, view } from 'cc';
import { DemoAudio } from '../audio/DemoAudio';
import { alignWidget, createLabel, createNode, createRect,
  DESIGN_HEIGHT, DESIGN_WIDTH } from '../common/UiFactory';
import { SessionModel, SessionSnapshot } from '../domain/SessionModel';
import { ExtractionSource, HomeController } from '../home/HomeController';
import { createBrowserProgressStore, ProgressStore } from '../persistence/ProgressStore';
import { countAvailableSlots, createBrowserPackStore, PackStore } from '../persistence/PackStore';
import { ResultController } from '../result/ResultController';
import { paintCommunityBackground, SessionController } from '../session/SessionController';
import { CanvasTexture } from '../session/effects/CanvasTexture';
import { CigaretteView } from '../session/view/CigaretteView';
import { SupplyController } from '../supply/SupplyController';
import { CheckInController } from '../checkin/CheckInController';
import { CHECK_IN_STORAGE_KEY, CheckInStore, createBrowserCheckInStore } from '../persistence/CheckInStore';
import { createBrowserTicketRefillStore, TICKET_REFILL_PENDING_KEY, TicketRefillResult,
  TicketRefillStore } from '../persistence/TicketRefillStore';
import { sharedEntryMotion } from './EntryMotion';
import { QuitController } from '../quit/QuitController';
import { createBrowserQuitStore, QUIT_STORAGE_KEY, QuitStore } from '../persistence/QuitStore';
import { ReceiveRankingController } from '../ranking/ReceiveRankingController';
import { emptyReceiveRankingSource } from '../ranking/ReceiveRankingModel';
import { AchievementController } from '../achievement/AchievementController';
import { ACHIEVEMENT_GROUPS, SPECIAL_ACHIEVEMENT } from '../achievement/AchievementCatalog';
import { createAchievementIcon } from '../achievement/AchievementIcon';
import { ACHIEVEMENT_STORAGE_KEY, AchievementStore,
  createBrowserAchievementStore } from '../persistence/AchievementStore';

const { ccclass } = _decorator;

// 开发测试开关：true = 每次进入游戏都初始化本项目存档；false = 保留存档。
// 验证完初始状态后改回 false，否则每次刷新都会重新开始。
const RESET_LOCAL_SAVE_ON_START = false;
const LOCAL_SAVE_KEYS = [
  'smoke.pack.wang-xi.v1',
  'smoke.pack.wang-xi.v2',
  'smoke.progress.v1',
  'smoke.progress.v2',
  CHECK_IN_STORAGE_KEY,
  TICKET_REFILL_PENDING_KEY,
  QUIT_STORAGE_KEY,
  ACHIEVEMENT_STORAGE_KEY,
];

@ccclass('DemoFlow')
export class DemoFlow extends Component {
  private homePanel!: Node;
  private sessionPanel!: Node;
  private resultPanel!: Node;
  private supplyPanel!: Node;
  private checkInPanel!: Node;
  private quitPanel!: Node;
  private rankingPanel!: Node;
  private achievementPanel!: Node;
  private transitionLayer!: Node;
  private sessionController!: SessionController;
  private resultController!: ResultController;
  private supplyController!: SupplyController;
  private checkInController!: CheckInController;
  private quitController!: QuitController;
  private rankingController!: ReceiveRankingController;
  private achievementController!: AchievementController;
  private homeController!: HomeController;
  private progressStore!: ProgressStore;
  private packStore!: PackStore;
  private checkInStore!: CheckInStore;
  private quitStore!: QuitStore;
  private achievementStore!: AchievementStore;
  private achievementNotice: Node | null = null;
  private noticePhase: 'idle' | 'enter' | 'hold' | 'exit' = 'idle';
  private noticeElapsed = 0;
  private noticeId = '';
  private noticePoll = 0;
  private ticketRefillStore!: TicketRefillStore;
  private activeSessionId: string | null = null;
  private activePackInstanceId: string | null = null;
  private activeSlotIndex: number | null = null;
  private extracting = false;
  private entryElapsed = 0;
  private clearFrames = 0;
  private clearElapsed: number | null = null;
  private entrySource: ExtractionSource | null = null;
  private entryStick: Node | null = null;
  private entryCigaretteView: CigaretteView | null = null;
  private entrySnapshot: Readonly<SessionSnapshot> | null = null;
  private entryBackdropTexture: CanvasTexture | null = null;
  private entryBackdropOpacity: UIOpacity | null = null;
  private entryMask: Mask | null = null;
  private entryTargetY = 0;

  private static readonly ENTRY_PRELUDE = 0.22;
  private static readonly ENTRY_DURATION = 1.35;
  private static readonly PACK_FADE = 0.48;
  private static readonly SECONDARY_FADE = 0.18;

  protected update(deltaTime: number): void {
    this.updateAchievementNotice(deltaTime);
    if (!this.extracting || !this.entrySource || !this.entryStick) return;
    this.entryElapsed += Math.min(Math.max(deltaTime, 0), 0.1);
    const motionElapsed = Math.max(0, this.entryElapsed - DemoFlow.ENTRY_PRELUDE);
    const progress = Math.min(1, motionElapsed / DemoFlow.ENTRY_DURATION);
    const source = this.entrySource;
    const frame = sharedEntryMotion({
      progress,
      sourceCenterX: source.centerX,
      sourceCenterY: source.centerY,
      targetCenterX: 0,
      targetCenterY: this.entryTargetY,
      sourceScaleX: source.width / 82,
      sourceScaleY: source.height / this.targetCigaretteHeight(),
      liftDistance: source.height * source.liftRatio,
    });
    this.entryStick.setPosition(frame.centerX, frame.centerY);
    this.entryStick.setScale(frame.scaleX, frame.scaleY, 1);
    this.entryStick.setRotationFromEuler(0, 0, frame.rotationDegrees);
    if (this.entryCigaretteView && this.entrySnapshot) {
      this.entryCigaretteView.setEntryProgress(progress);
      this.entryCigaretteView.render(this.entrySnapshot);
    }
    if (this.entryMask) this.entryMask.enabled = progress < 0.28;
    if (progress >= 0.28 && this.clearElapsed === null) {
      this.clearFrames += 1;
      if (this.clearFrames >= 2) this.clearElapsed = motionElapsed;
    } else if (progress < 0.28) {
      this.clearFrames = 0;
    }
    this.sessionController.setEntryHudProgress(progress);
    const packFade = this.clearElapsed === null ? 0 :
      Math.max(0, Math.min(1, (motionElapsed - this.clearElapsed) / DemoFlow.PACK_FADE));
    if (this.entryBackdropOpacity) {
      this.entryBackdropOpacity.opacity = Math.round(255 * packFade);
    }
    this.homeController.setSecondaryOpacity(1 - this.entryElapsed / DemoFlow.SECONDARY_FADE);
    if (progress >= 1 && packFade >= 1) this.showSession();
  }

  protected onLoad(): void {
    if (RESET_LOCAL_SAVE_ON_START) {
      try {
        for (const key of LOCAL_SAVE_KEYS) window.localStorage.removeItem(key);
      } catch (error) {
        console.warn('Failed to initialize local smoke save', error);
      }
    }
    this.progressStore = createBrowserProgressStore();
    this.packStore = createBrowserPackStore();
    this.checkInStore = createBrowserCheckInStore();
    this.quitStore = createBrowserQuitStore();
    this.achievementStore = createBrowserAchievementStore();
    this.ticketRefillStore = createBrowserTicketRefillStore(this.checkInStore, this.packStore);
    this.ticketRefillStore.recoverPending();
    const audioNode = new Node('AudioRoot');
    this.node.addChild(audioNode);
    const audio = audioNode.addComponent(DemoAudio);

    this.homePanel = createNode('HomePanel', this.node, DESIGN_WIDTH, DESIGN_HEIGHT);
    this.sessionPanel = createNode('SessionPanel', this.node, DESIGN_WIDTH, DESIGN_HEIGHT);
    this.resultPanel = createNode('ResultPanel', this.node, DESIGN_WIDTH, DESIGN_HEIGHT);
    this.supplyPanel = createNode('SupplyPanel', this.node, DESIGN_WIDTH, DESIGN_HEIGHT);
    this.checkInPanel = createNode('CheckInPanel', this.node, DESIGN_WIDTH, DESIGN_HEIGHT);
    this.quitPanel = createNode('QuitPanel', this.node, DESIGN_WIDTH, DESIGN_HEIGHT);
    this.rankingPanel = createNode('RankingPanel', this.node, DESIGN_WIDTH, DESIGN_HEIGHT);
    this.achievementPanel = createNode('AchievementPanel', this.node, DESIGN_WIDTH, DESIGN_HEIGHT);
    this.transitionLayer = createNode('TransitionLayer', this.node, DESIGN_WIDTH, DESIGN_HEIGHT);
    for (const panel of [this.homePanel, this.sessionPanel, this.resultPanel,
      this.supplyPanel, this.checkInPanel, this.quitPanel, this.rankingPanel,
      this.achievementPanel,
      this.transitionLayer]) {
      alignWidget(panel, { left: 0, right: 0, top: 0, bottom: 0 });
    }

    this.homeController = this.homePanel.addComponent(HomeController);
    this.homeController.initialize((slotIndex) => this.startExtraction(slotIndex),
      () => this.showSupply(), (instanceId) => this.packStore.openLid(instanceId),
      () => this.progressStore.readHomeSmokingStatus(), () => this.showCheckIn(),
      () => this.checkInStore.readSnapshot(), () => this.showQuit(),
      () => this.showRanking(), () => this.showAchievement());
    this.sessionController = this.sessionPanel.addComponent(SessionController);
    this.sessionController.initialize(audio, (snapshot) => this.showResult(snapshot));
    this.resultController = this.resultPanel.addComponent(ResultController);
    this.resultController.initialize(() => this.startExtraction(this.homeController.defaultSlot()),
      () => this.showHome(), () => this.showSupply());
    this.supplyController = this.supplyPanel.addComponent(SupplyController);
    this.supplyController.initialize(() => this.showHome(), (instanceId) => this.completeRefill(instanceId),
      (instanceId) => this.completeTicketRefill(instanceId),
      () => this.checkInStore.readSnapshot()?.ticketBalance ?? null,
      () => this.ticketRefillStore.hasPending());
    this.checkInController = this.checkInPanel.addComponent(CheckInController);
    this.checkInController.initialize(this.checkInStore, () => this.showHome(), () => {
      this.homeController.setCheckInSnapshot(this.checkInStore.readSnapshot());
      this.syncAchievementProgress();
      this.homeController.setAchievementUnread(this.achievementStore.hasUnread());
    });
    this.quitController = this.quitPanel.addComponent(QuitController);
    this.quitController.initialize(this.quitStore, () => this.showHome());
    this.rankingController = this.rankingPanel.addComponent(ReceiveRankingController);
    this.rankingController.initialize(emptyReceiveRankingSource, () => this.showHome());
    this.achievementController = this.achievementPanel.addComponent(AchievementController);
    this.achievementController.initialize(this.achievementStore, () => this.showHome());
    this.achievementStore.subscribe(() => {
      this.homeController.setAchievementUnread(this.achievementStore.hasUnread());
    });

    this.showHome();
  }

  private showHome(): void {
    this.supplyController?.dismiss();
    this.checkInController?.dismiss();
    this.quitController?.dismiss();
    this.rankingController?.dismiss();
    this.achievementController?.dismiss();
    this.extracting = false;
    this.entrySource = null;
    this.activeSessionId = null;
    this.activePackInstanceId = null;
    this.activeSlotIndex = null;
    this.clearTransition();
    this.homeController?.setExtractingSlot(null);
    this.homeController?.setEntryMode(false);
    this.homeController?.setPack(this.packStore.readPack());
    this.homeController?.setSmokedCount(this.progressStore.readSmokedCount());
    this.homeController?.setHomeSmokingStatus(this.progressStore.readHomeSmokingStatus());
    this.homeController?.setCheckInSnapshot(this.checkInStore.readSnapshot());
    this.syncAchievementProgress();
    this.homeController?.setAchievementUnread(
      this.achievementStore.hasUnread());
    this.sessionController?.cancelEntryPreview();
    this.homePanel.active = true;
    this.homeController.refreshLayout();
    this.sessionPanel.active = false;
    this.resultPanel.active = false;
    this.supplyPanel.active = false;
    this.checkInPanel.active = false;
    this.quitPanel.active = false;
    this.rankingPanel.active = false;
    this.achievementPanel.active = false;
    this.transitionLayer.active = false;
  }

  private showCheckIn(): void {
    if (this.extracting) return;
    if (this.checkInPanel.active) return;
    this.checkInController.present();
    // Keep the home page visible beneath the native-style right-to-left push.
    this.homePanel.active = true;
    this.sessionPanel.active = false;
    this.resultPanel.active = false;
    this.supplyPanel.active = false;
    this.transitionLayer.active = false;
    this.checkInPanel.active = true;
  }

  private showQuit(): void {
    if (this.extracting || this.quitPanel.active) return;
    this.quitController.present();
    this.homePanel.active = true;
    this.sessionPanel.active = false;
    this.resultPanel.active = false;
    this.supplyPanel.active = false;
    this.checkInPanel.active = false;
    this.transitionLayer.active = false;
    this.quitPanel.active = true;
  }

  private showRanking(): void {
    if (this.extracting || this.rankingPanel.active) return;
    this.rankingController.present();
    this.homePanel.active = true;
    this.sessionPanel.active = false;
    this.resultPanel.active = false;
    this.supplyPanel.active = false;
    this.checkInPanel.active = false;
    this.quitPanel.active = false;
    this.transitionLayer.active = false;
    this.rankingPanel.active = true;
  }

  private showAchievement(): void {
    if (this.extracting || this.achievementPanel.active) return;
    this.syncAchievementProgress();
    this.achievementController.present();
    this.homePanel.active = true;
    this.sessionPanel.active = false;
    this.resultPanel.active = false;
    this.supplyPanel.active = false;
    this.checkInPanel.active = false;
    this.quitPanel.active = false;
    this.rankingPanel.active = false;
    this.transitionLayer.active = false;
    this.achievementPanel.active = true;
  }

  private syncAchievementProgress(): void {
    const smoked = this.progressStore.readSmokedCount();
    if (smoked !== null) {
      // Earlier sessions prove at least one extraction, but lack puff evidence.
      this.achievementStore.recordProgress('experience-entry', smoked, 1);
    }
    const pack = this.packStore.readPack();
    if (pack) this.achievementStore.recordProgress('packs-first', 1, 1);
    const qualified = this.achievementStore.readQualifiedMetrics();
    if (qualified) {
      for (const [id, target] of [
        ['experience-ten', 10], ['experience-hundred', 100],
        ['experience-thousand', 1000],
      ] as const) this.achievementStore.recordProgress(id,
        qualified.validEndedSessions, target);
      for (const [id, target] of [
        ['packs-empty-one', 1], ['packs-empty-three', 3],
        ['packs-thirty', 30], ['packs-hundred', 100],
      ] as const) this.achievementStore.recordProgress(id,
        qualified.qualifiedPublicSettlements, target);
    }
    const checkIn = this.checkInStore.readSnapshot();
    if (checkIn) {
      for (const [id, target] of [
        ['days-one', 1], ['days-three', 3], ['days-seven', 7],
        ['days-fifteen', 15], ['days-thirty', 30], ['days-hundred', 100],
        ['days-year', 365],
      ] as const) this.achievementStore.recordProgress(id, checkIn.cumulativeDays, target);
      this.achievementStore.recordProgress('days-streak-seven', checkIn.streak, 7);
      this.achievementStore.recordProgress('days-streak-thirty', checkIn.streak, 30);
    }
    const quit = this.quitStore.readSnapshot();
    if (quit) {
      for (const [id, target] of [
        ['quit-one', 1], ['quit-three', 3], ['quit-seven', 7],
        ['quit-fourteen', 14], ['quit-thirty', 30], ['quit-hundred', 100],
      ] as const) this.achievementStore.recordProgress(id, quit.totalDays, target);
      this.achievementStore.recordProgress('quit-streak-seven', quit.longestStreak, 7);
      this.achievementStore.recordProgress('quit-streak-thirty', quit.longestStreak, 30);
    }
    const quitHistory = this.quitStore.readHistory();
    if (quitHistory) {
      const feelingDays = quitHistory.quit.filter((day) => day.feeling.trim().length > 0).length;
      this.achievementStore.recordProgress('quit-feelings-three', feelingDays, 3);
      this.achievementStore.recordProgress('quit-feelings-ten', feelingDays, 10);
    }
  }

  private updateAchievementNotice(dt: number): void {
    if (!this.achievementStore) return;
    const elapsed = Math.min(Math.max(dt, 0), 0.1);
    if (this.noticePhase === 'idle') {
      if (this.extracting || this.sessionPanel?.active) return;
      this.noticePoll += elapsed;
      if (this.noticePoll < 0.25) return;
      this.noticePoll = 0;
      const id = this.achievementStore.nextPendingNotice();
      if (id) this.startAchievementNotice(id);
      return;
    }
    this.noticeElapsed += elapsed;
    const width = view.getVisibleSize().width;
    const destination = width / 2 - 200;
    const bottom = -view.getVisibleSize().height / 2 + 70;
    if (this.noticePhase === 'enter') {
      const progress = Math.min(1, this.noticeElapsed / 0.28);
      const eased = 1 - (1 - progress) ** 3;
      this.achievementNotice?.setPosition(destination + 400 * (1 - eased), bottom);
      if (progress >= 1) {
        this.noticePhase = 'hold';
        this.noticeElapsed = 0;
        this.achievementStore.markNoticeShown(this.noticeId);
      }
    } else if (this.noticePhase === 'hold') {
      this.achievementNotice?.setPosition(destination, bottom);
      if (this.noticeElapsed >= 3) {
        this.noticePhase = 'exit';
        this.noticeElapsed = 0;
      }
    } else {
      const progress = Math.min(1, this.noticeElapsed / 0.22);
      this.achievementNotice?.setPosition(destination + 400 * progress, bottom);
      if (progress >= 1) {
        this.achievementNotice?.destroy();
        this.achievementNotice = null;
        this.noticePhase = 'idle';
        this.noticeElapsed = 0;
        this.noticeId = '';
      }
    }
  }

  private startAchievementNotice(id: string): void {
    const item = [...ACHIEVEMENT_GROUPS.flatMap((group) => group.items),
      SPECIAL_ACHIEVEMENT].find((entry) => entry.id === id);
    if (!item) { this.achievementStore.markNoticeShown(id); return; }
    const panel = createRect('AchievementNotice', this.node, 400, 108,
      '#2b241c', view.getVisibleSize().width / 2 + 200,
      -view.getVisibleSize().height / 2 + 70, 16, '#998161');
    panel.addComponent(BlockInputEvents);
    createAchievementIcon(panel, id, true, false, -150, 0);
    createLabel('NoticeLabel', panel, '成就已达成', 22, '#d9ae76', 265, 36, 53, 20);
    createLabel('NoticeTitle', panel, item.title, 28, '#f1dfc2', 265, 45, 53, -18);
    this.achievementNotice = panel;
    this.noticeId = id;
    this.noticePhase = 'enter';
    this.noticeElapsed = 0;
  }

  private showSupply(): void {
    this.ticketRefillStore.recoverPending();
    const pack = this.packStore.readPack();
    if (!pack) return;
    if (countAvailableSlots(pack) !== 0) {
      this.showHome();
      return;
    }
    this.supplyController.present(pack);
    this.homePanel.active = false;
    this.sessionPanel.active = false;
    this.resultPanel.active = false;
    this.transitionLayer.active = false;
    this.supplyPanel.active = true;
  }

  private completeRefill(instanceId: string): boolean {
    if (!this.ticketRefillStore.recoverPending()) return false;
    if (!this.packStore.refillAfterReward(instanceId)) return false;
    this.showHome();
    return true;
  }

  private completeTicketRefill(instanceId: string): TicketRefillResult {
    const result = this.ticketRefillStore.refill(instanceId);
    if (result === 'completed') this.showHome();
    return result;
  }

  private startExtraction(slotIndex: number): void {
    if (this.extracting) return;
    const wasHomeActive = this.homePanel.active;
    const wasTransitionActive = this.transitionLayer.active;
    this.homePanel.active = true;
    this.transitionLayer.active = true;
    this.homeController.refreshLayout();
    this.homeController.setPack(this.packStore.readPack());
    const source = this.homeController.getExtractionSource(slotIndex, this.transitionLayer);
    if (!source) {
      this.homePanel.active = wasHomeActive;
      this.transitionLayer.active = wasTransitionActive;
      return;
    }
    const pack = this.packStore.consumeSlot(slotIndex);
    if (!pack) {
      this.homeController.setPack(this.packStore.readPack());
      this.homePanel.active = wasHomeActive;
      this.transitionLayer.active = wasTransitionActive;
      return;
    }
    this.achievementStore.recordProgress('experience-entry', 1, 1);
    this.activeSessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    this.activePackInstanceId = pack.instanceId;
    this.activeSlotIndex = slotIndex;
    this.extracting = true;
    this.clearTransition();
    this.homeController.setPack(pack);
    this.homeController.setEntryMode(true);
    this.sessionController.beginEntryPreview();
    this.sessionPanel.active = true;
    this.resultPanel.active = false;
    this.supplyPanel.active = false;
    this.transitionLayer.active = true;
    this.sessionPanel.setSiblingIndex(this.node.children.length - 1);
    this.entrySource = source;
    this.homeController.setExtractingSlot(slotIndex);

    const visibleHeight = view.getVisibleSize().height;
    // Cover the opaque old page as a single composited picture, below the extracted cigarette.
    const backdrop = new CanvasTexture('EntryBackdrop', this.node, DESIGN_WIDTH, visibleHeight);
    backdrop.node.setSiblingIndex(this.homePanel.getSiblingIndex() + 1);
    backdrop.redraw((ctx) => paintCommunityBackground(ctx, DESIGN_WIDTH, visibleHeight));
    this.entryBackdropTexture = backdrop;
    this.entryBackdropOpacity = backdrop.node.addComponent(UIOpacity);
    this.entryBackdropOpacity.opacity = 0;

    const maskNode = createNode('EntryMask', this.transitionLayer, DESIGN_WIDTH, visibleHeight);
    this.entryMask = maskNode.addComponent(Mask);
    this.entryMask.type = Mask.Type.GRAPHICS_STENCIL;
    this.drawEntryOcclusion(this.entryMask, this.entrySource, visibleHeight);

    const stick = createNode('EntryStick', maskNode, DESIGN_WIDTH, visibleHeight);
    this.entryStick = stick;
    const visualRoot = createNode('EntryCigaretteVisual', stick, DESIGN_WIDTH, visibleHeight);
    this.entryTargetY = this.targetCigaretteCenterY();
    visualRoot.setPosition(0, -this.entryTargetY);
    this.entryCigaretteView = new CigaretteView(visualRoot);
    this.entrySnapshot = new SessionModel().snapshot;
    this.entryElapsed = 0;
    this.clearFrames = 0;
    this.clearElapsed = null;
    this.update(0);
  }

  private targetCigaretteHeight(): number {
    const height = view.getVisibleSize().height;
    return Math.max(98 * 1.92, 0.145 * height) + Math.max(218 * 1.92, 0.325 * height);
  }

  private targetCigaretteCenterY(): number {
    const height = view.getVisibleSize().height;
    return -0.295 * height + this.targetCigaretteHeight() / 2;
  }

  private drawEntryOcclusion(mask: Mask, source: ExtractionSource, height: number): void {
    const graphics = mask.subComp as Graphics;
    graphics.clear();
    const top = height / 2 + 200;
    const left = -DESIGN_WIDTH / 2 - 200;
    const width = DESIGN_WIDTH + 400;
    const clipTop = source.frontOccluders.reduce((value, item) => Math.max(value, item.top), source.coverTop);
    graphics.rect(left, clipTop, width, top - clipTop);
    if (clipTop > source.coverTop && source.frontOccluders.length) {
      const occluders = [...source.frontOccluders].sort((a, b) => a.left - b.left);
      let cursor = left;
      for (const item of occluders) {
        if (item.left > cursor) graphics.rect(cursor, source.coverTop, item.left - cursor, clipTop - source.coverTop);
        cursor = Math.max(cursor, item.right);
      }
      if (cursor < left + width) graphics.rect(cursor, source.coverTop, left + width - cursor, clipTop - source.coverTop);
    }
    graphics.fill();
  }

  private showSession(): void {
    this.extracting = false;
    this.entrySource = null;
    this.transitionLayer.active = false;
    this.clearTransition();
    this.homeController.setExtractingSlot(null);
    this.homePanel.active = false;
    this.sessionController.finishEntryPreview();
    this.sessionPanel.active = true;
  }

  private showResult(snapshot: Readonly<SessionSnapshot>): void {
    if (snapshot.inhaleCount > 0 && this.activeSessionId
      && this.activePackInstanceId && this.activeSlotIndex !== null) {
      this.achievementStore.recordQualifiedSession(this.activeSessionId,
        this.activePackInstanceId, this.activeSlotIndex);
    }
    const smokedCount = this.activeSessionId
      ? this.progressStore.recordCompletedCigarette(this.activeSessionId) : null;
    this.syncAchievementProgress();
    this.activeSessionId = null;
    this.activePackInstanceId = null;
    this.activeSlotIndex = null;
    this.homeController.setSmokedCount(smokedCount);
    this.homeController.setHomeSmokingStatus(this.progressStore.readHomeSmokingStatus());
    this.sessionPanel.active = false;
    this.resultController.present(snapshot, smokedCount, this.packStore.readPack());
    this.resultPanel.active = true;
    this.supplyPanel.active = false;
  }

  private clearTransition(): void {
    this.entryCigaretteView?.dispose();
    this.entryBackdropTexture?.dispose();
    this.entryBackdropTexture?.node.destroy();
    for (const child of [...(this.transitionLayer?.children ?? [])]) child.destroy();
    this.entryStick = null;
    this.entryCigaretteView = null;
    this.entrySnapshot = null;
    this.entryBackdropTexture = null;
    this.entryBackdropOpacity = null;
    this.entryMask = null;
  }
}
