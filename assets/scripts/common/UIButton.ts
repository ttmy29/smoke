import { _decorator, AudioClip, AudioSource, Button, Color, Component, EventHandler,
  Node, Sprite, Tween, tween, Vec3 } from 'cc';

const { ccclass, property, requireComponent, disallowMultiple, menu } = _decorator;

/** Attach to the hit-area node (normally bg); business callbacks stay outside. */
@ccclass('UIButton')
@requireComponent(Button)
@disallowMultiple
@menu('UI/UIButton')
export class UIButton extends Component {
  @property({ type: Sprite, tooltip: '变色目标；留空时使用当前节点的 Sprite' })
  public tintTarget: Sprite | null = null;
  @property({ type: Node, tooltip: '可选缩放目标，不能是点击节点或其祖先' })
  public visualTarget: Node | null = null;
  @property public pressedTint = new Color(220, 220, 220, 255);
  @property public disabledTint = new Color(140, 140, 140, 255);
  @property public pressScale = 0.96;
  @property public pressDuration = 0.08;
  @property public releaseDuration = 0.12;
  @property({ tooltip: '两次有效点击的最小间隔，单位秒' }) public clickInterval = 0.2;
  @property({ type: AudioClip }) public clickSound: AudioClip | null = null;
  @property public soundVolume = 0.8;
  @property({ type: [EventHandler] }) public clickEvents: EventHandler[] = [];

  private nativeButton: Button | null = null;
  private handler: (() => void) | null = null;
  private nextClickAt = 0;
  private pressed = false;
  private lastInteractable = true;
  private sprite: Sprite | null = null;
  private baseColor: Color | null = null;
  private scaleTarget: Node | null = null;
  private baseScale: Vec3 | null = null;
  private motion: Tween<Node> | null = null;

  public static bind(node: Node, handler: (() => void) | null = null): UIButton {
    const control = node.getComponent(UIButton) ?? node.addComponent(UIButton);
    control.ensureButton();
    control.setHandler(handler);
    return control;
  }

  public setHandler(handler: (() => void) | null): void { this.handler = handler; }
  public get interactable(): boolean { return this.ensureButton().interactable; }
  public set interactable(value: boolean) {
    this.ensureButton().interactable = value;
    this.pressed = false;
    this.lastInteractable = value;
    this.applyFeedback(false);
  }

  /** Allows transparent hit areas to give feedback through a sibling icon. */
  public setTintTarget(target: Sprite | null): void {
    this.restoreFeedback();
    this.tintTarget = target;
    this.captureFeedback();
    this.applyFeedback(false);
  }

  public refreshFeedback(): void {
    this.restoreFeedback();
    this.captureFeedback();
    this.applyFeedback(false);
  }

  protected onLoad(): void { this.ensureButton(); }
  protected onEnable(): void {
    this.captureFeedback();
    this.lastInteractable = this.interactable;
    this.node.on(Node.EventType.TOUCH_START, this.handlePress, this);
    this.node.on(Node.EventType.TOUCH_END, this.handleRelease, this);
    this.node.on(Node.EventType.TOUCH_CANCEL, this.handleRelease, this);
    this.node.on(Node.EventType.MOUSE_LEAVE, this.handleRelease, this);
    this.node.on(Button.EventType.CLICK, this.handleClick, this);
    this.applyFeedback(false);
  }
  protected onDisable(): void {
    this.node.off(Node.EventType.TOUCH_START, this.handlePress, this);
    this.node.off(Node.EventType.TOUCH_END, this.handleRelease, this);
    this.node.off(Node.EventType.TOUCH_CANCEL, this.handleRelease, this);
    this.node.off(Node.EventType.MOUSE_LEAVE, this.handleRelease, this);
    this.node.off(Button.EventType.CLICK, this.handleClick, this);
    this.pressed = false;
    this.nextClickAt = 0;
    this.restoreFeedback();
  }
  protected update(): void {
    if (this.lastInteractable !== this.interactable) {
      this.lastInteractable = this.interactable;
      this.pressed = false;
      this.applyFeedback(false);
    }
  }

  private ensureButton(): Button {
    if (!this.nativeButton) {
      this.nativeButton = this.node.getComponent(Button) ?? this.node.addComponent(Button);
      this.nativeButton.transition = Button.Transition.NONE;
      this.nativeButton.enabled = true;
    }
    return this.nativeButton;
  }
  private captureFeedback(): void {
    this.sprite = this.tintTarget ?? this.node.getComponent(Sprite);
    this.baseColor = this.sprite?.color.clone() ?? null;
    const target = this.visualTarget;
    this.scaleTarget = target && target !== this.node && !this.node.isChildOf(target) ? target : null;
    this.baseScale = this.scaleTarget?.scale.clone() ?? null;
  }
  private restoreFeedback(): void {
    this.motion?.stop();
    this.motion = null;
    if (this.sprite?.isValid && this.baseColor) this.sprite.color = this.baseColor.clone();
    if (this.scaleTarget?.isValid && this.baseScale) this.scaleTarget.setScale(this.baseScale);
  }
  private handlePress(): void {
    if (!this.interactable) return;
    this.pressed = true;
    this.applyFeedback(true);
  }
  private handleRelease(): void {
    this.pressed = false;
    this.applyFeedback(true);
  }
  private handleClick(): void {
    if (!this.enabledInHierarchy || !this.interactable) return;
    const now = Date.now();
    if (now < this.nextClickAt) return;
    this.nextClickAt = now + Math.max(0, this.clickInterval) * 1000;
    this.handleRelease();
    if (this.clickSound) {
      const audio = this.node.getComponent(AudioSource) ?? this.node.addComponent(AudioSource);
      audio.playOneShot(this.clickSound, Math.max(0, Math.min(1, this.soundVolume)));
    }
    // Snapshot editor events before the callback can close/destroy the page.
    const events = this.clickEvents.slice();
    this.handler?.();
    EventHandler.emitEvents(events, this);
  }
  private applyFeedback(animated: boolean): void {
    const tint = !this.interactable ? this.disabledTint : this.pressed ? this.pressedTint : Color.WHITE;
    if (this.sprite?.isValid && this.baseColor) {
      const base = this.baseColor;
      this.sprite.color = new Color(Math.round(base.r * tint.r / 255),
        Math.round(base.g * tint.g / 255), Math.round(base.b * tint.b / 255), base.a);
    }
    this.motion?.stop();
    if (!this.scaleTarget?.isValid || !this.baseScale) return;
    const factor = this.pressed && this.interactable ? Math.max(0.01, this.pressScale) : 1;
    const scale = new Vec3(this.baseScale.x * factor, this.baseScale.y * factor, this.baseScale.z);
    if (!animated) { this.scaleTarget.setScale(scale); return; }
    this.motion = tween(this.scaleTarget)
      .to(Math.max(0, this.pressed ? this.pressDuration : this.releaseDuration), { scale },
        { easing: this.pressed ? 'quadOut' : 'backOut' }).start();
  }
}
