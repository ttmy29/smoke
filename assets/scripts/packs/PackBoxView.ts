import { Graphics, Label, Mask, Node, Sprite, SpriteFrame } from 'cc';
import { color, createLabel, createNode, createRect } from '../common/UiFactory';
import { CanvasTexture } from '../session/effects/CanvasTexture';
import { PackCatalogItem } from './PackCatalog';

/** Same cropped material construction used by the interactive home box. */
export function createPackSkin(parent: Node, width: number, height: number,
  widthScale: number, heightScale: number, name: string, align: 'top' | 'bottom',
  horizontal: 'left' | 'right' = 'left'): Sprite {
  const viewport = createNode(`${name}Viewport`, parent, width, height);
  const mask = viewport.addComponent(Mask);
  mask.type = Mask.Type.GRAPHICS_STENCIL;
  const stencil = mask.subComp as Graphics;
  stencil.rect(-width / 2, -height / 2, width, height); stencil.fill();
  const skinWidth = width * widthScale;
  const skinHeight = height * heightScale;
  const x = (skinWidth - width) / 2 * (horizontal === 'left' ? 1 : -1);
  const y = (skinHeight - height) / 2 * (align === 'bottom' ? 1 : -1);
  const sprite = createNode(name, viewport, skinWidth, skinHeight, x, y).addComponent(Sprite);
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  return sprite;
}

export function applyPackCopyShadow(label: Label): void {
  label.enableShadow = true;
  label.shadowColor = color('#f0dfb5', 185);
  label.shadowOffset.set(0, -2);
  label.shadowBlur = 5;
}

/** Closed catalogue mode from pack-box.wxss; dimensions are NOT a scaled home layout. */
export class PackBoxView {
  private readonly skins: Sprite[] = [];
  private root: Node | null = null;

  constructor(parent: Node, item: PackCatalogItem, visualWidth: number, height: number,
    textures: CanvasTexture[], mode: 'catalog' | 'home' = 'catalog') {
    // pack-box: width 86%, height 100%. Shadowless deliberately has opacity:0.
    if (item.id === 'shadowless') return;
    const national = item.id === 'zuguo';
    // measureDepth: h=min(frame.height, frame.width/.7), w=.602h, halfDepth=.1w.
    if (national) height = Math.min(height, visualWidth / 0.7);
    const width = national ? height * 0.602 : visualWidth * 0.86;
    const root = createNode('ClosedPack', parent, width, height);
    this.root = root;
    if (national) root.setRotationFromEuler(0, 23, 0);
    const top = (fraction: number): number => height * (0.5 - fraction);
    const bodyTop = national ? 0.24 : 0.30;
    const bodyWidth = width * 0.84;
    const bodyHeight = height * (0.96 - bodyTop);
    const bodyX = width * 0.05;
    const bodyY = (top(bodyTop) + top(0.96)) / 2;
    const sideWidth = width * (national ? 0.2 : 0.08);
    const shadow = new CanvasTexture('PackShadow', root, Math.ceil(width * 1.15), Math.ceil(height * 0.18));
    textures.push(shadow);
    shadow.node.setPosition(0, top(0.96) - height * 0.015);
    shadow.redraw((ctx) => {
      ctx.filter = 'blur(8px)'; ctx.fillStyle = 'rgba(0,0,0,.66)';
      ctx.beginPath(); ctx.ellipse(0, 0, width * 0.44, height * 0.035, 0, 0, Math.PI * 2); ctx.fill();
    });
    const side = createRect('PackSide', root, sideWidth, bodyHeight, national ? '#703236' : '#111a1a',
      -width * (national ? 0.37 : 0.41), bodyY, 0, '#4a4a42');
    if (national) side.setRotationFromEuler(0, -90, 0);
    if (!national) this.skins.push(createPackSkin(side, sideWidth - 4, bodyHeight - 4,
      5.6, 1.36364, 'SideSkin', 'bottom', 'right'));
    this.shade(side, sideWidth - 4, bodyHeight - 4, textures);
    const front = createRect('PackFront', root, bodyWidth, bodyHeight, item.secondary,
      bodyX, bodyY, 0, '#70664f');
    if (national) front.setPosition(bodyX, bodyY, width * 0.1);
    this.skins.push(createPackSkin(front, bodyWidth - 4, bodyHeight - 4,
      national ? 1 : 1.22, national ? 1.25 : 1.36364, 'BodySkin', 'bottom'));

    const lidHeight = height * (bodyTop - 0.06);
    const lid = createNode('ClosedLid', root, width, lidHeight, 0, top(0.06) - lidHeight / 2);
    const lidSide = createRect('LidSide', lid, sideWidth, lidHeight, national ? '#703236' : '#182020',
      -width * (national ? 0.37 : 0.41));
    if (national) lidSide.setRotationFromEuler(0, -90, 0);
    if (!national) this.skins.push(createPackSkin(lidSide, sideWidth - 4, lidHeight - 4,
      5.6, 3.75, 'LidSideSkin', 'top', 'right'));
    this.shade(lidSide, sideWidth - 4, lidHeight - 4, textures);
    const lidFront = createRect('LidFrame', lid, bodyWidth, lidHeight, item.accent, bodyX, 0, 4, '#70664f');
    if (national) lidFront.setPosition(bodyX, 0, width * 0.1);
    this.skins.push(createPackSkin(lidFront, bodyWidth - 4, lidHeight - 4,
      national ? 1 : 1.22, national ? 5 : 3.75, 'LidSkin', 'top'));
    if (national) return; // Artwork contains national identity; old CSS hides copy layers.

    const lightInk = ['flowing-gold', 'night-voyage'].indexOf(item.id) >= 0;
    const ink = item.id === 'red-equator' ? '#5b1d18' : lightInk ? '#f0e8dc' : item.secondary;
    if (mode === 'home') {
      const unit = width / 330;
      const name = createLabel('PackName', front, item.name, 46 * unit, ink,
        bodyWidth * .76, 62 * unit, -bodyWidth * .055, bodyHeight * .285);
      name.isBold = true;
      const code = createLabel('PackCode', front, item.code, 17 * unit, ink,
        bodyWidth * .76, 30 * unit, -bodyWidth * .055, bodyHeight * .205);
      const footer = createLabel('PackFooterCode', front, item.code, 15 * unit, ink,
        bodyWidth * .55, 28 * unit, -bodyWidth * .18, -bodyHeight * .405);
      for (const label of [name, code, footer]) applyPackCopyShadow(label);
      createRect('PackSignal', front, 8 * unit, 8 * unit, item.id === 'flowing-gold' ? '#e5bd72' : '#ff7a1a',
        bodyWidth * .37, -bodyHeight * .405, 4 * unit);
      createLabel('LidCode', lidFront, item.code, 18 * unit, ink, bodyWidth - 30 * unit, 36 * unit);
      return;
    }
    const identityX = -bodyWidth / 2 + bodyWidth * 0.09 + 63;
    const copyTop = bodyHeight / 2 - bodyHeight * 0.11;
    const name = createLabel('PackName', front, item.name, 34, ink, 126, 40, identityX, copyTop - 20);
    name.isBold = true;
    const code = createLabel('PackCode', front, item.code, 13, ink, 126, 20, identityX, copyTop - 55);
    const footer = createLabel('PackFooterCode', front, item.code, 13, ink,
      bodyWidth * 0.60, 22, -bodyWidth * 0.11, -bodyHeight / 2 + bodyHeight * 0.07 + 11);
    for (const label of [name, code, footer]) applyPackCopyShadow(label);
    createRect('PackSignal', front, 6, 6, item.id === 'flowing-gold' ? '#e5bd72' : '#ff7a1a',
      bodyWidth * 0.38, -bodyHeight / 2 + bodyHeight * 0.07 + 11, 3);
    const smallCode = ['night-voyage', 'slow-tide', 'zero-hour'].indexOf(item.id) >= 0;
    const lidCode = createLabel('LidCode', lidFront, item.code, smallCode ? 17 : 20,
      lightInk ? '#eee4d2' : item.secondary, bodyWidth * 0.82, 30);
    if (lightInk) applyPackCopyShadow(lidCode);
  }

  public setFrame(frame: SpriteFrame): void {
    for (const sprite of this.skins) if (sprite.isValid) sprite.spriteFrame = frame;
  }

  public setLocked(locked: boolean): void {
    for (const sprite of this.skins) { sprite.grayscale = locked; sprite.color = color(locked ? '#6b6b6b' : '#ffffff'); }
    const visit = (node: Node): void => {
      const label = node.getComponent(Label);
      if (locked && label) { label.color = color('#777777'); label.enableShadow = false; }
      for (const child of node.children) visit(child);
    };
    if (this.root) visit(this.root);
  }

  private shade(parent: Node, width: number, height: number, textures: CanvasTexture[]): void {
    const material = new CanvasTexture('SideShade', parent, Math.ceil(width), Math.ceil(height));
    textures.push(material);
    material.redraw((ctx) => {
      const gradient = ctx.createLinearGradient(-width / 2, 0, width / 2, 0);
      gradient.addColorStop(0, 'rgba(3,8,8,.58)'); gradient.addColorStop(1, 'rgba(3,8,8,.24)');
      ctx.fillStyle = gradient; ctx.fillRect(-width / 2, -height / 2, width, height);
    });
  }
}
