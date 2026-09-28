import { ImageAsset, Node, Sprite, SpriteFrame, Texture2D, UITransform } from 'cc';
import { createNode } from '../../common/UiFactory';

/** Browser-only Canvas 2D material bridge for effects that Graphics cannot paint directly. */
export class CanvasTexture {
  public readonly node: Node;
  public readonly context: CanvasRenderingContext2D;
  private readonly canvas: HTMLCanvasElement;
  private readonly imageAsset: ImageAsset;
  private readonly texture: Texture2D;
  private readonly frame: SpriteFrame;

  constructor(name: string, parent: Node, width: number, height: number) {
    this.node = createNode(name, parent, width, height);
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    const context = this.canvas.getContext('2d');
    if (!context) throw new Error(`${name}: Canvas 2D unavailable`);
    this.context = context;
    this.texture = new Texture2D();
    this.imageAsset = new ImageAsset(this.canvas);
    this.texture.image = this.imageAsset;
    this.frame = new SpriteFrame();
    this.frame.texture = this.texture;
    const sprite = this.node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.spriteFrame = this.frame;
  }

  /** Draw in Cocos-style local coordinates: origin at center, positive Y upwards. */
  public resize(width: number, height: number): void {
    const nextWidth = Math.max(1, Math.ceil(width));
    const nextHeight = Math.max(1, Math.ceil(height));
    if (this.canvas.width === nextWidth && this.canvas.height === nextHeight) return;
    this.canvas.width = nextWidth;
    this.canvas.height = nextHeight;
    this.node.getComponent(UITransform)?.setContentSize(nextWidth, nextHeight);
    this.imageAsset.reset(this.canvas);
    this.texture.image = this.imageAsset;
  }

  public redraw(paint: (ctx: CanvasRenderingContext2D) => void): void {
    const ctx = this.context;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.save();
    ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
    ctx.scale(1, -1);
    paint(ctx);
    ctx.restore();
    this.texture.uploadData(this.canvas);
  }

  public clear(): void {
    this.redraw(() => undefined);
  }

  /** Call before removing a short-lived effect node; runtime-created assets are not shared. */
  public dispose(): void {
    const sprite = this.node.getComponent(Sprite);
    if (sprite) sprite.spriteFrame = null;
    this.frame.destroy();
    this.texture.destroy();
    this.imageAsset.destroy();
  }
}
