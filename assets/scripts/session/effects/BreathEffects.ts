import { Color, gfx, ImageAsset, Node, screen, Sprite, SpriteFrame, Texture2D, UITransform, view } from 'cc';
import { createNode, Palette } from '../../common/UiFactory';
import { SessionPhase, SessionSnapshot } from '../../domain/SessionModel';
import { CanvasTexture } from './CanvasTexture';

interface SmokeParticle {
  x: number; y: number; vx: number; vy: number;
  age: number; lifetime: number; size: number; scale: number; opacity: number;
  rotation: number; spin: number;
}

interface RingParticle {
  x: number; y: number; vx: number; vy: number;
  radius: number; growth: number; tube: number; opacity: number;
  age: number; lifetime: number; tilt: number; wobble: number;
  wave3: number; wave5: number; oval: number; ovalPhase: number; density: number;
}

/** Screen-space breathing halo and lower-origin human exhale. */
export class BreathEffects {
  private readonly halo: CanvasTexture;
  private readonly smokeRoot: Node;
  private readonly smokeFrame: SpriteFrame;
  private readonly smokeSprites: Sprite[] = [];
  private readonly ringCanvas: CanvasTexture;
  private particles: SmokeParticle[] = [];
  private rings: RingParticle[] = [];
  private previousPhase = SessionPhase.UNLIT;
  private burstNumber = 0;
  private ringSerial = 0;
  private haloVisible = false;
  private ringsVisible = false;
  private displayHeight = 0;

  private cssScale(): number {
    const frameWidth = screen.windowSize.width / (screen.devicePixelRatio || 1);
    return frameWidth > 0 ? view.getVisibleSize().width / frameWidth : 1.92;
  }

  private exhaleOriginY(): number {
    const height = view.getVisibleSize().height;
    const cssScale = this.cssScale();
    const inset = Math.min(170 * cssScale, Math.max(120 * cssScale, 0.16 * height));
    const fromTop = Math.max(0.68 * height, Math.min(0.78 * height, height - inset));
    return height / 2 - fromTop;
  }

  constructor(parent: Node) {
    this.halo = new CanvasTexture('InhaleHalo', parent, 750, 1600);
    this.smokeRoot = createNode('HumanExhale', parent, 750, 1600);
    this.smokeFrame = this.makeSmokeFrame();
    this.ringCanvas = new CanvasTexture('SmokeRings', parent, 750, 1600);
    this.ensureViewport();
  }

  private ensureViewport(): void {
    const height = Math.max(1, Math.ceil(view.getVisibleSize().height));
    if (height === this.displayHeight) return;
    this.displayHeight = height;
    this.halo.resize(750, height);
    this.ringCanvas.resize(750, height);
    this.smokeRoot.getComponent(UITransform)?.setContentSize(750, height);
  }

  public reset(): void {
    this.particles = [];
    this.rings = [];
    this.previousPhase = SessionPhase.UNLIT;
    this.burstNumber = 0;
    this.ringSerial = 0;
    this.haloVisible = false;
    this.ringsVisible = false;
    this.halo.clear();
    this.ringCanvas.clear();
    for (const sprite of this.smokeSprites) sprite.node.active = false;
  }

  public update(deltaTime: number, snapshot: Readonly<SessionSnapshot>): void {
    this.ensureViewport();
    const delta = Math.max(0, Math.min(deltaTime, 0.05));
    if (snapshot.phase === SessionPhase.EXHALING && this.previousPhase !== SessionPhase.EXHALING) {
      this.emitExhale(Math.min(1, snapshot.lastInhaleSeconds / 3));
    }
    this.previousPhase = snapshot.phase;
    const cssScale = this.cssScale();
    for (const p of this.particles) {
      p.age += delta;
      p.vx *= Math.pow(0.985, 60 * delta);
      p.vy += 4 * cssScale * delta;
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.scale += 0.62 * delta;
      p.rotation += p.spin * delta;
      p.opacity *= 1 - 0.42 * delta;
    }
    this.particles = this.particles.filter((p) => p.age < p.lifetime && p.opacity > 0.008);
    for (const ring of this.rings) {
      ring.age += delta;
      ring.radius += ring.growth * delta;
      ring.growth *= Math.max(0.7, 1 - 0.44 * delta);
      ring.tube = Math.min(18 * 1.92, ring.tube + (2 + 0.018 * ring.radius / 1.92) * 1.92 * delta);
      ring.vy += 4.2 * 1.92 * delta;
      ring.x += (ring.vx + 7 * 1.92 * Math.sin(1.55 * ring.age + ring.wobble)) * delta;
      ring.y += ring.vy * delta;
    }
    this.rings = this.rings.filter((ring) => ring.age < ring.lifetime);
    this.render(snapshot);
  }

  /** Old emitRing default circle parameters, converted from CSS pixels to design units. */
  public emitRing(strength: number): void {
    const serial = this.ringSerial++;
    const random = (channel: number): number => {
      const value = Math.sin((serial + 1) * 193.17 + channel * 71.19) * 43758.5453;
      return value - Math.floor(value);
    };
    const between = (a: number, b: number, channel: number): number => a + (b - a) * random(channel);
    const s = Math.max(0, Math.min(1, strength));
    this.rings.push({
      x: between(-4, 4, 0) * 1.92,
      y: this.exhaleOriginY() + 34 * 1.92,
      vx: between(-12, 12, 1) * 1.92,
      vy: (42 + 24 * s) * between(0.9, 1.14, 2) * 1.92,
      radius: (12 + 8 * s) * between(0.86, 1.18, 3) * 1.92,
      growth: (56 + 42 * s) * between(0.9, 1.2, 4) * 1.92,
      tube: (4.8 + 3.2 * s) * between(0.9, 1.18, 5) * 1.92,
      opacity: Math.min(1, (0.76 + 0.2 * s) * between(0.94, 1.08, 6)),
      age: 0,
      lifetime: between(4.4, 5.8, 7),
      tilt: between(0.4, 0.56, 8),
      wobble: random(9) * Math.PI * 2,
      wave3: between(0.024, 0.062, 10),
      wave5: between(0.012, 0.04, 11),
      oval: between(0, 0.08, 12),
      ovalPhase: between(0, Math.PI, 13),
      density: between(1.04, 1.46, 14),
    });
    this.renderRings();
  }

  private emitExhale(strength: number): void {
    const cssScale = this.cssScale();
    const scaled = Math.pow(strength, 1.16);
    const count = Math.max(4, Math.floor(10 + 48 * strength));
    const spreadX = 18 + 54 * scaled;
    const spreadY = 12 + 28 * scaled;
    const burst = this.burstNumber++;
    const random = (index: number, channel: number): number => {
      const value = Math.sin((burst + 1) * 271.13 + index * 127.71 + channel * 78.23) * 43758.5453;
      return value - Math.floor(value);
    };
    for (let index = 0; index < count; index += 1) {
      const size = 12 + 10 * strength + random(index, 4) * (18 + 46 * scaled);
      this.particles.push({
        x: (random(index, 0) - 0.5) * spreadX * cssScale,
        y: this.exhaleOriginY() + (random(index, 1) - 0.5) * spreadY * cssScale,
        vx: (random(index, 2) - 0.5) * (20 + 132 * scaled) * cssScale,
        vy: (18 + random(index, 3) * (28 + 88 * scaled)) * cssScale,
        age: 0,
        lifetime: 1.35 + random(index, 5) * (0.65 + 2.1 * scaled),
        size: size * cssScale,
        scale: 0.38,
        opacity: 0.27 + random(index, 6) * (0.22 + 0.2 * strength),
        rotation: random(index, 7) * Math.PI * 2,
        spin: (random(index, 8) - 0.5) * 0.22,
      });
    }
    if (this.particles.length > 220) this.particles.splice(0, this.particles.length - 220);
  }

  private render(snapshot: Readonly<SessionSnapshot>): void {
    if (snapshot.phase === SessionPhase.INHALING) {
      this.drawHalo(Palette.orange, Math.min(1, snapshot.phaseElapsedSeconds / 3));
    } else if (snapshot.phase === SessionPhase.EXHALING) {
      const remaining = 1 - Math.min(1, snapshot.phaseElapsedSeconds / Math.max(0.01, snapshot.lastInhaleSeconds));
      this.drawHalo('#eef0ed', Math.min(1, snapshot.lastInhaleSeconds / 3) * remaining);
    } else if (this.haloVisible) {
      this.halo.clear();
      this.haloVisible = false;
    }
    for (let index = 0; index < this.particles.length; index += 1) {
      const p = this.particles[index];
      const sprite = this.smokeSprites[index] ?? this.addSmokeSprite();
      const radius = Math.max(3 * this.cssScale(), p.size * p.scale);
      const intensity = Math.min(0.94, 1.05 * p.opacity);
      sprite.node.active = true;
      sprite.node.setPosition(p.x, p.y);
      sprite.node.setScale(2 * radius / 96, 1.56 * radius / 96);
      sprite.node.angle = -0.08 * p.rotation * 180 / Math.PI;
      sprite.color = new Color(
        Math.round(217 * intensity), Math.round(218 * intensity),
        Math.round(214 * intensity), 255,
      );
    }
    for (let index = this.particles.length; index < this.smokeSprites.length; index += 1) {
      this.smokeSprites[index].node.active = false;
    }
    this.renderRings();
  }

  private renderRings(): void {
    if (this.rings.length === 0) {
      if (this.ringsVisible) this.ringCanvas.clear();
      this.ringsVisible = false;
      return;
    }
    this.ringsVisible = true;
    this.ringCanvas.redraw((ctx) => {
      for (const ring of this.rings) {
        const progress = Math.min(1, ring.age / ring.lifetime);
        const alpha = ring.opacity * Math.pow(1 - progress, 0.52);
        const outer = ring.radius + ring.tube * (2.1 + 1.35 * progress);
        ctx.save();
        ctx.translate(ring.x, ring.y);
        ctx.scale(1, ring.tilt);
        const haze = ctx.createRadialGradient(0, 0, Math.max(0, ring.radius - 2 * ring.tube), 0, 0, outer);
        haze.addColorStop(0, 'rgba(184,212,220,0)');
        haze.addColorStop(0.56, `rgba(184,212,220,${alpha * (0.05 + 0.16 * progress)})`);
        haze.addColorStop(1, 'rgba(184,212,220,0)');
        ctx.fillStyle = haze;
        ctx.beginPath(); ctx.arc(0, 0, outer, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        for (let index = 0; index < 40; index += 1) {
          const theta = index / 40 * Math.PI * 2;
          const deformation = 1 + Math.sin(3 * theta + ring.wobble) * ring.wave3
            + Math.sin(5 * theta - 0.7 * ring.wobble) * ring.wave5
            + Math.cos(2 * theta + ring.ovalPhase) * ring.oval;
          const x = ring.x + Math.cos(theta) * ring.radius * deformation;
          const y = ring.y + Math.sin(theta) * ring.radius * ring.tilt * deformation;
          const depth = 0.5 * Math.sin(theta) + 0.5;
          const flicker = 0.5 * Math.sin(2.17 * index + ring.wobble) + 0.5;
          const puff = ring.tube * (1.72 + 1.12 * progress)
            * (0.86 + 0.28 * depth) * (0.94 + 0.12 * flicker);
          const gradient = ctx.createRadialGradient(x, y, 0, x, y, puff);
          gradient.addColorStop(0, `rgba(184,212,220,${Math.min(0.92, alpha * (0.38 - 0.08 * progress) * ring.density * (0.72 + 0.28 * depth))})`);
          gradient.addColorStop(0.48, `rgba(184,212,220,${alpha * (0.14 + 0.08 * flicker) * ring.density * (1 - 0.32 * progress)})`);
          gradient.addColorStop(1, 'rgba(184,212,220,0)');
          ctx.fillStyle = gradient;
          ctx.beginPath(); ctx.arc(x, y, puff, 0, Math.PI * 2); ctx.fill();
        }
      }
    });
  }

  private drawHalo(hex: string, progress: number): void {
    if (progress <= 0) {
      if (this.haloVisible) this.halo.clear();
      this.haloVisible = false;
      return;
    }
    this.haloVisible = true;
    const height = view.getVisibleSize().height;
    const centerY = 0.03 * height;
    const radius = Math.min(0.36 * 750, 0.19 * height) * progress;
    this.halo.redraw((ctx) => {
      const rgb = hex.startsWith('#') ? hex.slice(1) : 'ff7a1a';
      const red = parseInt(rgb.slice(0, 2), 16);
      const green = parseInt(rgb.slice(2, 4), 16);
      const blue = parseInt(rgb.slice(4, 6), 16);
      const gradient = ctx.createRadialGradient(0, centerY, radius * 0.08, 0, centerY, radius);
      gradient.addColorStop(0, `rgba(${red},${green},${blue},0)`);
      gradient.addColorStop(0.55, `rgba(${red},${green},${blue},${0.055 * progress})`);
      gradient.addColorStop(1, `rgba(${red},${green},${blue},0)`);
      ctx.fillStyle = gradient;
      ctx.beginPath(); ctx.arc(0, centerY, radius, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(${red},${green},${blue},${(138 + 66 * progress) / 255})`;
      ctx.lineWidth = 2.7 + 1.5 * progress;
      ctx.beginPath(); ctx.arc(0, centerY, radius, 0, Math.PI * 2); ctx.stroke();
      if (radius > 24) {
        ctx.strokeStyle = `rgba(${red},${green},${blue},${(52 + 38 * progress) / 255})`;
        ctx.lineWidth = 1.9;
        ctx.beginPath(); ctx.arc(0, centerY, radius - 23, 0, Math.PI * 2); ctx.stroke();
      }
    });
  }

  private addSmokeSprite(): Sprite {
    const node = createNode(`SmokePuff${this.smokeSprites.length}`, this.smokeRoot, 96, 96);
    const sprite = node.addComponent(Sprite);
    sprite.spriteFrame = this.smokeFrame;
    // An opaque black-to-white intensity texture plus these factors implements
    // screen: out = source + destination * (1 - source).
    const blendSprite = sprite as Sprite & {
      _srcBlendFactor: gfx.BlendFactor;
      _dstBlendFactor: gfx.BlendFactor;
    };
    blendSprite._srcBlendFactor = gfx.BlendFactor.ONE;
    blendSprite._dstBlendFactor = gfx.BlendFactor.ONE_MINUS_SRC_COLOR;
    if (sprite.getRenderMaterial(0)) sprite._updateBlendFunc();
    this.smokeSprites.push(sprite);
    return sprite;
  }

  private makeSmokeFrame(): SpriteFrame {
    const canvas = document.createElement('canvas');
    canvas.width = 96; canvas.height = 96;
    const ctx = canvas.getContext('2d')!;
    for (const puff of [{ x: 39, y: 49, r: 34, a: 0.64 }, { x: 57, y: 43, r: 31, a: 0.56 }, { x: 51, y: 58, r: 29, a: 0.46 }]) {
      const gradient = ctx.createRadialGradient(puff.x, puff.y, 1, puff.x, puff.y, puff.r);
      gradient.addColorStop(0, `rgba(255,255,255,${puff.a})`);
      gradient.addColorStop(0.5, `rgba(255,255,255,${puff.a * 0.42})`);
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(puff.x - puff.r, puff.y - puff.r, puff.r * 2, puff.r * 2);
    }
    // Encode the old offscreen alpha mask into RGB so a screen-blended Sprite
    // has zero source color outside the smoke, without a dark transparent quad.
    const pixels = ctx.getImageData(0, 0, 96, 96);
    for (let index = 0; index < pixels.data.length; index += 4) {
      pixels.data[index] = pixels.data[index + 3];
      pixels.data[index + 1] = pixels.data[index + 3];
      pixels.data[index + 2] = pixels.data[index + 3];
      pixels.data[index + 3] = 255;
    }
    ctx.putImageData(pixels, 0, 0);
    const texture = new Texture2D();
    texture.image = new ImageAsset(canvas);
    const frame = new SpriteFrame();
    frame.texture = texture;
    return frame;
  }
}
