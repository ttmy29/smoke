/**
 * 会话业务模型，不依赖 Cocos API。
 *
 * 画面、输入和音频只消费 snapshot，不得直接改写会话数据。
 * 所有时间和消耗数值集中在 SessionTuning，后续可按录屏统一调参。
 */

export enum SessionPhase {
  UNLIT = 'unlit',
  LIGHTING = 'lighting',
  IDLE = 'idle',
  INHALING = 'inhaling',
  EXHALING = 'exhaling',
  FINISHED = 'finished',
  EXTINGUISHED = 'extinguished',
}

export type SessionOutcome = 'finished' | 'extinguished' | null;

export interface SessionTuning {
  lightingSeconds: number;
  exhaleThresholdSeconds: number;
  minimumPuffSeconds: number;
  maximumPuffSeconds: number;
  idleBurnPerSecond: number;
  inhaleBurnPerSecond: number;
  ashPerConsumedRatio: number;
  smokeRingLimit: number;
}

export interface SessionSnapshot {
  phase: SessionPhase;
  outcome: SessionOutcome;
  remaining: number;
  ash: number;
  elapsedSeconds: number;
  phaseElapsedSeconds: number;
  inhaleCount: number;
  ashFlickCount: number;
  smokeRingCount: number;
  lastInhaleSeconds: number;
}

export interface SessionActionResult {
  accepted: boolean;
  reason?: string;
}

export const DEFAULT_SESSION_TUNING: Readonly<SessionTuning> = Object.freeze({
  lightingSeconds: 0.68,
  exhaleThresholdSeconds: 0.3,
  minimumPuffSeconds: 0.001,
  maximumPuffSeconds: 3,
  idleBurnPerSecond: 0,
  inhaleBurnPerSecond: 1 / 30,
  ashPerConsumedRatio: 1.8667,
  smokeRingLimit: 3,
});

export class SessionModel {
  private readonly tuning: SessionTuning;
  private phase = SessionPhase.UNLIT;
  private outcome: SessionOutcome = null;
  private remaining = 1;
  private ash = 0;
  private elapsedSeconds = 0;
  private phaseElapsedSeconds = 0;
  private inhaleCount = 0;
  private ashFlickCount = 0;
  private smokeRingCount = 0;
  private currentPuffCounted = false;
  private lastInhaleSeconds = 0;

  constructor(tuning: Partial<SessionTuning> = {}) {
    this.tuning = { ...DEFAULT_SESSION_TUNING, ...tuning };
    this.validateTuning();
  }

  public get snapshot(): Readonly<SessionSnapshot> {
    return Object.freeze({
      phase: this.phase,
      outcome: this.outcome,
      remaining: this.remaining,
      ash: this.ash,
      elapsedSeconds: this.elapsedSeconds,
      phaseElapsedSeconds: this.phaseElapsedSeconds,
      inhaleCount: this.inhaleCount,
      ashFlickCount: this.ashFlickCount,
      smokeRingCount: this.smokeRingCount,
      lastInhaleSeconds: this.lastInhaleSeconds,
    });
  }

  public beginLighting(): SessionActionResult {
    if (this.phase !== SessionPhase.UNLIT) {
      return this.reject('只有未点燃状态可以开始点火');
    }
    this.enterPhase(SessionPhase.LIGHTING);
    return this.accept();
  }

  public cancelLighting(): SessionActionResult {
    if (this.phase !== SessionPhase.LIGHTING) {
      return this.reject('当前没有正在进行的点火');
    }
    this.enterPhase(SessionPhase.UNLIT);
    return this.accept();
  }

  public beginInhale(): SessionActionResult {
    if (this.phase !== SessionPhase.IDLE) {
      return this.reject('只有点燃后的待机状态可以吸入');
    }
    this.currentPuffCounted = false;
    this.enterPhase(SessionPhase.INHALING);
    return this.accept();
  }

  public releaseInhale(): SessionActionResult {
    if (this.phase !== SessionPhase.INHALING) {
      return this.reject('当前没有正在进行的吸入');
    }
    this.finishInhale();
    return this.accept();
  }

  public flickAsh(): SessionActionResult {
    if (this.phase !== SessionPhase.IDLE && this.phase !== SessionPhase.INHALING && this.phase !== SessionPhase.EXHALING) {
      return this.reject('只能在点燃后弹灰');
    }
    // Legacy canFlickSmokingAsh: the warning threshold is not a click gate.
    if (this.ash <= 0 && this.ashFlickCount === 0) {
      return this.reject('还没有烟灰可以弹');
    }
    const nextCount = this.ashFlickCount + 1;
    const value = Math.sin(nextCount * 127.71 + 260908) * 43758.5453;
    const retain = 0.1 + 0.72 * (value - Math.floor(value));
    this.ash *= retain;
    this.ashFlickCount += 1;
    return this.accept();
  }

  /** Basic gesture ring; formation/unlimited-ring unlocks are out of scope. */
  public emitSmokeRing(): SessionActionResult {
    if (this.phase !== SessionPhase.EXHALING) {
      return this.reject(this.phase === SessionPhase.INHALING
        ? '还在吸气，吐气时再喷烟圈' : '吐气时才能喷烟圈');
    }
    if (this.smokeRingCount >= this.tuning.smokeRingLimit) {
      return this.reject(`这支烟的 ${this.tuning.smokeRingLimit} 次烟圈已用完`);
    }
    this.smokeRingCount += 1;
    return this.accept();
  }

  public extinguish(): SessionActionResult {
    if (this.isEnded()) {
      return this.reject('会话已经结束');
    }
    this.outcome = 'extinguished';
    this.enterPhase(SessionPhase.EXTINGUISHED);
    return this.accept();
  }

  /** 每帧由控制器调用。负数和非有限时间会被忽略。 */
  public update(deltaSeconds: number): void {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0 || this.isEnded()) {
      return;
    }

    this.elapsedSeconds += deltaSeconds;
    this.phaseElapsedSeconds += deltaSeconds;

    switch (this.phase) {
      case SessionPhase.LIGHTING:
        if (this.phaseElapsedSeconds >= this.tuning.lightingSeconds) {
          this.enterPhase(SessionPhase.IDLE);
        }
        break;
      case SessionPhase.IDLE:
        this.consume(this.tuning.idleBurnPerSecond * deltaSeconds);
        break;
      case SessionPhase.INHALING:
        // 旧版满 3 秒自动结束吸入；松手与自动结束共用 finishInhale。
        const previousPhaseElapsed = this.phaseElapsedSeconds - deltaSeconds;
        const activeInhaleSeconds = Math.min(
          deltaSeconds,
          Math.max(0, this.tuning.maximumPuffSeconds - previousPhaseElapsed),
        );
        this.consume(this.tuning.inhaleBurnPerSecond * activeInhaleSeconds);
        if (!this.isEnded() && this.phaseElapsedSeconds >= this.tuning.maximumPuffSeconds) this.finishInhale();
        break;
      case SessionPhase.EXHALING:
        this.consume(this.tuning.idleBurnPerSecond * deltaSeconds);
        if (!this.isEnded() && this.phaseElapsedSeconds >= this.lastInhaleSeconds) {
          this.enterPhase(SessionPhase.IDLE);
        }
        break;
      default:
        break;
    }
  }

  private consume(amount: number): void {
    const previous = this.remaining;
    this.remaining = Math.max(0, this.remaining - Math.max(0, amount));
    const consumed = previous - this.remaining;
    this.ash = Math.min(1, this.ash + consumed * this.tuning.ashPerConsumedRatio);

    if (this.remaining <= 0.000001) {
      if (this.phase === SessionPhase.INHALING) {
        this.lastInhaleSeconds = Math.min(this.phaseElapsedSeconds, this.tuning.maximumPuffSeconds);
        this.countPuffIfEligible();
      }
      this.remaining = 0;
      this.outcome = 'finished';
      this.enterPhase(SessionPhase.FINISHED);
    }
  }

  private countPuffIfEligible(): void {
    if (
      !this.currentPuffCounted &&
      this.phaseElapsedSeconds >= this.tuning.minimumPuffSeconds
    ) {
      this.currentPuffCounted = true;
      this.inhaleCount += 1;
    }
  }

  private finishInhale(): void {
    this.lastInhaleSeconds = Math.min(this.phaseElapsedSeconds, this.tuning.maximumPuffSeconds);
    this.countPuffIfEligible();
    if (this.lastInhaleSeconds > this.tuning.exhaleThresholdSeconds) {
      this.enterPhase(SessionPhase.EXHALING);
    } else {
      this.enterPhase(SessionPhase.IDLE);
    }
  }

  private enterPhase(next: SessionPhase): void {
    this.phase = next;
    this.phaseElapsedSeconds = 0;
  }

  private isEnded(): boolean {
    return this.phase === SessionPhase.FINISHED || this.phase === SessionPhase.EXTINGUISHED;
  }

  private accept(): SessionActionResult {
    return { accepted: true };
  }

  private reject(reason: string): SessionActionResult {
    return { accepted: false, reason };
  }

  private validateTuning(): void {
    const values: Array<[string, number]> = [
      ['lightingSeconds', this.tuning.lightingSeconds],
      ['exhaleThresholdSeconds', this.tuning.exhaleThresholdSeconds],
      ['minimumPuffSeconds', this.tuning.minimumPuffSeconds],
      ['maximumPuffSeconds', this.tuning.maximumPuffSeconds],
      ['idleBurnPerSecond', this.tuning.idleBurnPerSecond],
      ['inhaleBurnPerSecond', this.tuning.inhaleBurnPerSecond],
      ['ashPerConsumedRatio', this.tuning.ashPerConsumedRatio],
      ['smokeRingLimit', this.tuning.smokeRingLimit],
    ];
    for (const [name, value] of values) {
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(`SessionTuning.${name} 必须是非负有限数`);
      }
    }
    if (this.tuning.maximumPuffSeconds < this.tuning.minimumPuffSeconds) {
      throw new Error('maximumPuffSeconds 不能小于 minimumPuffSeconds');
    }
    if (!Number.isInteger(this.tuning.smokeRingLimit) || this.tuning.smokeRingLimit < 1) {
      throw new Error('smokeRingLimit 必须是正整数');
    }
  }
}
