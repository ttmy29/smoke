import { Node } from 'cc';
import { CanvasTexture } from '../session/effects/CanvasTexture';
import { LOOSE_BOX_TIERS, LooseCigaretteItem } from './LooseBoxModel';

function round(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

/** Static CSS geometry/material port, no inventory logic or animation simulation. */
export function createLooseContainer(parent: Node, width: number, height: number,
  level: number, items: ReadonlyArray<LooseCigaretteItem>): CanvasTexture {
  const tier = LOOSE_BOX_TIERS[Math.max(0, Math.min(5, level - 1))];
  const material = new CanvasTexture('LooseContainerVisual', parent, Math.ceil(width), Math.ceil(height));
  const appearances: LooseCigaretteItem[] = [];
  for (const item of items) for (let i = 0; i < item.quantity; i++) appearances.push(item);
  material.redraw((ctx) => {
    ctx.scale(1, -1); ctx.translate(-width / 2, -height / 2);
    const palettes = [['#474b4c', '#817765', '#272a2a'], ['#474b4c', '#817765', '#272a2a'],
      ['#5d6162', '#9a9489', '#343738'], ['#858788', '#c0b8aa', '#55595a'],
      ['#82683f', '#c4a66a', '#544327'], ['#555d66', '#aebcca', '#303841']];
    const [metal, edge, face] = palettes[tier.level - 1];
    ctx.save(); ctx.filter = 'blur(6px)'; ctx.fillStyle = 'rgba(0,0,0,.62)';
    ctx.beginPath(); ctx.ellipse(width * .53, height * .93, width * .42, height * .065, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    const tube = tier.level === 1;
    const x = width * (tube ? .38 : .05), y = height * (tube ? .03 : .27);
    const w = width * (tube ? .24 : .90), h = height * (tube ? .94 : .68);
    if (!tube) {
      const lid = ctx.createLinearGradient(x, height * .05, x + w, height * .32);
      lid.addColorStop(0, '#8e8b7d'); lid.addColorStop(.38, metal); lid.addColorStop(1, metal);
      ctx.fillStyle = lid; ctx.strokeStyle = edge; ctx.lineWidth = 2;
      round(ctx, x, height * .05, w, height * .27, 3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#b89b6d'; ctx.fillRect(x + w * .09, height * .27, w * .82, 2);
    }
    ctx.fillStyle = tube ? '#202324' : '#131515'; ctx.strokeStyle = edge; ctx.lineWidth = 2;
    round(ctx, x, y, w, h, tube ? 17 : 2); ctx.fill(); ctx.stroke();
    const insetX = tube ? .20 : .07, rackW = w * (1 - insetX * 2);
    const rackY = y + h * (tube ? .06 : .09), rackH = h * (tube ? .86 : .61);
    const rowH = rackH / tier.rows.length;
    let slot = 0;
    tier.rows.forEach((columns, row) => {
      const gap = rackW * .025;
      const slotW = Math.min(rackW * .17, (rackW - gap * (columns - 1)) / columns);
      const rowW = slotW * columns + gap * (columns - 1);
      for (let col = 0; col < columns; col++, slot++) {
        const sx = x + w / 2 - rowW / 2 + col * (slotW + gap), sy = rackY + row * rowH;
        ctx.fillStyle = '#1a1c1c'; ctx.strokeStyle = '#3e4141'; ctx.lineWidth = 1;
        round(ctx, sx, sy, slotW, rowH * .90, 3); ctx.fill(); ctx.stroke();
        const item = appearances[slot];
        if (!item || item.filterVariant === 'shadowless') continue;
        const sw = slotW * .64, sh = rowH * .85, px = sx + slotW * .18, py = sy + rowH * .05;
        ctx.fillStyle = item.filterBase || '#b98555'; round(ctx, px, py, sw, sh, 2); ctx.fill();
        ctx.fillStyle = item.filterBand || '#5f3824'; ctx.fillRect(px, py + sh * .39, sw, sh * .04);
        ctx.fillStyle = '#e8e2d7'; ctx.fillRect(px, py + sh * .44, sw, sh * .56);
        ctx.fillStyle = item.filterInk || '#f0c27a'; ctx.fillRect(px + sw * .33, py + sh * .19, sw * .34, 1);
      }
    });
    const faceH = h * (tube ? .18 : .31);
    const shine = ctx.createLinearGradient(x, 0, x + w, 0);
    shine.addColorStop(0, face); shine.addColorStop(.35, metal); shine.addColorStop(1, face);
    ctx.fillStyle = shine; ctx.fillRect(x + 1, y + h - faceH, w - 2, faceH - 1);
    ctx.fillStyle = tier.level === 6 ? '#8cc3d4' : '#a0744e';
    ctx.fillRect(x + w * .08, y + h - faceH + faceH * .20, w * .84, 2);
    if (!tube) {
      ctx.strokeStyle = '#6f6659'; ctx.lineWidth = 2;
      ctx.strokeRect(x + w * .41, y + h - faceH * .34, w * .18, faceH * .16);
    }
  });
  return material;
}
