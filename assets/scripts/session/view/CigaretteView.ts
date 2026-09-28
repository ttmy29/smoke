import { Graphics, Node, screen, view } from 'cc';
import { color, createNode } from '../../common/UiFactory';
import { SessionPhase, SessionSnapshot } from '../../domain/SessionModel';
import { CanvasTexture } from '../effects/CanvasTexture';

interface AshFragment {
  kind: 'ash' | 'dust'; x: number; y: number; vx: number; vy: number;
  age: number; lifetime: number; size: number; scale: number; opacity: number;
  rotation: number; spin: number; settled: boolean;
}
interface SmokePoint { x: number; y: number; age: number; material: number; split: number }
interface SmokeTrail { points: SmokePoint[]; seed: number; sequence: number; slot: number }
interface Spark {
  x: number; y: number; vx: number; vy: number;
  age: number; lifetime: number; size: number; opacity: number; heat: number;
}

export class CigaretteView {
  private readonly smoke: CanvasTexture;
  private readonly debris: Graphics;
  private readonly ignition: CanvasTexture;
  private readonly charBacking: CanvasTexture;
  private readonly bodyMaterial: CanvasTexture;
  private readonly tipMaterial: CanvasTexture;
  private readonly sparks: Graphics;
  private readonly sparkGlow: CanvasTexture;
  private time = 0;
  private fragments: AshFragment[] = [];
  private ashFlickSerial = 0;
  private trails: SmokeTrail[] = [];
  private activeTrail: SmokeTrail | null = null;
  private smokeCarry = 0;
  private trailSerial = 0;
  private tipY = 480;
  private charTopY = 483;
  private emberTopY = 486;
  private ashTopY = 500;
  private ashMaterialEnd = 0;
  private ashMaterialScale = 1;
  private burnProgress = 0;
  private emberHeat = 0;
  private sparkCarry = 0;
  private sparkSerial = 0;
  private sparkParticles: Spark[] = [];
  private ashBreakAge = Number.POSITIVE_INFINITY;
  private smokeVisible = false;
  private tipVisible = false;
  private ignitionVisible = false;
  private bodyKey = '';
  private entryProgress = 1;

  constructor(parent: Node) {
    // Legacy draw order: tip smoke and ignition behind the cigarette/ash.
    this.smoke = new CanvasTexture('TipSmoke', parent, 500, 1400);
    this.smoke.node.setPosition(0, 400);
    this.ignition = new CanvasTexture('IgnitionLighter', parent, 350, 650);
    this.ignition.node.setPosition(0, 400);
    this.charBacking = new CanvasTexture('CharBacking', parent, 190, 1050);
    this.charBacking.node.setPosition(0, 300);
    this.bodyMaterial = new CanvasTexture('CigaretteBodyMaterial', parent, 190, 1600);
    this.tipMaterial = new CanvasTexture('TipMaterial', parent, 190, 1050);
    this.tipMaterial.node.setPosition(0, 300);
    this.sparkGlow = new CanvasTexture('EmberSparkGlow', parent, 320, 560);
    this.sparks = createNode('EmberSparks', parent, 750, 1600).addComponent(Graphics);
    this.debris = createNode('AshDebris', parent, 750, 1600).addComponent(Graphics);
  }

  /** The entry preview is rebuilt for each extraction; release its Canvas assets on handoff. */
  public dispose(): void {
    this.smoke.dispose();
    this.ignition.dispose();
    this.charBacking.dispose();
    this.bodyMaterial.dispose();
    this.tipMaterial.dispose();
    this.sparkGlow.dispose();
  }

  public reset(): void {
    this.time = 0;
    this.fragments = [];
    this.ashFlickSerial = 0;
    this.trails = [];
    this.activeTrail = null;
    this.smokeCarry = 0;
    this.trailSerial = 0;
    this.emberHeat = 0;
    this.sparkCarry = 0;
    this.sparkSerial = 0;
    this.sparkParticles = [];
    this.ashBreakAge = Number.POSITIVE_INFINITY;
    this.smokeVisible = false;
    this.tipVisible = false;
    this.ignitionVisible = false;
    this.ashTopY = 500;
    this.ashMaterialEnd = 0;
    this.ashMaterialScale = 1;
    this.charTopY = 483;
    this.emberTopY = 486;
    this.burnProgress = 0;
    this.bodyKey = '';
    this.entryProgress = 1;
    this.bodyMaterial.clear();
    this.smoke.clear();
    this.charBacking.clear();
    this.tipMaterial.clear();
    this.sparks.clear();
    this.sparkGlow.clear();
    this.debris.clear();
    this.ignition.clear();
  }

  public update(deltaTime: number, snapshot: Readonly<SessionSnapshot>): void {
    const delta = Math.min(deltaTime, 0.05);
    const cssScale = this.cssScale();
    this.time += delta;
    this.ashBreakAge += delta;
    this.updateTipGeometry(snapshot);
    const heatTarget = snapshot.phase === SessionPhase.INHALING ? 1
      : snapshot.phase === SessionPhase.LIGHTING ? 0.82 * Math.min(1, snapshot.phaseElapsedSeconds / 0.68)
        : snapshot.phase === SessionPhase.IDLE || snapshot.phase === SessionPhase.EXHALING ? 0.18 : 0;
    const heatTau = heatTarget > this.emberHeat ? 0.14 : 0.28;
    this.emberHeat += (heatTarget - this.emberHeat) * (1 - Math.exp(-delta / heatTau));
    const settleY = -this.viewportHeight() / 2 + 12 * cssScale;
    for (const f of this.fragments) {
      f.age += delta;
      const progress = Math.min(1, f.age / f.lifetime);
      if (f.settled) {
        f.opacity = Math.min(f.opacity, 0.74 * Math.pow(1 - progress, 0.28));
        continue;
      }
      f.x += f.vx * delta;
      f.y += f.vy * delta;
      f.vy -= (f.kind === 'ash' ? 118 : 42) * cssScale * delta;
      if (f.kind === 'ash') {
        f.rotation += f.spin * delta;
        f.vx *= Math.pow(0.992, 60 * delta);
        f.opacity = Math.min(f.opacity, (1 - progress) * 1.4);
      } else {
        f.scale += 1.8 * delta;
        f.opacity *= Math.pow(0.91, 60 * delta);
      }
      if (f.kind === 'ash' && f.y <= settleY) {
        f.y = settleY;
        f.vx = 0;
        f.vy = 0;
        f.spin = 0;
        f.settled = true;
        f.age = 0;
        f.lifetime = 78 + this.hash(this.ashFlickSerial, Math.round(f.size * 10)) * 24;
      }
    }
    this.fragments = this.fragments.filter((f) => f.age < f.lifetime);
    for (const trail of this.trails) {
      for (const point of trail.points) point.age += delta;
      trail.points = trail.points.filter((point) => point.age < 6.8);
    }
    this.trails = this.trails.filter((trail) => trail.points.length > 0 || trail === this.activeTrail);
    for (const spark of this.sparkParticles) {
      spark.age += delta;
      spark.vy -= 80 * cssScale * delta;
      spark.vx *= Math.pow(0.98, 60 * delta);
      spark.x += spark.vx * delta;
      spark.y += spark.vy * delta;
      spark.opacity *= Math.pow(0.965, 60 * delta);
      spark.heat = Math.max(0, spark.heat - 1.08 * delta);
    }
    this.sparkParticles = this.sparkParticles.filter((spark) => spark.age < spark.lifetime);
    if (snapshot.phase === SessionPhase.LIGHTING || snapshot.phase === SessionPhase.INHALING) {
      const rate = snapshot.phase === SessionPhase.LIGHTING
        ? 2 + 8 * this.emberHeat : 5 + 19 * this.emberHeat;
      this.sparkCarry += rate * delta;
      while (this.sparkCarry >= 1) {
        this.sparkCarry -= 1;
        this.emitSpark(0, (this.charTopY + this.emberTopY) / 2, this.emberHeat);
      }
    } else {
      this.sparkCarry = 0;
    }
    if (snapshot.phase !== SessionPhase.IDLE && snapshot.phase !== SessionPhase.EXHALING) {
      this.activeTrail = null;
      this.smokeCarry = 0;
      return;
    }
    if (!this.activeTrail) {
      this.activeTrail = {
        points: [], seed: (47 * (this.trailSerial + 1) + 19) % 101 / 100,
        sequence: 0, slot: this.trailSerial % 4,
      };
      this.trailSerial += 1;
      this.trails.push(this.activeTrail);
      if (this.trails.length > 4) this.trails.shift();
      this.smokeCarry = 0.075;
    }
    this.smokeCarry += delta;
    while (this.smokeCarry >= 0.075) {
      this.smokeCarry -= 0.075;
      const serial = this.activeTrail.sequence++;
      const material = serial * 0.075 * 48;
      const sampleTime = this.time - this.smokeCarry;
      const splitWave = Math.sin(sampleTime * (0.62 + 0.16 * this.activeTrail.seed)
        + this.activeTrail.seed * Math.PI * 2 + 0.28 * Math.sin(0.27 * sampleTime + 11 * this.activeTrail.seed));
      const split = this.smoothstep(Math.max(0, Math.min(1, (splitWave + 0.3) / 0.6)));
      this.activeTrail.points.push({
        x: 0,
        y: this.ashTopY,
        age: this.smokeCarry,
        material,
        split,
      });
      if (this.activeTrail.points.length > 96) this.activeTrail.points.shift();
    }
  }

  public flickAsh(intensity: number): void {
    this.ashBreakAge = 0;
    const serial = this.ashFlickSerial++;
    const random = (index: number, channel: number): number => this.hash(serial * 83 + index, channel);
    const cssScale = this.cssScale();
    const ashCenterY = (this.charTopY + this.emberTopY) / 2;
    const strength = Math.max(0.2, Math.min(2, intensity));
    const chunks = Math.max(8, Math.min(10, Math.round((8 + 2 * random(0, 0)) * Math.max(0.8, strength))));
    const dust = Math.max(8, Math.round((18 + 18 * random(0, 1)) * strength));
    for (let index = 0; index < chunks; index += 1) {
      this.fragments.push({
        kind: 'ash',
        x: (random(index, 2) - 0.5) * 12 * cssScale,
        y: ashCenterY - index * 1.8 * cssScale,
        vx: (random(index, 3) - 0.35) * 52 * cssScale,
        vy: (18 + 46 * random(index, 4)) * cssScale,
        age: 0, lifetime: 7 + 2 * random(index, 5),
        size: (2.2 + 4.2 * random(index, 6)) * cssScale,
        scale: 1,
        opacity: 0.72 + 0.22 * random(index, 7),
        rotation: random(index, 8) * Math.PI * 2,
        spin: (random(index, 9) - 0.5) * 8,
        settled: false,
      });
    }
    for (let index = 0; index < dust; index += 1) {
      this.fragments.push({
        kind: 'dust',
        x: (random(index, 10) - 0.5) * 15 * cssScale,
        y: ashCenterY + (random(index, 11) - 0.5) * 8 * cssScale,
        vx: (random(index, 12) - 0.42) * 82 * cssScale,
        vy: (10 + 54 * random(index, 13)) * cssScale,
        age: 0, lifetime: 0.55 + 0.55 * random(index, 14),
        size: (1 + 2.8 * random(index, 15)) * cssScale,
        scale: 0.5,
        opacity: 0.24 + 0.34 * random(index, 16),
        rotation: 0, spin: 0, settled: false,
      });
    }
    for (let index = 0; index < 5; index += 1) this.emitSpark(0, ashCenterY, this.emberHeat);
    if (this.fragments.length > 220) this.fragments.splice(0, this.fragments.length - 220);
  }

  /** Legacy emitSpark: all sizes, speeds and jitter start in CSS pixels. */
  private emitSpark(x: number, y: number, heat: number): void {
    const id = this.sparkSerial++;
    const random = (channel: number): number => this.hash(id, channel + 17);
    const cssScale = this.cssScale();
    const angle = -Math.PI * (0.18 + 0.64 * random(0));
    const speed = (28 + 72 * random(1)) * cssScale;
    this.sparkParticles.push({
      x: x + (random(2) - 0.5) * 8 * cssScale,
      y: y - (random(3) - 0.5) * 5 * cssScale,
      vx: Math.cos(angle) * speed,
      vy: -Math.sin(angle) * speed,
      size: (1.2 + 2.2 * random(4)) * cssScale,
      opacity: 0.78 + 0.22 * random(5),
      heat: Math.max(0, Math.min(1, heat)),
      age: 0,
      lifetime: 0.62 + 0.34 * random(6),
    });
  }

  public render(snapshot: Readonly<SessionSnapshot>): void {
    this.updateTipGeometry(snapshot);
    // sessionCigaretteRestGeometry, scaled to the current visible viewport height.
    const bottom = this.filterBottomY();
    const filterHeight = this.filterHeight();
    const paperHeight = this.paperHeight(snapshot.remaining);
    const paperBottom = bottom + filterHeight;
    this.tipY = paperBottom + paperHeight;
    // Legacy drawCigarette previews the burning tip as soon as ignition progress is positive.
    // The session is not successfully lit until the 680 ms state transition completes.
    const ignitionPreview = snapshot.phase === SessionPhase.LIGHTING && snapshot.phaseElapsedSeconds > 0;
    const lit = snapshot.phase !== SessionPhase.UNLIT && (snapshot.phase !== SessionPhase.LIGHTING || ignitionPreview);
    const burning = lit && snapshot.phase !== SessionPhase.FINISHED && snapshot.phase !== SessionPhase.EXTINGUISHED;

    const paperEdgeAmplitude = burning ? Math.max(2.6 * this.cssScale(), 0.1 * 82) : 0;
    this.renderBodyMaterial(bottom, paperBottom, filterHeight, paperHeight, paperEdgeAmplitude);

    const ashBaseY = this.emberTopY;
    const ashHeight = this.ashTopY - ashBaseY;
    this.renderCharBacking(burning);
    this.renderTipMaterial(burning, ashBaseY, ashHeight);
    this.renderTipSmoke();
    this.renderIgnition(snapshot);
    this.renderSparks();
    this.renderDebris();
  }

  public setEntryProgress(progress: number): void {
    this.entryProgress = Math.max(0, Math.min(1, progress));
  }

  /** Shared paper/filter material for both extraction and the resting cigarette. */
  private renderBodyMaterial(bottom: number, paperBottom: number, filterHeight: number,
    paperHeight: number, edgeAmplitude: number): void {
    const canvasHeight = Math.ceil(Math.max(1600, this.viewportHeight() + 200));
    this.bodyMaterial.resize(190, canvasHeight);
    const shadowStep = Math.round(this.entryProgress * 32);
    const key = [canvasHeight, bottom, paperBottom, paperHeight, edgeAmplitude,
      this.burnProgress, shadowStep].join(':');
    if (key === this.bodyKey) return;
    this.bodyKey = key;
    this.bodyMaterial.redraw((ctx) => {
      const scale = this.cssScale();
      const shadowAmount = Math.max(0, Math.min(1, (this.entryProgress - 0.28) / 0.72));
      ctx.save();
      ctx.shadowColor = `rgba(0,0,0,${0.3 + 0.2 * shadowAmount})`;
      ctx.shadowBlur = (2.5 + 15.5 * shadowAmount) * scale;
      ctx.shadowOffsetY = -(2 + 10 * shadowAmount) * scale;

      const paper = (): void => {
        ctx.beginPath();
        ctx.moveTo(-41, paperBottom);
        ctx.lineTo(41, paperBottom);
        for (let step = 14; step >= 0; step -= 1) {
          ctx.lineTo(-41 + 82 * step / 14,
            this.tipY - this.contourOffset(step, edgeAmplitude, 0));
        }
        ctx.closePath();
      };
      paper();
      const paperGradient = ctx.createLinearGradient(-41, 0, 41, 0);
      paperGradient.addColorStop(0, '#c9c5bc');
      paperGradient.addColorStop(0.18, '#f3f1ea');
      paperGradient.addColorStop(0.56, '#ebe8df');
      paperGradient.addColorStop(0.84, '#f5f2ea');
      paperGradient.addColorStop(1, '#bbb7ae');
      ctx.fillStyle = paperGradient;
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.save();
      paper();
      ctx.clip();
      ctx.strokeStyle = 'rgba(105,99,89,0.065)';
      ctx.lineWidth = 0.65 * scale;
      for (let y = paperBottom + 4 * scale; y < this.tipY; y += 4.2 * scale) {
        ctx.beginPath();
        ctx.moveTo(-40, y);
        ctx.lineTo(40, y);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(92,86,77,0.11)';
      ctx.fillRect(-40.4, paperBottom, 0.8 * scale, paperHeight);
      ctx.restore();

      const filter = (): void => {
        ctx.beginPath();
        ctx.moveTo(-41, paperBottom);
        ctx.lineTo(41, paperBottom);
        ctx.lineTo(41, bottom + 7 * scale);
        ctx.quadraticCurveTo(41, bottom, 33, bottom);
        ctx.lineTo(-33, bottom);
        ctx.quadraticCurveTo(-41, bottom, -41, bottom + 7 * scale);
        ctx.closePath();
      };
      filter();
      ctx.fillStyle = '#b47f3f';
      ctx.fill();
      ctx.save();
      filter();
      ctx.clip();
      const cylinder = ctx.createLinearGradient(-41, 0, 41, 0);
      cylinder.addColorStop(0, 'rgba(8,10,11,0.30)');
      cylinder.addColorStop(0.52, 'rgba(255,255,255,0.08)');
      cylinder.addColorStop(1, 'rgba(8,10,11,0.28)');
      ctx.fillStyle = cylinder;
      ctx.fillRect(-41, bottom, 82, filterHeight);
      const bandHeight = Math.max(2 * scale, 0.04 * filterHeight);
      ctx.fillStyle = 'rgba(23,63,55,0.9)';
      ctx.fillRect(-41, paperBottom - 0.13 * filterHeight - bandHeight, 82, bandHeight);
      for (let index = 0; index < 28; index += 1) {
        const x = -41 + 82 * (0.08 + ((37 * index) % 84) / 100);
        const y = paperBottom - filterHeight * (0.09 + ((53 * index) % 82) / 100);
        ctx.beginPath();
        ctx.ellipse(x, y, (0.55 + (index % 3) * 0.22) * scale,
          (0.35 + (index % 2) * 0.18) * scale, (index % 5) * 0.34, 0, Math.PI * 2);
        ctx.fillStyle = index % 3 === 0 ? 'rgba(8,10,11,0.08)' : 'rgba(255,255,255,0.12)';
        ctx.fill();
      }
      ctx.beginPath();
      ctx.ellipse(0, paperBottom - 0.46 * filterHeight,
        0.72 * 0.13 * 82, 1.15 * 0.13 * 82, 0.35, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(224,192,151,0.62)';
      ctx.lineWidth = Math.max(0.8 * scale, 0.025 * 82);
      ctx.stroke();
      ctx.restore();

      const cap = ctx.createRadialGradient(0, bottom, 0, 0, bottom, 41);
      cap.addColorStop(0, 'rgba(255,255,255,0.12)');
      cap.addColorStop(0.58, 'rgba(255,255,255,0)');
      cap.addColorStop(1, 'rgba(8,10,11,0.52)');
      ctx.beginPath();
      ctx.ellipse(0, bottom + 0.5 * scale, 0.47 * 82, Math.max(2.2 * scale, 0.09 * 82),
        0, 0, Math.PI * 2);
      ctx.fillStyle = '#b47f3f';
      ctx.fill();
      ctx.fillStyle = cap;
      ctx.fill();
      ctx.restore();
    });
  }

  private viewportHeight(): number { return view.getVisibleSize().height; }
  private cssScale(): number {
    const frameWidth = screen.windowSize.width / (screen.devicePixelRatio || 1);
    return frameWidth > 0 ? view.getVisibleSize().width / frameWidth : 1.92;
  }
  private filterBottomY(): number { return this.viewportHeight() * (0.5 - 0.795); }
  private filterHeight(): number { return Math.max(98 * 1.92, 0.145 * this.viewportHeight()); }
  private paperHeight(remaining: number): number {
    return Math.max(9, Math.max(218 * 1.92, 0.325 * this.viewportHeight()) * remaining);
  }

  private updateTipGeometry(snapshot: Readonly<SessionSnapshot>): void {
    this.burnProgress = Math.max(0, 1 - snapshot.remaining);
    this.tipY = this.filterBottomY() + this.filterHeight() + this.paperHeight(snapshot.remaining);
    // smoking-physics.computeCigaretteBurnGeometry bounds ash by burnt material.
    const burnedLen = (380 * (1 - 0.32)) * Math.max(0, 1 - snapshot.remaining);
    const emberLen = Math.min(7, burnedLen);
    const charLen = Math.min(10, Math.max(0, burnedLen - emberLen));
    const materialScale = 82 / 37.065;
    const cssScale = this.cssScale();
    const charFold = Math.max(1.2 * cssScale,
      Math.min(0.065 * 82, 1.1 * cssScale + 0.12 * charLen * materialScale));
    this.charTopY = this.tipY + charFold;
    this.emberTopY = this.charTopY + (1.4 + 7.2 * Math.min(1, emberLen / 7)) * materialScale;
    const ashLen = Math.min(Math.max(0, snapshot.ash) * 68,
      Math.max(0, burnedLen - emberLen - charLen));
    this.ashMaterialEnd = this.burnProgress * (0.0014 / 0.00075) * 68;
    this.ashMaterialScale = this.paperHeight(1) / (380 * (1 - 0.32));
    this.ashTopY = this.emberTopY + ashLen * this.ashMaterialScale;
  }

  private renderCharBacking(burning: boolean): void {
    if (!burning) {
      this.charBacking.clear();
      return;
    }
    this.charBacking.redraw((ctx) => {
      ctx.translate(0, -300);
      const charTopAmplitude = Math.max(0.65 * this.cssScale(), 0.025 * 82);
      const paperEdgeAmplitude = Math.max(2.6 * this.cssScale(), 0.1 * 82);
      const gradient = ctx.createLinearGradient(0, this.charTopY + charTopAmplitude,
        0, this.tipY - paperEdgeAmplitude);
      gradient.addColorStop(0, '#221915');
      gradient.addColorStop(0.18, '#100c09');
      gradient.addColorStop(0.4, '#2c1e15');
      gradient.addColorStop(0.7, '#4e3423');
      gradient.addColorStop(1, '#63422d');
      ctx.fillStyle = gradient;
      ctx.fillRect(-40, this.tipY - paperEdgeAmplitude, 80,
        this.charTopY + charTopAmplitude - this.tipY + paperEdgeAmplitude);
    });
  }

  private renderTipMaterial(burning: boolean, ashBaseY: number, ashHeight: number): void {
    // The legacy threshold is in CSS pixels, while this view uses design units.
    const minimumAshHeight = 0.45 * this.cssScale();
    if (!burning && ashHeight <= minimumAshHeight) {
      if (this.tipVisible) this.tipMaterial.clear();
      this.tipVisible = false;
      return;
    }
    this.tipVisible = true;
    this.tipMaterial.redraw((ctx) => {
      ctx.translate(0, -300);
      if (burning) {
        const heat = Math.max(0, Math.min(1, this.emberHeat));
        const activeHeat = Math.max(0, Math.min(1, (heat - 0.18) / 0.82));
        const brightness = 0.6 + 0.4 * activeHeat;
        const emberGreen = 112 - 66 * heat;
        const emberBlue = 28 - 12 * heat;
        const charTopAmplitude = Math.max(0.65 * this.cssScale(), 0.025 * 82);
        const charBottomAmplitude = Math.max(0.45 * this.cssScale(), 0.018 * 82);
        ctx.save();
        ctx.beginPath();
        for (let step = 0; step <= 16; step += 1) {
          const x = -40 + 80 * step / 16;
          const y = this.emberTopY - this.contourOffset(step, 0.45 * (82 / 37.065), 11);
          if (step === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        for (let step = 16; step >= 0; step -= 1) {
          const x = -40 + 80 * step / 16;
          ctx.lineTo(x, this.charTopY - this.contourOffset(step, charTopAmplitude, 3));
        }
        ctx.closePath();
        const ember = ctx.createLinearGradient(0, this.emberTopY, 0, this.charTopY);
        ember.addColorStop(0, `rgb(${Math.round(190 * brightness)},${Math.round((88 - 28 * heat) * brightness)},${Math.round((24 - 8 * heat) * brightness)})`);
        ember.addColorStop(0.48, `rgb(${Math.round(255 * brightness)},${Math.round(emberGreen * brightness)},${Math.round(emberBlue * brightness)})`);
        ember.addColorStop(1, `rgb(${Math.round(143 * brightness)},${Math.round((63 - 22 * heat) * brightness)},${Math.round((20 - 7 * heat) * brightness)})`);
        ctx.fillStyle = ember;
        ctx.shadowColor = `rgba(255,75,22,${0.08 + 0.44 * activeHeat})`;
        ctx.shadowBlur = (3 + 9 * activeHeat) * (82 / 37.065);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.clip();
        const emberHeight = this.emberTopY - this.charTopY;
        const stickWidth = 82;
        const widthScale = stickWidth / 37.065;
        for (let index = 0; index < 26; index += 1) {
          const coalX = 0.96 * this.materialRandom(index, 260908 + 51);
          const coalY = 0.92 * this.materialRandom(index, 260908 + 52);
          const coalWidth = (0.055 + 0.12 * this.materialRandom(index, 260908 + 53)) * stickWidth;
          const coalHeight = (0.15 + 0.23 * this.materialRandom(index, 260908 + 54)) * emberHeight;
          const skew = this.materialRandom(index, 260908 + 55) - 0.5;
          const coalHeat = 0.62 + 0.38 * this.materialRandom(index, 260908 + 56);
          const coalRed = coalHeat + (1 - coalHeat) * activeHeat * 0.65;
          const x = -41 + coalX * stickWidth;
          const y = this.emberTopY - coalY * emberHeight;
          ctx.globalAlpha = 0.68 + 0.2 * coalHeat + 0.1 * heat;
          ctx.fillStyle = `rgb(${Math.round(255 * coalRed)},${Math.round(emberGreen * coalHeat)},${Math.round(emberBlue * coalHeat)})`;
          ctx.beginPath();
          ctx.moveTo(x - 0.48 * coalWidth, y + 0.12 * coalHeight);
          ctx.lineTo(x - 0.22 * coalWidth, y + 0.48 * coalHeight);
          ctx.lineTo(x + 0.25 * coalWidth, y + (0.26 + 0.2 * skew) * coalHeight);
          ctx.lineTo(x + 0.52 * coalWidth, y - 0.12 * coalHeight);
          ctx.lineTo(x + 0.18 * coalWidth, y - 0.47 * coalHeight);
          ctx.lineTo(x - 0.34 * coalWidth, y - 0.28 * coalHeight);
          ctx.closePath();
          ctx.fill();
          if (this.materialRandom(index, 260908 + 56) > 0.73) {
            ctx.globalAlpha = 0.3 + 0.35 * heat;
            ctx.strokeStyle = `rgb(244,${Math.round(emberGreen * coalHeat)},${Math.round(emberBlue * coalHeat)})`;
            ctx.lineWidth = 0.45 * widthScale;
            ctx.beginPath();
            ctx.moveTo(x - 0.2 * coalWidth, y + 0.13 * coalHeight);
            ctx.lineTo(x + 0.25 * coalWidth, y - 0.05 * coalHeight);
            ctx.stroke();
          }
        }
        for (let index = 0; index < 18; index += 1) {
          const threshold = index < 5 ? 0 : 0.04 + (index - 5) * 0.055;
          const visible = Math.max(0, Math.min(1, (activeHeat - threshold) / (1 - threshold)));
          const eased = visible * visible * (3 - 2 * visible);
          const flicker = (Math.sin(this.time * 1000 / 92 + index * 2.17) + 1) * 0.08 * activeHeat;
          const highlightGreen = Math.round(162 - 98 * heat);
          const highlightBlue = Math.round(45 - 24 * heat);
          ctx.globalAlpha = eased * (0.26 + 0.58 * activeHeat + flicker);
          ctx.fillStyle = index % 6 === 0 ? 'rgb(255,214,138)' : `rgb(255,${highlightGreen},${highlightBlue})`;
          const radius = (0.75 + index % 3 * 0.22) * widthScale;
          ctx.beginPath();
          ctx.ellipse(-41 + stickWidth * (0.09 + ((37 * index + 11) % 101) / 100 * 0.82),
            this.emberTopY - emberHeight * (0.14 + ((61 * index + 17) % 97) / 96 * 0.7),
            radius, radius * (0.58 + index % 2 * 0.16), -index * 0.47, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        const sideShade = ctx.createLinearGradient(-40, 0, 40, 0);
        sideShade.addColorStop(0, 'rgba(8,5,4,0.45)');
        sideShade.addColorStop(0.23, 'rgba(8,5,4,0)');
        sideShade.addColorStop(0.7, 'rgba(8,5,4,0)');
        sideShade.addColorStop(1, 'rgba(8,5,4,0.5)');
        ctx.fillStyle = sideShade;
        ctx.fillRect(-40, this.charTopY, 80, this.emberTopY - this.charTopY);
        ctx.restore();
        // Legacy drawBurningTip paints the char fold over the ember material.
        ctx.beginPath();
        for (let step = 0; step <= 16; step += 1) {
          const x = -40 + 80 * step / 16;
          const y = this.tipY - this.contourOffset(step, charBottomAmplitude, 7);
          if (step === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        for (let step = 16; step >= 0; step -= 1) {
          const x = -40 + 80 * step / 16;
          ctx.lineTo(x, this.charTopY - this.contourOffset(step, charTopAmplitude, 3));
        }
        ctx.closePath();
        const char = ctx.createLinearGradient(0, this.charTopY + charTopAmplitude,
          0, this.tipY - Math.max(2.6 * this.cssScale(), 0.1 * 82));
        char.addColorStop(0, '#221915');
        char.addColorStop(0.18, '#100c09');
        char.addColorStop(0.4, '#2c1e15');
        char.addColorStop(0.7, '#4e3423');
        char.addColorStop(1, '#63422d');
        ctx.fillStyle = char;
        ctx.fill();
      }
      if (ashHeight <= minimumAshHeight) return;
      // traceAsh extends its lower edge into the ember; the visible ash top
      // and smoke origin remain unchanged. This also covers antialiased seams.
      const widthScale = 82 / 37.065;
      const ashOverlap = Math.min(0.75 * widthScale, 0.25 * ashHeight);
      const ashBottomY = ashBaseY - ashOverlap;
      const halfWidth = 0.496 * 82;
      const sideStep = 4 * this.ashMaterialScale;
      const sideSegments = Math.min(24, Math.max(1, Math.ceil(ashHeight / sideStep)));
      const topAmplitude = Math.min(0.85 * widthScale, 0.17 * ashHeight);
      const topMaterial = this.ashMaterialEnd - ashHeight / this.ashMaterialScale;
      ctx.save();
      if (this.ashBreakAge < 0.08) {
        const elapsedMs = this.ashBreakAge * 1000;
        const wobble = 1 - this.ashBreakAge / 0.08;
        ctx.translate(0, ashBaseY);
        ctx.rotate(0.085 * Math.sin(elapsedMs / 7.5) * wobble);
        ctx.translate(1.5 * this.cssScale() * Math.sin(elapsedMs / 5.5) * wobble, -ashBaseY);
      }
      ctx.beginPath();
      ctx.moveTo(-halfWidth, ashBottomY);
      for (let segment = 1; segment <= sideSegments; segment += 1) {
        const y = Math.min(ashHeight, segment * sideStep);
        const material = this.ashMaterialEnd - y / this.ashMaterialScale;
        ctx.lineTo(-halfWidth + 0.9 * this.ashNoise(material, 260908 + 31) * widthScale, ashBaseY + y);
      }
      for (let step = 0; step <= 12; step += 1) {
        const x = -halfWidth + step * 2 * halfWidth / 12;
        const noise = this.ashNoise(topMaterial + 1.8 * step, 260908 + 32);
        ctx.lineTo(x, this.ashTopY - (noise - 0.5) * topAmplitude * 2);
      }
      for (let segment = sideSegments; segment >= 1; segment -= 1) {
        const y = Math.min(ashHeight, segment * sideStep);
        const material = this.ashMaterialEnd - y / this.ashMaterialScale;
        ctx.lineTo(halfWidth - 0.8 * this.ashNoise(material, 260908 + 33) * widthScale, ashBaseY + y);
      }
      ctx.lineTo(halfWidth, ashBottomY);
      ctx.closePath();
      const ashGradient = ctx.createLinearGradient(-40, 0, 40, 0);
      ashGradient.addColorStop(0, '#858a83');
      ashGradient.addColorStop(0.22, '#b2b7ae');
      ashGradient.addColorStop(0.52, '#a5aaa2');
      ashGradient.addColorStop(0.78, '#999f96');
      ashGradient.addColorStop(1, '#757c74');
      ctx.fillStyle = ashGradient;
      ctx.fill();
      ctx.clip();
      for (let row = 0; row < 55; row += 1) {
        const y = ashBaseY + row * 4.6;
        if (y > ashBaseY + ashHeight + 3) break;
        for (let column = 0; column < 7; column += 1) {
          const index = row * 7 + column;
          const x = -39 + (column + 0.85 * this.hash(index, 0)) * 78 / 7;
          const shade = this.hash(index, 1);
          const width = 3.5 + this.hash(index, 2) * 7.5;
          const height = 1.1 + this.hash(index, 3) * 2.5;
          const gray = Math.round(117 + 76 * shade);
          ctx.fillStyle = `rgba(${gray},${gray + 1},${gray - 3},${0.36 + 0.28 * shade})`;
          ctx.beginPath();
          ctx.moveTo(x - width * 0.5, y);
          ctx.lineTo(x - width * 0.2, y - height * 0.5);
          ctx.lineTo(x + width * 0.32, y + height * 0.25);
          ctx.lineTo(x + width * 0.5, y + height * 0.12);
          ctx.lineTo(x + width * 0.06, y + height * 0.46);
          ctx.closePath(); ctx.fill();
          if (this.hash(index, 4) > 0.6) {
            ctx.fillStyle = this.hash(index, 5) > 0.5 ? 'rgba(226,226,218,0.45)' : 'rgba(50,55,51,0.36)';
            ctx.fillRect(x + width * 0.2, y - height * 0.5, 1.2, 0.9);
          }
        }
      }
      ctx.strokeStyle = 'rgba(60,64,59,0.42)';
      ctx.lineWidth = 0.8;
      for (let index = 0; index < 3; index += 1) {
        ctx.beginPath();
        ctx.moveTo(-31 + index * 27, ashBaseY + 3 + index % 2 * 3);
        ctx.lineTo(-21 + index * 27, ashBaseY + 5 + index % 2 * 3);
        ctx.stroke();
      }
      ctx.restore();
    });
  }

  private hash(index: number, channel: number): number {
    const value = Math.sin((index + 1) * 127.71 + channel * 78.23 + 260908) * 43758.5453;
    return value - Math.floor(value);
  }

  /** CigaretteTipMaterial.traceAsh's stable material-coordinate noise. */
  private ashHash(index: number, seed: number): number {
    let value = Math.imul(index + 17, 0x45d9f3b) ^ Math.imul(seed + 31, 0x27d4eb2d);
    value ^= value >>> 16;
    value = Math.imul(value, 0x45d9f3b);
    return ((value ^ value >>> 16) >>> 0) / 0xffffffff;
  }

  private ashNoise(material: number, seed: number): number {
    const knot = Math.floor(material / 3.2);
    const fraction = material / 3.2 - knot;
    const blend = this.smoothstep(fraction);
    return this.ashHash(knot, seed) * (1 - blend) + this.ashHash(knot + 1, seed) * blend;
  }

  private smoothstep(value: number): number {
    const unit = Math.max(0, Math.min(1, value));
    return unit * unit * (3 - 2 * unit);
  }

  /** smoking-visual-policy's stable signed hash and four-knot noise. */
  private smokeHash(index: number, seed: number): number {
    let value = Math.imul(index + 1, 0x45d9f3b)
      ^ Math.imul(Math.round(4096 * seed) + 17, 0x27d4eb2d);
    value ^= value >>> 16;
    value = Math.imul(value, 0x45d9f3b);
    return ((value ^ value >>> 16) >>> 0) / 0xffffffff * 2 - 1;
  }

  private contourOffset(index: number, amplitude: number, salt: number): number {
    return this.smokeHash(index + 17 * salt,
      (Math.round(1000 * this.burnProgress) + 131 * salt) / 4096) * amplitude;
  }

  /** CigaretteTipMaterial's stable per-coal material hash. */
  private materialRandom(index: number, seed: number): number {
    let value = Math.imul(index + 17, 0x45d9f3b) ^ Math.imul(seed + 31, 0x27d4eb2d);
    value ^= value >>> 16;
    value = Math.imul(value, 0x45d9f3b);
    return ((value ^ value >>> 16) >>> 0) / 0xffffffff;
  }

  private smokeNoise(material: number, span: number, seed: number, channel: number): number {
    const knot = Math.floor(material / span);
    const unit = (material % span) / span;
    const sample = (offset: number): number => this.smokeHash(knot + offset + 101 * channel, seed + 0.137 * channel);
    const before = sample(-1), start = sample(0), end = sample(1), after = sample(2);
    const square = unit * unit;
    return Math.max(-1.12, Math.min(1.12, 0.5 * (2 * start + (-before + end) * unit
      + (2 * before - 5 * start + 4 * end - after) * square
      + (-before + 3 * start - 3 * end + after) * square * unit)));
  }

  private smokePointX(point: SmokePoint, trail: SmokeTrail, branch: boolean): number {
    const rise = point.age * 48; // CSS pixels; 1.92 design units per reference CSS pixel.
    const material = point.material;
    const low = this.smokeNoise(material, 210, trail.seed, 1);
    const high = this.smokeNoise(material, 120, trail.seed, 2);
    const direction = trail.slot % 2 ? 1 : -1;
    const offset = this.smoothstep(material / 48) * ((0.92 * low + 0.08 * high)
      * Math.min(34, 2 + 0.08 * material) + direction * Math.min(3.4, 0.008 * material));
    const anchor = this.smoothstep(rise / 64);
    const split = branch ? Math.sin(0.028 * material - 0.72 * point.age + 9 * trail.seed)
      * Math.min(12, 2.5 * point.age) * point.split : 0;
    return point.x + (offset * anchor + split) * 1.92;
  }

  private traceSmokeTrail(ctx: CanvasRenderingContext2D, trail: SmokeTrail, branch: boolean): void {
    const points = trail.points;
    let previousX = 0, previousY = 0;
    ctx.moveTo(this.smokePointX(points[0], trail, branch), points[0].y + points[0].age * 92);
    for (let pointIndex = 0; pointIndex < points.length; pointIndex += 1) {
      const point = points[pointIndex];
      const x = this.smokePointX(point, trail, branch);
      const y = point.y + point.age * 92;
      if (pointIndex > 0) ctx.quadraticCurveTo(previousX, previousY, (previousX + x) / 2, (previousY + y) / 2);
      previousX = x;
      previousY = y;
    }
    ctx.lineTo(previousX, previousY);
  }

  private renderTipSmoke(): void {
    if (!this.trails.some((trail) => trail.points.length > 1)) {
      if (this.smokeVisible) this.smoke.clear();
      this.smokeVisible = false;
      return;
    }
    this.smokeVisible = true;
    this.smoke.redraw((ctx) => {
      ctx.translate(0, -400);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let index = 0; index < this.trails.length; index += 1) {
        const trail = this.trails[index];
        if (trail.points.length < 2) continue;
        const oldest = trail.points[0];
        const newest = trail.points[trail.points.length - 1];
        const fade = Math.min(1, (6.8 - newest.age) / 1.2);
        const gradient = ctx.createLinearGradient(0, newest.y + newest.age * 92 + 12,
          0, oldest.y + oldest.age * 92 - 16);
        gradient.addColorStop(0, '#d9dad600');
        gradient.addColorStop(0.12, '#d9dad6b3');
        gradient.addColorStop(0.52, '#d9dad685');
        gradient.addColorStop(1, '#d9dad600');
        ctx.strokeStyle = gradient;
        ctx.beginPath();
        this.traceSmokeTrail(ctx, trail, false);
        if (trail.points.some((point) => point.split > 0)) this.traceSmokeTrail(ctx, trail, true);
        for (const layer of [{ width: 12, alpha: 0.065 }, { width: 5, alpha: 0.09 }, { width: 1.5, alpha: 0.08 }]) {
          ctx.globalAlpha = layer.alpha * fade;
          ctx.lineWidth = layer.width * 1.92;
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    });
  }

  private renderIgnition(snapshot: Readonly<SessionSnapshot>): void {
    if (snapshot.phase !== SessionPhase.LIGHTING || snapshot.phaseElapsedSeconds <= 0) {
      if (this.ignitionVisible) this.ignition.clear();
      this.ignitionVisible = false;
      return;
    }
    this.ignitionVisible = true;
    const progress = Math.min(1, snapshot.phaseElapsedSeconds / 0.68);
    const eased = 1 - Math.pow(1 - progress, 3);
    const flameHeight = 92 * (0.76 + 0.24 * eased);
    const flameWidth = 38 * (0.74 + 0.26 * eased);
    const flameAnchorX = -41 + 0.78 * 82;
    const bodyX = flameAnchorX + 0.72 * flameHeight;
    const baseY = this.tipY - flameHeight;
    const flicker = 2.8 * Math.sin(this.time * 13.5) + 1.7 * Math.sin(this.time * 7.2 + 1.2);
    this.ignition.redraw((ctx) => {
      ctx.translate(0, -400);
      const glow = ctx.createRadialGradient(flameAnchorX, this.tipY - 16, 2,
        flameAnchorX, this.tipY - 16, 65);
      glow.addColorStop(0, `rgba(255,126,37,${0.16 + progress * 0.16})`);
      glow.addColorStop(1, 'rgba(255,100,20,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(flameAnchorX, this.tipY - 16, 65, 0, Math.PI * 2); ctx.fill();
      const metal = ctx.createLinearGradient(bodyX - 25, 0, bodyX + 25, 0);
      metal.addColorStop(0, '#77746e'); metal.addColorStop(0.42, '#ded9ce'); metal.addColorStop(1, '#7c786f');
      ctx.fillStyle = metal;
      ctx.beginPath();
      ctx.moveTo(bodyX - 19, baseY - 66);
      ctx.lineTo(bodyX + 19, baseY - 66);
      ctx.quadraticCurveTo(bodyX + 25, baseY - 66, bodyX + 25, baseY - 60);
      ctx.lineTo(bodyX + 25, baseY - 10);
      ctx.quadraticCurveTo(bodyX + 25, baseY - 4, bodyX + 19, baseY - 4);
      ctx.lineTo(bodyX - 19, baseY - 4);
      ctx.quadraticCurveTo(bodyX - 25, baseY - 4, bodyX - 25, baseY - 10);
      ctx.lineTo(bodyX - 25, baseY - 60);
      ctx.quadraticCurveTo(bodyX - 25, baseY - 66, bodyX - 19, baseY - 66);
      ctx.fill();
      ctx.fillStyle = 'rgba(245,238,224,0.6)';
      ctx.fillRect(bodyX - 15, baseY - 59, 30, 2);
      ctx.shadowColor = 'rgba(255,113,33,0.72)';
      ctx.shadowBlur = 13 + 12 * progress;
      const flame = ctx.createLinearGradient(0, baseY, 0, this.tipY);
      flame.addColorStop(0, '#f04e18'); flame.addColorStop(0.54, '#ff8d29'); flame.addColorStop(1, '#fff1ac');
      ctx.fillStyle = flame;
      ctx.beginPath();
      ctx.moveTo(bodyX - 0.46 * flameWidth, baseY);
      ctx.bezierCurveTo(bodyX - 0.74 * flameWidth, baseY + 0.28 * flameHeight,
        flameAnchorX + 0.74 * flameWidth, this.tipY - 0.24 * flameHeight,
        flameAnchorX + flicker, this.tipY);
      ctx.bezierCurveTo(flameAnchorX + 1.06 * flameWidth, this.tipY - 0.3 * flameHeight,
        bodyX + 0.68 * flameWidth, baseY + 0.22 * flameHeight,
        bodyX + 0.46 * flameWidth, baseY);
      ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0;
      const core = ctx.createLinearGradient(0, baseY + 2, 0, this.tipY - 8);
      core.addColorStop(0, '#ff9226'); core.addColorStop(1, '#fff6cc');
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.moveTo(bodyX - 0.27 * flameWidth, baseY + 2);
      ctx.bezierCurveTo(bodyX - 0.38 * flameWidth, baseY + 0.38 * flameHeight,
        flameAnchorX + 0.35 * flameWidth, this.tipY - 0.21 * flameHeight,
        flameAnchorX + flicker, this.tipY - 8);
      ctx.bezierCurveTo(flameAnchorX + 0.62 * flameWidth, this.tipY - 0.36 * flameHeight,
        bodyX + 0.35 * flameWidth, baseY + 0.22 * flameHeight,
        bodyX + 0.27 * flameWidth, baseY + 2);
      ctx.closePath(); ctx.fill();
    });
  }

  private renderSparks(): void {
    const centerY = this.tipY + 100;
    const cssScale = this.cssScale();
    this.sparkGlow.node.setPosition(0, centerY);
    this.sparkGlow.redraw((ctx) => {
      for (const spark of this.sparkParticles) {
        const progress = Math.max(0, Math.min(1, spark.age / spark.lifetime));
        const heat = spark.heat;
        const glowGreen = Math.round(122 - 76 * heat);
        const glowBlue = Math.round(26 - 12 * heat);
        ctx.globalAlpha = 0.58 * spark.opacity * (1 - progress);
        ctx.shadowColor = `rgb(255,${glowGreen},${glowBlue})`;
        ctx.shadowBlur = (6 + 4 * heat) * cssScale;
        ctx.fillStyle = `rgb(255,${glowGreen},${glowBlue})`;
        ctx.beginPath();
        ctx.arc(spark.x, spark.y - centerY, spark.size * (1 - 0.55 * progress), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    });
    // Keep the bright core in Cocos Graphics so a Canvas upload issue cannot hide every spark.
    const g = this.sparks;
    g.clear();
    for (const spark of this.sparkParticles) {
      const progress = Math.max(0, Math.min(1, spark.age / spark.lifetime));
      const opacity = Math.max(0, Math.min(255, Math.round(255 * spark.opacity * (1 - progress))));
      const green = Math.round((progress < 0.45 ? 174 - 96 * spark.heat : 122 - 76 * spark.heat));
      const blue = Math.round((progress < 0.45 ? 60 - 32 * spark.heat : 26 - 12 * spark.heat));
      g.fillColor = color(`#ff${('0' + green.toString(16)).slice(-2)}${('0' + blue.toString(16)).slice(-2)}`, opacity);
      g.circle(spark.x, spark.y, spark.size * (1 - 0.55 * progress));
      g.fill();
    }
  }

  private renderDebris(): void {
    const g = this.debris;
    g.clear();
    const cssScale = this.cssScale();
    for (const f of this.fragments) {
      const fade = Math.max(0, 1 - f.age / f.lifetime);
      g.fillColor = color(f.kind === 'dust' ? '#8f8980' : '#aaa39a',
        Math.round(255 * f.opacity * fade));
      const radiusX = f.size * f.scale;
      const radiusY = Math.max(0.8 * cssScale, 0.46 * f.size) * f.scale;
      const cosine = Math.cos(f.rotation), sine = Math.sin(f.rotation);
      g.moveTo(f.x + cosine * radiusX, f.y + sine * radiusX);
      for (let step = 1; step <= 20; step += 1) {
        const angle = step / 20 * Math.PI * 2;
        const dx = Math.cos(angle) * radiusX, dy = Math.sin(angle) * radiusY;
        g.lineTo(f.x + dx * cosine - dy * sine, f.y + dx * sine + dy * cosine);
      }
      g.close(); g.fill();
    }
  }
}
