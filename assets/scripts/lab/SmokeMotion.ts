/** Pure geometry consumed by the renderers; no browser, Cocos nodes or visual tests. */
export function directionalMotion(dx: number, dy: number, durationMs: number): { vx: number; vy: number } | null {
  const distance = Math.hypot(dx, dy);
  if (![dx, dy, durationMs].every(Number.isFinite) || distance < 28 || dy < -0.92 * Math.abs(dx)) return null;
  const clamp = (value: number, low: number, high: number): number => Math.max(low, Math.min(high, value));
  const x = dx / distance, y = Math.max(dy / distance, 0.55), length = Math.hypot(x, y);
  const speed = clamp(76 + distance / clamp(durationMs, 80, 700) * 92 + 34 * clamp((distance - 28) / 180, 0, 1), 78, 168);
  return { vx: clamp(x / length * speed, -156, 156), vy: clamp(y / length * speed, 38, 164) };
}

export function ringPoint(shape: string, theta: number): { x: number; y: number } {
  const c = Math.cos(theta), s = Math.sin(theta);
  switch (shape) {
    case 'heart': return { x: 16 * s * s * s / 17,
      y: (13 * c - 5 * Math.cos(2 * theta) - 2 * Math.cos(3 * theta) - Math.cos(4 * theta)) / 17 };
    case 'square': { const scale = 1 / Math.max(Math.abs(c), Math.abs(s)); return { x: c * scale * 0.83, y: s * scale * 0.83 }; }
    case 'petal': { const r = 0.76 + 0.24 * Math.cos(5 * theta); return { x: c * r, y: s * r }; }
    case 'droplet': return { x: s * (0.7 - 0.3 * c), y: c };
    case 'cloud': { const r = 0.86 + 0.14 * Math.cos(6 * theta); return { x: c * r, y: s * r * 0.78 }; }
    case 'crescent': return { x: c * (s < 0 ? 0.55 : 1), y: s };
    case 'infinity': return { x: c / (1 + s * s), y: 1.6 * c * s / (1 + s * s) };
    case 'clover': { const r = 0.62 + 0.38 * Math.abs(Math.cos(2 * theta)); return { x: c * r, y: s * r }; }
    case 'butterfly': { const r = 0.5 + 0.5 * Math.abs(Math.cos(2 * theta)); return { x: c * r, y: s * r * 1.15 }; }
    case 'snowflake': { const r = 0.55 + 0.45 * Math.pow(Math.abs(Math.cos(3 * theta)), 4); return { x: c * r, y: s * r }; }
    case 'smiley': {
      const progress = theta / (Math.PI * 2);
      if (progress < 0.7) { const angle = progress / 0.7 * Math.PI * 2; return { x: Math.cos(angle), y: Math.sin(angle) }; }
      if (progress < 0.78) return { x: -0.35, y: 0.3 };
      if (progress < 0.86) return { x: 0.35, y: 0.3 };
      const angle = (progress - 0.86) / 0.14 * Math.PI;
      return { x: Math.cos(angle) * 0.55, y: -Math.sin(angle) * 0.45 - 0.12 };
    }
    case 'note': {
      const progress = theta / (Math.PI * 2);
      if (progress < 0.5) return { x: -0.25 + Math.cos(theta * 2) * 0.45, y: -0.55 + Math.sin(theta * 2) * 0.3 };
      if (progress < 0.82) return { x: 0.2, y: -0.55 + (progress - 0.5) / 0.32 * 1.5 };
      return { x: 0.2 + (progress - 0.82) / 0.18 * 0.65, y: 0.95 - (progress - 0.82) / 0.18 * 0.35 };
    }
    default: return { x: c, y: s };
  }
}

export function exhaleVelocity(style: string, index: number, count: number, vx: number, vy: number,
  unit: number): { vx: number; vy: number; x: number; y: number } {
  const side = index % 2 ? 1 : -1;
  switch (style) {
    case 'stream': return { vx: vx * 0.18, vy: vy * 1.75, x: 0, y: 0 };
    case 'cloud': return { vx: vx * 0.55, vy: vy * 0.58, x: (index % 3 - 1) * 30 * unit, y: (index % 4) * 9 * unit };
    case 'spiral': return { vx: Math.cos(index / count * Math.PI * 4) * 32 * unit, vy: vy * 0.9, x: side * 10 * unit, y: 0 };
    case 'ripple': return { vx: Math.cos(index / count * Math.PI * 6) * 52 * unit, vy: (22 + index % 4 * 15) * unit, x: 0, y: index % 4 * 14 * unit };
    case 'twin': return { vx: side * (38 * unit + Math.abs(vx) * 0.55), vy, x: side * 12 * unit, y: 0 };
    default: return { vx, vy, x: 0, y: 0 };
  }
}
