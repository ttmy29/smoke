import { _decorator, BlockInputEvents, Component, Graphics, Mask, Node,
  UIOpacity, view } from 'cc';
import { DemoAudio } from '../audio/DemoAudio';
import * as InitialSettings from '../config/InitialSettings';
import { debugLog } from '../services/DebugLog';
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
import { RecordsController } from '../records/RecordsController';
import { SmokeLabController } from '../lab/SmokeLabController';
import { SmokeLabStore, SMOKE_LAB_STORAGE_KEY } from '../persistence/SmokeLabStore';
import { createLocalRecordsSource } from '../records/RecordsModel';
import { createBrowserSmokingRecordStore, SmokingRecordStore,
  SMOKING_RECORD_STORAGE_KEY } from '../persistence/SmokingRecordStore';
import { CHECK_IN_STORAGE_KEY, CheckInStore, createBrowserCheckInStore } from '../persistence/CheckInStore';
import { createBrowserTicketRefillStore, TICKET_REFILL_PENDING_KEY, TicketRefillResult,
  TicketRefillStore } from '../persistence/TicketRefillStore';
import { sharedEntryMotion } from './EntryMotion';
import { QuitController } from '../quit/QuitController';
import { createBrowserQuitStore, QUIT_STORAGE_KEY, QuitStore } from '../persistence/QuitStore';
import { ReceiveRankingController } from '../ranking/ReceiveRankingController';
import { emptyReceiveRankingSource } from '../ranking/ReceiveRankingModel';
import { AchievementController } from '../achievement/AchievementController';
import { SettingsController } from '../settings/SettingsController';
import { DesktopGuide } from '../common/DesktopGuide';
import { emptyWorldSource, WorldController } from '../world/WorldController';
import { WorldShopController } from '../world/WorldShopController';
import { ACHIEVEMENT_GROUPS, AchievementItem, SPECIAL_ACHIEVEMENT } from '../achievement/AchievementCatalog';
import { createAchievementIcon } from '../achievement/AchievementIcon';
import { ACHIEVEMENT_STORAGE_KEY, AchievementStore,
  createBrowserAchievementStore } from '../persistence/AchievementStore';

const { ccclass } = _decorator;

const LOCAL_SAVE_KEYS = [
  'smoke.pack.wang-xi.v1',
  'smoke.pack.wang-xi.v2',
  'smoke.progress.v1',
  'smoke.progress.v2',
  CHECK_IN_STORAGE_KEY,
  TICKET_REFILL_PENDING_KEY,
  QUIT_STORAGE_KEY,
  ACHIEVEMENT_STORAGE_KEY,
  SMOKING_RECORD_STORAGE_KEY,
  SMOKE_LAB_STORAGE_KEY,
];

@ccclass('DemoFlow')
export class DemoFlow extends Component {
  private homePanel!: Node;
  private sessionPanel!: Node;
  private resultPanel!: Node;
  private supplyPanel!: Node;
  private checkInPanel!: Node;
  private recordsPanel!: Node;
  private labPanel!: Node;
  private quitPanel!: Node;
  private rankingPanel!: Node;
  private achievementPanel!: Node;
  private settingsPanel!: Node;
  private worldPanel!: Node;
  private worldShopPanel!: Node;
  private transitionLayer!: Node;
  private sessionController!: SessionController;
  private resultController!: ResultController;
  private supplyController!: SupplyController;
  private checkInController!: CheckInController;
  private recordsController!: RecordsController;
  private labController!: SmokeLabController;
  private labStore!: SmokeLabStore;
  private labFromSession = false;
  private recordsChild: 'checkin' | 'quit' | null = null;
  private quitController!: QuitController;
  private rankingController!: ReceiveRankingController;
  private achievementController!: AchievementController;
  private settingsController!: SettingsController;
  private settingsReturnToCheckIn = false;
  private worldController!: WorldController;
  private worldShopController!: WorldShopController;
  private desktopGuide!: DesktopGuide;
  private homeController!: HomeController;
  private pendingTopPrefab: Node | null = null;
  private pendingBottomPrefab: Node | null = null;
  private bottomPrefabForWorld: Node | null = null;
  private pendingSidePrefab: Node | null = null;
  private progressStore!: ProgressStore;
  private packStore!: PackStore;
  private checkInStore!: CheckInStore;
  private smokingRecordStore!: SmokingRecordStore;
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

  public attachTopPrefab(top: Node): void {
    if (this.homeController) this.homeController.attachTopPrefab(top);
    else this.pendingTopPrefab = top;
  }

  public attachBottomPrefab(bottom: Node): void {
    this.bottomPrefabForWorld = bottom;
    if (this.homeController) this.homeController.attachBottomPrefab(bottom);
    else this.pendingBottomPrefab = bottom;
    this.worldController?.attachBottomNavigation(bottom);
  }

  public attachSidePrefab(side: Node): void {
    if (this.homeController) this.homeController.attachSidePrefab(side);
    else this.pendingSidePrefab = side;
  }

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

  private initializePreviewData(): void {
    const now = Date.now();
    const results = [
      ['打卡', this.checkInStore.initializePreview({
        cumulativeDays: InitialSettings.INITIAL_CHECK_IN_DAYS,
        streak: InitialSettings.INITIAL_CHECK_IN_STREAK_DAYS,
        ticketBalance: InitialSettings.INITIAL_TICKET_BALANCE,
        checkedToday: InitialSettings.INITIAL_CHECKED_IN_TODAY,
      }, now)],
      ['烟盒', this.packStore.initializePreview({
        packId: InitialSettings.INITIAL_PACK_ID,
        remaining: InitialSettings.INITIAL_PACK_REMAINING,
        lidOpen: InitialSettings.INITIAL_PACK_LID_OPEN,
      })],
      ['抽烟累计', this.progressStore.initializePreview(InitialSettings.INITIAL_SMOKED_CIGARETTES, now)],
    ] as const;
    for (const [name, success] of results) {
      if (!success) console.warn(`[InitialSettings] ${name}初始化失败，请检查参数、空存档及存储可用性。`);
    }
    if (InitialSettings.INITIAL_QUIT_DAYS !== 0) {
      console.warn('[InitialSettings] INITIAL_QUIT_DAYS 仅为预留参数，逐日戒烟记录初始化尚未接入。');
    }
    debugLog('初始存档配置已处理', results);
  }

  protected onLoad(): void {
    if (InitialSettings.RESET_LOCAL_SAVE_ON_START) {
      try {
        for (const key of LOCAL_SAVE_KEYS) window.localStorage.removeItem(key);
      } catch (error) {
        console.warn('Failed to initialize local smoke save', error);
      }
    }
    this.progressStore = createBrowserProgressStore();
    this.packStore = createBrowserPackStore();
    this.checkInStore = createBrowserCheckInStore();
    let labStorage = null;
    try { labStorage = window.localStorage; } catch { /* Store reports unavailable. */ }
    this.labStore = new SmokeLabStore(labStorage, () => {
      const pack = this.packStore.readPack();
      return pack ? { boxId: pack.instanceId, typeId: pack.packId, packName: '王溪', sequence: pack.sequence } : null;
    }, () => this.checkInStore.readSnapshot()?.cumulativeDays ?? null);
    this.smokingRecordStore = createBrowserSmokingRecordStore();
    if (InitialSettings.RESET_LOCAL_SAVE_ON_START) this.initializePreviewData();
    this.quitStore = createBrowserQuitStore();
    this.achievementStore = createBrowserAchievementStore();
    this.ticketRefillStore = createBrowserTicketRefillStore(this.checkInStore, this.packStore);
    this.ticketRefillStore.recoverPending();
    const audioNode = new Node('AudioRoot');
    this.node.addChild(audioNode);
    const audio = audioNode.addComponent(DemoAudio);
    if (!audio.initializeDefaults(InitialSettings.DEFAULT_SOUND_ENABLED, InitialSettings.DEFAULT_SOUND_VOLUME)) {
      console.warn('[InitialSettings] 音效配置无效，音量应为 0～1，音效开关应为布尔值。');
    }
    debugLog('应用初始化', { reset: InitialSettings.RESET_LOCAL_SAVE_ON_START,
      adPreview: InitialSettings.ENABLE_AD_PREVIEW, soundEnabled: !audio.isMuted });

    // Home artwork stays directly under Canvas, between its background and page overlays.
    this.homePanel = createNode('HomePanel', this.node.parent ?? this.node, DESIGN_WIDTH, DESIGN_HEIGHT);
    this.homePanel.setSiblingIndex(0);
    this.sessionPanel = createNode('SessionPanel', this.node, DESIGN_WIDTH, DESIGN_HEIGHT);
    this.resultPanel = createNode('ResultPanel', this.node, DESIGN_WIDTH, DESIGN_HEIGHT);
    this.supplyPanel = createNode('SupplyPanel', this.node, DESIGN_WIDTH, DESIGN_HEIGHT);
    this.recordsPanel = createNode('RecordsPanel', this.node, DESIGN_WIDTH, DESIGN_HEIGHT);
    this.labPanel = createNode('SmokeLabPanel', this.node, DESIGN_WIDTH, DESIGN_HEIGHT);
    this.checkInPanel = createNode('CheckInPanel', this.node, DESIGN_WIDTH, DESIGN_HEIGHT);
    this.quitPanel = createNode('QuitPanel', this.node, DESIGN_WIDTH, DESIGN_HEIGHT);
    this.rankingPanel = createNode('RankingPanel', this.node, DESIGN_WIDTH, DESIGN_HEIGHT);
    this.achievementPanel = createNode('AchievementPanel', this.node, DESIGN_WIDTH, DESIGN_HEIGHT);
    this.settingsPanel = createNode('SettingsPanel', this.node, DESIGN_WIDTH, DESIGN_HEIGHT);
    this.worldPanel = createNode('WorldPanel', this.node, DESIGN_WIDTH, DESIGN_HEIGHT);
    this.worldShopPanel = createNode('WorldShopPanel', this.node, DESIGN_WIDTH, DESIGN_HEIGHT);
    this.transitionLayer = createNode('TransitionLayer', this.node, DESIGN_WIDTH, DESIGN_HEIGHT);
    for (const panel of [this.homePanel, this.sessionPanel, this.resultPanel,
      this.supplyPanel, this.recordsPanel, this.labPanel, this.checkInPanel, this.quitPanel, this.rankingPanel,
      this.achievementPanel, this.settingsPanel, this.worldPanel, this.worldShopPanel,
      this.transitionLayer]) {
      alignWidget(panel, { left: 0, right: 0, top: 0, bottom: 0 });
    }

    this.homeController = this.homePanel.addComponent(HomeController);
    this.homeController.initialize((slotIndex) => this.startExtraction(slotIndex),
      () => this.showSupply(), (instanceId) => this.packStore.openLid(instanceId),
      () => this.progressStore.readHomeSmokingStatus(), () => this.showCheckIn(),
      () => this.checkInStore.readSnapshot(), () => this.showQuit(),
      () => this.showRanking(), () => this.showAchievement(), () => this.showSettings(),
      () => this.showDesktopGuide(), () => this.showRecords(), () => this.showLab());
    if (this.pendingTopPrefab) {
      this.homeController.attachTopPrefab(this.pendingTopPrefab);
      this.pendingTopPrefab = null;
    }
    if (this.pendingBottomPrefab) {
      this.homeController.attachBottomPrefab(this.pendingBottomPrefab);
      this.pendingBottomPrefab = null;
    }
    if (this.pendingSidePrefab) {
      this.homeController.attachSidePrefab(this.pendingSidePrefab);
      this.pendingSidePrefab = null;
    }
    this.sessionController = this.sessionPanel.addComponent(SessionController);
    this.sessionController.initialize(audio, (snapshot) => this.showResult(snapshot));
    this.sessionController.configureLab(() => this.labStore.runtime(), () => this.showLab(true));
    this.labController = this.labPanel.addComponent(SmokeLabController);
    this.labController.initialize(this.labStore, () => {
      const resumeSession = this.labFromSession;
      this.labController.dismiss(); this.labFromSession = false;
      if (resumeSession) { this.sessionPanel.active = true; this.sessionController.resumeFromLab(); }
      else this.showHome();
    });
    this.resultController = this.resultPanel.addComponent(ResultController);
    this.resultController.initialize(() => this.startExtraction(this.homeController.defaultSlot()),
      () => this.showHome(), () => this.showSupply());
    this.supplyController = this.supplyPanel.addComponent(SupplyController);
    this.supplyController.initialize(() => this.showHome(), (instanceId) => this.completeRefill(instanceId),
      (instanceId) => this.completeTicketRefill(instanceId),
      () => this.checkInStore.readSnapshot()?.ticketBalance ?? null,
      () => this.ticketRefillStore.hasPending());
    this.checkInController = this.checkInPanel.addComponent(CheckInController);
    this.checkInController.initialize(this.checkInStore, () => this.closeRecordsChild('checkin'), () => {
      this.homeController.setCheckInSnapshot(this.checkInStore.readSnapshot());
      this.syncAchievementProgress();
      this.homeController.setAchievementUnread(this.achievementStore.hasUnread());
    }, undefined, () => {
      this.showSettings();
      this.settingsReturnToCheckIn = true;
    });
    this.quitController = this.quitPanel.addComponent(QuitController);
    this.quitController.initialize(this.quitStore, () => this.closeRecordsChild('quit'));
    this.recordsController = this.recordsPanel.addComponent(RecordsController);
    this.recordsController.initialize(createLocalRecordsSource({ progress: this.progressStore,
      checkin: this.checkInStore, smoking: this.smokingRecordStore, quit: this.quitStore,
      completedPacks: () => this.achievementStore.readQualifiedMetrics()?.qualifiedPublicSettlements ?? null,
    }), this.quitStore, {
      onBack: () => this.showHome(),
      onCheckIn: () => { this.recordsChild = 'checkin'; this.showCheckIn(); },
      onQuit: (price) => { this.recordsChild = 'quit'; this.showQuit(price); },
    });
    this.rankingController = this.rankingPanel.addComponent(ReceiveRankingController);
    this.rankingController.initialize(emptyReceiveRankingSource, () => this.showHome());
    this.achievementController = this.achievementPanel.addComponent(AchievementController);
    this.achievementController.initialize(this.achievementStore, () => this.showHome());
    this.settingsController = this.settingsPanel.addComponent(SettingsController);
    this.settingsController.initialize({
      soundEnabled: () => !audio.isMuted,
      toggleSound: () => { audio.toggleMuted(); },
      openDesktopGuide: () => this.showDesktopGuide(),
      localBytes: () => {
        try {
          return LOCAL_SAVE_KEYS.reduce((bytes, key) => {
            const value = window.localStorage.getItem(key);
            return bytes + (value === null ? 0 : (key.length + value.length) * 2);
          }, 0);
        } catch { return null; }
      },
    }, () => {
      if (this.settingsReturnToCheckIn) {
        this.settingsReturnToCheckIn = false;
        this.settingsController.dismiss();
        this.showCheckIn();
      } else this.showHome();
    });
    this.worldController = this.worldPanel.addComponent(WorldController);
    this.worldController.initialize({
      onHome: () => this.showHome(),
      onShop: () => this.showWorldShop(),
    }, emptyWorldSource);
    this.worldShopController = this.worldShopPanel.addComponent(WorldShopController);
    this.worldShopController.initialize({
      onBack: () => {
        this.worldShopController.dismiss();
        this.worldPanel.active = true;
      },
      readTickets: () => this.checkInStore.readSnapshot()?.ticketBalance ?? null,
    });
    if (this.bottomPrefabForWorld) this.worldController.attachBottomNavigation(this.bottomPrefabForWorld);
    this.homeController.setBottomNavigationHandlers({
      onSmokeTab: () => { if (!this.homePanel.active) this.showHome(); },
      onWorldTab: () => this.showWorld(),
    });
    const guideLayer = createNode('DesktopGuideOverlay', this.node, DESIGN_WIDTH, DESIGN_HEIGHT);
    alignWidget(guideLayer, { left: 0, right: 0, top: 0, bottom: 0 });
    this.desktopGuide = guideLayer.addComponent(DesktopGuide);
    this.desktopGuide.initialize();
    this.achievementStore.subscribe(() => {
      this.homeController.setAchievementUnread(this.achievementStore.hasUnread());
    });

    this.showHome();
  }

  private showHome(): void {
    this.labController?.dismiss();
    this.labFromSession = false;
    this.recordsChild = null;
    this.recordsController?.dismiss();
    this.settingsReturnToCheckIn = false;
    this.worldShopController?.dismiss();
    this.worldController?.dismiss();
    this.desktopGuide?.dismiss();
    this.supplyController?.dismiss();
    this.checkInController?.dismiss();
    this.quitController?.dismiss();
    this.rankingController?.dismiss();
    this.achievementController?.dismiss();
    this.settingsController?.dismiss();
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
    this.recordsPanel.active = false;
    this.quitPanel.active = false;
    this.rankingPanel.active = false;
    this.achievementPanel.active = false;
    this.settingsPanel.active = false;
    this.worldPanel.active = false;
    this.worldShopPanel.active = false;
    this.transitionLayer.active = false;
  }

  private showRecords(): void {
    if (this.extracting || this.recordsPanel.active
      || (this.checkInStore.readSnapshot()?.cumulativeDays ?? 0) < 3) return;
    this.recordsChild = null;
    this.recordsController.present();
    this.homePanel.active = true;
    this.sessionPanel.active = this.resultPanel.active = this.supplyPanel.active = false;
    this.checkInPanel.active = this.quitPanel.active = this.rankingPanel.active = false;
    this.achievementPanel.active = this.settingsPanel.active = this.worldPanel.active = false;
    this.worldShopPanel.active = this.transitionLayer.active = false;
  }

  private showLab(fromSession = false): void {
    if (this.extracting || this.labPanel.active || (this.checkInStore.readSnapshot()?.cumulativeDays ?? 0) < 2) return;
    this.labFromSession = fromSession;
    if (fromSession) this.sessionController.pauseForLab();
    this.sessionPanel.active = false;
    this.labController.present();
    // Extraction raises the session panel; the lab must cover it when entered mid-session.
    this.labPanel.setSiblingIndex(this.node.children.length - 1);
  }

  private closeRecordsChild(child: 'checkin' | 'quit'): void {
    if (this.recordsChild !== child) { this.showHome(); return; }
    this.recordsChild = null;
    if (child === 'checkin') { this.checkInController.dismiss(); this.checkInPanel.active = false; }
    else { this.quitController.dismiss(); this.quitPanel.active = false; }
    this.homeController.setCheckInSnapshot(this.checkInStore.readSnapshot());
    this.recordsController.resume();
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

  private showQuit(price = false): void {
    if (this.extracting || this.quitPanel.active) return;
    if (price) this.quitController.presentPrice(); else this.quitController.present();
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

  private showSettings(): void {
    if (this.extracting || this.settingsPanel.active) return;
    this.settingsReturnToCheckIn = false;
    this.settingsController.present();
    this.homePanel.active = true;
    this.sessionPanel.active = false;
    this.resultPanel.active = false;
    this.supplyPanel.active = false;
    this.checkInPanel.active = false;
    this.quitPanel.active = false;
    this.rankingPanel.active = false;
    this.achievementPanel.active = false;
    this.transitionLayer.active = false;
  }

  private showDesktopGuide(): void {
    if (this.extracting) return;
    this.desktopGuide.present();
  }

  private showWorld(): void {
    if (this.extracting || this.worldPanel.active) return;
    this.desktopGuide?.dismiss();
    this.worldController.present();
    this.homePanel.active = false;
    this.sessionPanel.active = false;
    this.resultPanel.active = false;
    this.supplyPanel.active = false;
    this.checkInPanel.active = false;
    this.quitPanel.active = false;
    this.rankingPanel.active = false;
    this.achievementPanel.active = false;
    this.settingsPanel.active = false;
    this.transitionLayer.active = false;
  }

  private showWorldShop(): void {
    if (this.extracting || this.worldShopPanel.active) return;
    // Keep the world page alive underneath the push, preserving its scroll position.
    this.worldPanel.active = true;
    this.worldShopController.present();
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
    const blocked = (this.checkInPanel?.active && this.checkInController?.isUnlockOpen)
      || (this.recordsPanel?.active && this.recordsController?.modalOpen)
      || this.labPanel?.active;
    if (this.achievementNotice) this.achievementNotice.active = !blocked;
    // V1.0.8 defers achievement notices until the check-in unlock modal closes.
    if (blocked) return;
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
    const item = [...ACHIEVEMENT_GROUPS.reduce<AchievementItem[]>((items, group) =>
      items.concat(group.items), []),
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
    if (this.activeSessionId && this.activeSlotIndex !== null
      && !this.smokingRecordStore.recordSession(this.activeSessionId, this.activeSlotIndex, snapshot)) {
      console.warn('Failed to save smoking record details');
    }
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

  protected onDestroy(): void {
    this.clearTransition();
    this.homePanel?.destroy();
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
