import {
  Button,
  Color,
  Graphics,
  HorizontalTextAlignment,
  Label,
  Node,
  UITransform,
  Vec3,
  VerticalTextAlignment,
  Widget,
} from 'cc';

export const DESIGN_WIDTH = 750;
export const DESIGN_HEIGHT = 1600;

export interface WidgetEdges {
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
  horizontalCenter?: number;
  verticalCenter?: number;
}

/** Runtime-created UI nodes need their own constraints; Canvas Widget is not inherited. */
export function alignWidget(node: Node, edges: WidgetEdges): Widget {
  const widget = node.addComponent(Widget);
  widget.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;
  if (edges.left !== undefined) { widget.isAlignLeft = true; widget.left = edges.left; }
  if (edges.right !== undefined) { widget.isAlignRight = true; widget.right = edges.right; }
  if (edges.top !== undefined) { widget.isAlignTop = true; widget.top = edges.top; }
  if (edges.bottom !== undefined) { widget.isAlignBottom = true; widget.bottom = edges.bottom; }
  if (edges.horizontalCenter !== undefined) {
    widget.isAlignHorizontalCenter = true;
    widget.horizontalCenter = edges.horizontalCenter;
  }
  if (edges.verticalCenter !== undefined) {
    widget.isAlignVerticalCenter = true;
    widget.verticalCenter = edges.verticalCenter;
  }
  widget.updateAlignment();
  return widget;
}

export const Palette = Object.freeze({
  background: '#090a09',
  surface: '#151513',
  surfaceWarm: '#211810',
  gold: '#d8c08a',
  goldMuted: '#74684d',
  orange: '#ff7a1a',
  green: '#173f37',
  paper: '#e7e0cf',
  ash: '#aaa89f',
  white: '#f4f0e6',
  muted: '#8b887f',
});

export function color(hex: string, alpha = 255): Color {
  const value = hex.replace('#', '');
  return new Color(
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
    alpha,
  );
}

export function createNode(
  name: string,
  parent: Node,
  width: number,
  height: number,
  x = 0,
  y = 0,
): Node {
  const node = new Node(name);
  parent.addChild(node);
  node.setPosition(new Vec3(x, y));
  node.addComponent(UITransform).setContentSize(width, height);
  return node;
}

export function createRect(
  name: string,
  parent: Node,
  width: number,
  height: number,
  fillHex: string,
  x = 0,
  y = 0,
  radius = 0,
  strokeHex?: string,
): Node {
  const node = createNode(name, parent, width, height, x, y);
  const graphics = node.addComponent(Graphics);
  graphics.fillColor = color(fillHex);
  if (radius > 0) graphics.roundRect(-width / 2, -height / 2, width, height, radius);
  else graphics.rect(-width / 2, -height / 2, width, height);
  graphics.fill();
  if (strokeHex) {
    graphics.strokeColor = color(strokeHex);
    graphics.lineWidth = 2;
    if (radius > 0) graphics.roundRect(-width / 2, -height / 2, width, height, radius);
    else graphics.rect(-width / 2, -height / 2, width, height);
    graphics.stroke();
  }
  return node;
}

export function createLabel(
  name: string,
  parent: Node,
  text: string,
  fontSize: number,
  fillHex: string,
  width: number,
  height: number,
  x = 0,
  y = 0,
  align: HorizontalTextAlignment = HorizontalTextAlignment.CENTER,
): Label {
  const node = createNode(name, parent, width, height, x, y);
  const label = node.addComponent(Label);
  label.string = text;
  label.fontSize = fontSize;
  label.lineHeight = Math.ceil(fontSize * 1.35);
  label.color = color(fillHex);
  label.horizontalAlign = align;
  label.verticalAlign = VerticalTextAlignment.CENTER;
  label.overflow = Label.Overflow.SHRINK;
  label.enableWrapText = true;
  return label;
}

export function createButton(
  name: string,
  parent: Node,
  text: string,
  width: number,
  height: number,
  fillHex: string,
  textHex: string,
  x: number,
  y: number,
  onClick: () => void,
  strokeHex?: string,
): Button {
  const node = createRect(name, parent, width, height, fillHex, x, y, height / 2, strokeHex);
  const button = node.addComponent(Button);
  button.transition = Button.Transition.SCALE;
  button.zoomScale = 0.96;
  createLabel('Label', node, text, Math.min(30, height * 0.38), textHex, width - 24, height - 8);
  node.on(Button.EventType.CLICK, onClick);
  return button;
}

export function formatDuration(totalSeconds: number): string {
  const whole = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(whole / 60);
  const seconds = whole % 60;
  const minuteText = minutes < 10 ? `0${minutes}` : `${minutes}`;
  const secondText = seconds < 10 ? `0${seconds}` : `${seconds}`;
  return `${minuteText}:${secondText}`;
}
