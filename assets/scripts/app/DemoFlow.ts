import { _decorator, Component, Graphics, Mask, Node, UIOpacity, view } from 'cc';
import { DemoAudio } from '../audio/DemoAudio';
import { alignWidget, createNode, DESIGN_HEIGHT, DESIGN_WIDTH } from '../common/UiFactory';
import { SessionModel, SessionSnapshot } from '../domain/SessionModel';
import { ExtractionSource, HomeController } from '../home/HomeController';
import { createBrowserProgressStore, ProgressStore } from '../persistence/ProgressStore';
import { countAvailableSlots, createBrowserPackStore, PackStore } from '../persistence/PackStore';
import { ResultController } from '../result/ResultController';
import { paintCommunityBackground, SessionController } from '../session/SessionController';
import { CanvasTexture } from '../session/effects/CanvasTexture';
import { CigaretteView } from '../session/view/CigaretteView';
import { SupplyController } from '../supply/SupplyController';
import { sharedEntryMotion } from './EntryMotion';

const { ccclass } = _decorator;

@ccclass('DemoFlow')
export class DemoFlow extends Component {
  private homePanel!: Node;
  private sessionPanel!: Node;
  private resultPanel!: Node;
  private supplyPanel!: Node;
  private transitionLayer!: Node;
  private sessionController!: SessionController;
  private resultController!: ResultController;
  private supplyController!: SupplyController;
  private homeController!: HomeController;
  private progressStore!: ProgressStore;
  private packStore!: PackStore;
  private activeSessionId: string | null = null;
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
    this.progressStore = createBrowserProgressStore();
    this.packStore = createBrowserPackStore();
    const audioNode = new Node('AudioRoot');
    this.node.addChild(audioNode);
    const audio = audioNode.addComponent(DemoAudio);

    this.homePanel = createNode('HomePanel', this.node, DESIGN_WIDTH, DESIGN_HEIGHT);
    this.sessionPanel = createNode('SessionPanel', this.node, DESIGN_WIDTH, DESIGN_HEIGHT);
    this.resultPanel = createNode('ResultPanel', this.node, DESIGN_WIDTH, DESIGN_HEIGHT);
    this.supplyPanel = createNode('SupplyPanel', this.node, DESIGN_WIDTH, DESIGN_HEIGHT);
    this.transitionLayer = createNode('TransitionLayer', this.node, DESIGN_WIDTH, DESIGN_HEIGHT);
    for (const panel of [this.homePanel, this.sessionPanel, this.resultPanel, this.supplyPanel, this.transitionLayer]) {
      alignWidget(panel, { left: 0, right: 0, top: 0, bottom: 0 });
    }

    this.homeController = this.homePanel.addComponent(HomeController);
    this.homeController.initialize((slotIndex) => this.startExtraction(slotIndex), () => this.showSupply());
    this.sessionController = this.sessionPanel.addComponent(SessionController);
    this.sessionController.initialize(audio, (snapshot) => this.showResult(snapshot));
    this.resultController = this.resultPanel.addComponent(ResultController);
    this.resultController.initialize(() => this.startExtraction(this.homeController.defaultSlot()),
      () => this.showHome(), () => this.showSupply());
    this.supplyController = this.supplyPanel.addComponent(SupplyController);
    this.supplyController.initialize(() => this.showHome(), (instanceId) => this.completeRefill(instanceId));

    this.showHome();
  }

  private showHome(): void {
    this.supplyController?.dismiss();
    this.extracting = false;
    this.entrySource = null;
    this.clearTransition();
    this.homeController?.setExtractingSlot(null);
    this.homeController?.setEntryMode(false);
    this.homeController?.setPack(this.packStore.readPack());
    this.homeController?.setSmokedCount(this.progressStore.readSmokedCount());
    this.sessionController?.cancelEntryPreview();
    this.homePanel.active = true;
    this.homeController.refreshLayout();
    this.sessionPanel.active = false;
    this.resultPanel.active = false;
    this.supplyPanel.active = false;
    this.transitionLayer.active = false;
  }

  private showSupply(): void {
    const pack = this.packStore.readPack();
    if (!pack || countAvailableSlots(pack) !== 0) return;
    this.supplyController.present(pack);
    this.homePanel.active = false;
    this.sessionPanel.active = false;
    this.resultPanel.active = false;
    this.transitionLayer.active = false;
    this.supplyPanel.active = true;
  }

  private completeRefill(instanceId: string): boolean {
    if (!this.packStore.refillAfterReward(instanceId)) return false;
    this.showHome();
    return true;
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
    this.activeSessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
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
    const smokedCount = this.activeSessionId
      ? this.progressStore.recordCompletedCigarette(this.activeSessionId) : null;
    this.homeController.setSmokedCount(smokedCount);
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
