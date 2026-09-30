import { _decorator, Component, Graphics, HorizontalTextAlignment, Label, Node, SafeArea, UIOpacity, view } from 'cc';
import { DemoAudio } from '../audio/DemoAudio';
import { alignWidget, color, createButton, createLabel, createNode, DESIGN_HEIGHT, DESIGN_WIDTH, formatDuration, Palette } from '../common/UiFactory';
import { SessionModel, SessionPhase, SessionSnapshot } from '../domain/SessionModel';
import { BreathEffects } from './effects/BreathEffects';
import { CanvasTexture } from './effects/CanvasTexture';
import { CigaretteView } from './view/CigaretteView';

const { ccclass } = _decorator;

/** Shared by the session and the extraction handoff to avoid a background color cut. */
export function paintCommunityBackground(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const top = height / 2;
  const bottom = -top;
  const left = -width / 2;
  const base = ctx.createLinearGradient(0, top, 0, bottom);
  base.addColorStop(0, '#07080a');
  base.addColorStop(0.52, '#17110c');
  base.addColorStop(1, '#442914');
  ctx.fillStyle = base;
  ctx.fillRect(left, bottom, width, height);

  const hazeY = top - 0.48 * height;
  const hazeRadius = Math.hypot(width / 2, 0.52 * height);
  const haze = ctx.createRadialGradient(0, hazeY, 0, 0, hazeY, hazeRadius);
  haze.addColorStop(0, 'rgba(215,178,138,0.045)');
  haze.addColorStop(0.7, 'rgba(215,178,138,0)');
  haze.addColorStop(1, 'rgba(215,178,138,0)');
  ctx.fillStyle = haze;
  ctx.fillRect(left, bottom, width, height);

  const glowX = 0.24 * width;
  const glowY = top - 0.57 * height;
  const glowRadius = Math.hypot(0.74 * width, 0.57 * height);
  const glow = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, glowRadius);
  glow.addColorStop(0, 'rgba(255,133,55,0.17)');
  glow.addColorStop(0.55, 'rgba(255,105,35,0.045)');
  glow.addColorStop(1, 'rgba(255,105,35,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(left, bottom, width, height);

  const lowerShade = ctx.createLinearGradient(0, top, 0, bottom);
  lowerShade.addColorStop(0, 'rgba(5,7,8,0)');
  lowerShade.addColorStop(0.76, 'rgba(5,7,8,0)');
  lowerShade.addColorStop(0.7601, 'rgba(5,7,8,0.2)');
  lowerShade.addColorStop(1, 'rgba(5,7,8,0.2)');
  ctx.fillStyle = lowerShade;
  ctx.fillRect(left, bottom, width, height);
}

@ccclass('SessionController')
export class SessionController extends Component {
  private model = new SessionModel();
  private cigaretteView!: CigaretteView;
  private breathEffects!: BreathEffects;
  private background!: CanvasTexture;
  private backgroundHeight = 0;
  private timerLabel!: Label;
  private promptLabel!: Label;
  private ringNoteLabel!: Label;
  private muteLabel!: Label;
  private audio!: DemoAudio;
  private onComplete: ((snapshot: Readonly<SessionSnapshot>) => void) | null = null;
  private pointerHeld = false;
  private completionScheduled = false;
  private feedbackText = '';
  private feedbackUntil = 0;
  private compactOnlyHidden: Node[] = [];
  private entryMode = false;
  private entrySceneNodes: Node[] = [];
  private hudOpacity!: UIOpacity;

  public initialize(audio: DemoAudio, onComplete: (snapshot: Readonly<SessionSnapshot>) => void): void {
    this.audio = audio;
    this.onComplete = onComplete;
    this.build();
    this.resetSession();
  }

  public resetSession(): void {
    this.unscheduleAllCallbacks();
    this.audio?.stop();
    this.model = new SessionModel();
    this.pointerHeld = false;
    this.completionScheduled = false;
    this.feedbackText = '';
    this.feedbackUntil = 0;
    this.cigaretteView?.reset();
    this.breathEffects?.reset();
    if (this.cigaretteView) this.render();
  }

  /** Keep the real HUD above the extraction layer while the scene body remains hidden. */
  public beginEntryPreview(): void {
    this.resetSession();
    this.entryMode = true;
    for (const node of this.entrySceneNodes) node.active = false;
    this.hudOpacity.opacity = 0;
  }

  public setEntryHudProgress(progress: number): void {
    if (!this.entryMode) return;
    const alpha = Math.max(0, Math.min(1, (progress - 0.5) / 0.34));
    this.hudOpacity.opacity = Math.round(alpha * 255);
  }

  public finishEntryPreview(): void {
    this.entryMode = false;
    for (const node of this.entrySceneNodes) node.active = true;
    this.hudOpacity.opacity = 255;
    this.drawBackground();
  }

  public cancelEntryPreview(): void {
    this.entryMode = false;
    for (const node of this.entrySceneNodes) node.active = true;
    if (this.hudOpacity) this.hudOpacity.opacity = 255;
  }

  protected update(deltaTime: number): void {
    if (!this.node.activeInHierarchy || this.entryMode) return;
    this.drawBackground();
    const compact = view.getVisibleSize().height < 1280;
    for (const node of this.compactOnlyHidden) node.active = !compact;
    const previousPhase = this.model.snapshot.phase;
    this.model.update(deltaTime);
    this.onPhaseChanged(previousPhase);
    this.cigaretteView.update(deltaTime, this.model.snapshot);
    this.breathEffects.update(deltaTime, this.model.snapshot);
    this.render();

    const phase = this.model.snapshot.phase;
    if (!this.completionScheduled && (phase === SessionPhase.FINISHED || phase === SessionPhase.EXTINGUISHED)) {
      this.completionScheduled = true;
      const snapshot = this.model.snapshot;
      this.scheduleOnce(() => this.onComplete?.(snapshot), 0.65);
    }
  }

  protected onDisable(): void {
    this.audio?.stop();
    this.pointerHeld = false;
  }

  private build(): void {
    this.background = new CanvasTexture('SessionBackground', this.node, DESIGN_WIDTH, DESIGN_HEIGHT);
    this.drawBackground();

    const visualRoot = createNode('CigaretteRoot', this.node, DESIGN_WIDTH, DESIGN_HEIGHT);
    this.cigaretteView = new CigaretteView(visualRoot);
    this.breathEffects = new BreathEffects(this.node);

    const interaction = createNode('InteractionLayer', this.node, 500, 1110, 0, 40);
    interaction.on(Node.EventType.TOUCH_START, this.handlePress, this);
    interaction.on(Node.EventType.TOUCH_END, this.handleRelease, this);
    interaction.on(Node.EventType.TOUCH_CANCEL, this.handleRelease, this);
    interaction.on(Node.EventType.MOUSE_DOWN, this.handlePress, this);
    interaction.on(Node.EventType.MOUSE_UP, this.handleRelease, this);
    interaction.on(Node.EventType.MOUSE_LEAVE, this.handleRelease, this);

    const hud = createNode('SessionSafeHud', this.node, DESIGN_WIDTH, DESIGN_HEIGHT);
    this.hudOpacity = hud.addComponent(UIOpacity);
    alignWidget(hud, { left: 0, right: 0, top: 0, bottom: 0 });
    const safeArea = hud.addComponent(SafeArea);
    safeArea.symmetric = false;
    safeArea.updateArea();
    const packName = createLabel('PackName', hud, '王溪', 40, Palette.white, 250, 50, -210, 695, HorizontalTextAlignment.LEFT);
    alignWidget(packName.node, { left: 42, top: 30 });
    const flavor = createLabel('Flavor', hud, '清甜回甘 · 雪松香 · WANG·XI', 21, Palette.goldMuted, 340, 38, -150, 655, HorizontalTextAlignment.LEFT);
    alignWidget(flavor.node, { left: 42, top: 83 });
    this.timerLabel = createLabel('Timer', hud, '00:00', 21, Palette.gold, 165, 42, -230, 607, HorizontalTextAlignment.LEFT);
    alignWidget(this.timerLabel.node, { left: 42, top: 130 });
    const extinguish = createButton('Extinguish', hud, '熄 灭', 145, 58,
      Palette.surface, Palette.gold, 275, 650, () => {
        if (this.entryMode || !this.model.extinguish().accepted) return;
        // Legacy stopSession stops the current interaction and routes immediately.
        // Do not render an extinguished cigarette during the old completion delay.
        this.pointerHeld = false;
        this.audio.stop();
        this.completeSession();
      }, Palette.goldMuted);
    alignWidget(extinguish.node, { right: 24, top: 42 });

    this.roundTool(hud, 'VoiceTool', '麦克风吸烟', 180);
    const muteButton = createButton('MuteButton', hud, '音效：开', 116, 116,
      Palette.surface, Palette.gold, 280, 352, () => this.toggleMute(), Palette.goldMuted);
    alignWidget(muteButton.node, { right: 28, top: 314 });
    this.makeCircular(muteButton.node);
    this.muteLabel = muteButton.node.getChildByName('Label')!.getComponent(Label)!;
    this.roundTool(hud, 'Environment', '环境', 448);
    this.roundTool(hud, 'Lab', '实验室', 582);
    this.compactOnlyHidden.push(this.roundTool(hud, 'Send', '派烟', 716));
    this.compactOnlyHidden.push(this.roundTool(hud, 'Unlock', '打卡两天', 850));
    const toolNote = createLabel('ToolNote', hud, '灰色入口暂未开放', 15, Palette.muted, 150, 28, 278, -309);
    alignWidget(toolNote.node, { right: 12, top: 976 });
    this.compactOnlyHidden.push(toolNote.node);

    const ashButton = createButton('AshButton', hud, '弹烟灰', 220, 220,
      Palette.surface, Palette.gold, -255, -690, () => this.flickAsh(), Palette.goldMuted);
    alignWidget(ashButton.node, { left: 22, bottom: 54 });
    const ringButton = createButton('SmokeRingButton', hud, '吐烟圈', 220, 220,
      Palette.surface, Palette.gold, 255, -690, () => this.emitSmokeRing(), Palette.goldMuted);
    alignWidget(ringButton.node, { right: 22, bottom: 54 });
    this.ringNoteLabel = createLabel('SmokeRingNote', hud, '吐气时可喷 · 剩余 3 次',
      15, Palette.muted, 220, 35, 250, -825);
    alignWidget(this.ringNoteLabel.node, { right: 22, bottom: 10 });
    this.promptLabel = createLabel('Prompt', hud, '长按画面点火',
      26, Palette.white, 250, 82, 0, -645);
    alignWidget(this.promptLabel.node, { horizontalCenter: 0, bottom: 158 });
    const wave = createLabel('Wave', hud, '·  ··  ···  ··  ·', 22, Palette.goldMuted, 180, 38, 0, -740);
    alignWidget(wave.node, { horizontalCenter: 0, bottom: 80 });
    this.entrySceneNodes = this.node.children.filter((child) => child !== hud);
  }

  /** Default legacy community scene: CSS gradient, faint haze, warm glow and darkened lower edge. */
  private drawBackground(): void {
    const height = Math.max(1, Math.ceil(view.getVisibleSize().height));
    if (height === this.backgroundHeight) return;
    this.backgroundHeight = height;
    this.background.resize(DESIGN_WIDTH, height);
    this.background.redraw((ctx) => paintCommunityBackground(ctx, DESIGN_WIDTH, height));
  }

  private handlePress(): void {
    if (this.entryMode || this.pointerHeld) return;
    this.pointerHeld = true;
    const phase = this.model.snapshot.phase;
    if (phase === SessionPhase.UNLIT) {
      if (this.model.beginLighting().accepted) this.audio.play('ignition');
    } else if (phase === SessionPhase.IDLE) {
      if (this.model.beginInhale().accepted) this.audio.play('inhale');
    }
  }

  private handleRelease(): void {
    if (!this.pointerHeld) return;
    this.pointerHeld = false;
    const previousPhase = this.model.snapshot.phase;
    if (previousPhase === SessionPhase.LIGHTING) this.model.cancelLighting();
    if (previousPhase === SessionPhase.INHALING) this.model.releaseInhale();
    this.onPhaseChanged(previousPhase);
  }

  private flickAsh(): void {
    if (this.entryMode) return;
    const ashBefore = this.model.snapshot.ash;
    const result = this.model.flickAsh();
    if (result.accepted) {
      this.audio.play('ashTap');
      const brokenFraction = ashBefore > 0 ? (ashBefore - this.model.snapshot.ash) / ashBefore : 0;
      this.cigaretteView.flickAsh(Math.max(0.8, 0.35 + 1.35 * brokenFraction));
      this.showHint('烟灰落了。', 0.8);
    } else if (result.reason) {
      this.showHint(result.reason);
    }
  }

  private emitSmokeRing(): void {
    if (this.entryMode) return;
    const result = this.model.emitSmokeRing();
    if (!result.accepted) {
      if (result.reason) this.showHint(result.reason);
      return;
    }
    this.breathEffects.emitRing(Math.min(1, this.model.snapshot.lastInhaleSeconds / 3));
    this.showHint('烟圈喷出去了', 0.8);
  }

  private showHint(message: string, seconds = 1.8): void {
    this.feedbackText = message;
    this.feedbackUntil = this.model.snapshot.elapsedSeconds + seconds;
    this.promptLabel.string = message;
  }

  private toggleMute(): void {
    if (this.entryMode) return;
    const muted = this.audio.toggleMuted();
    this.muteLabel.string = muted ? '音效：关' : '音效：开';
  }

  private onPhaseChanged(previousPhase: SessionPhase): void {
    const phase = this.model.snapshot.phase;
    if (previousPhase === phase) return;
    if (previousPhase === SessionPhase.INHALING) this.audio.stop('inhale');
    if (previousPhase === SessionPhase.EXHALING) this.audio.stop('exhale');
    if (previousPhase === SessionPhase.LIGHTING && phase === SessionPhase.UNLIT) this.audio.stop('ignition');
    if (phase === SessionPhase.EXHALING) this.audio.play('exhale');
    if (phase === SessionPhase.FINISHED || phase === SessionPhase.EXTINGUISHED) this.audio.stop();
  }

  private completeSession(): void {
    if (this.completionScheduled) return;
    this.completionScheduled = true;
    this.onComplete?.(this.model.snapshot);
  }

  private roundTool(parent: Node, name: string, title: string, top: number): Node {
    const button = createButton(name, parent, title, 116, 116,
      Palette.surface, Palette.gold, 280, 0, () => undefined, Palette.goldMuted);
    alignWidget(button.node, { right: 28, top });
    this.makeCircular(button.node);
    button.interactable = false;
    return button.node;
  }

  private makeCircular(node: Node): void {
    const g = node.getComponent(Graphics);
    if (!g) return;
    g.clear();
    g.fillColor = color(Palette.surface); g.circle(0, 0, 58); g.fill();
    g.strokeColor = color(Palette.goldMuted); g.lineWidth = 2; g.circle(0, 0, 58); g.stroke();
  }

  private render(): void {
    const snapshot = this.model.snapshot;
    this.cigaretteView.render(snapshot);
    this.timerLabel.string = formatDuration(snapshot.elapsedSeconds);
    this.promptLabel.string = snapshot.elapsedSeconds < this.feedbackUntil
      ? this.feedbackText : this.promptFor(snapshot);
    this.ringNoteLabel.string = `吐气时可喷 · 剩余 ${Math.max(0, 3 - snapshot.smokeRingCount)} 次`;
  }

  private promptFor(snapshot: Readonly<SessionSnapshot>): string {
    switch (snapshot.phase) {
      case SessionPhase.UNLIT: return '长按画面点火';
      case SessionPhase.LIGHTING: return '正在点火…';
      case SessionPhase.IDLE: return '长按画面吸气\n松手吐气';
      case SessionPhase.INHALING: return `慢慢吸气\n${Math.min(3, snapshot.phaseElapsedSeconds).toFixed(1)} / 3.0 秒`;
      case SessionPhase.EXHALING: return `慢慢吐气\n剩余 ${Math.max(0, snapshot.lastInhaleSeconds - snapshot.phaseElapsedSeconds).toFixed(1)} 秒`;
      case SessionPhase.FINISHED: return '这根结束了';
      case SessionPhase.EXTINGUISHED: return '已经熄灭';
      default: return '';
    }
  }
}
