// Label ownership, source-state copy and binding checks only; no drawing or visual simulation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('C:/ProgramData/cocos/editors/Creator/3.8.6/resources/resources/3d/engine/node_modules/typescript');
const root = path.resolve(__dirname, '..');
function load(file, imports = {}) {
  const exports = {}, filename = path.join(root, 'assets/scripts', file);
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2018, experimentalDecorators: true,
  } }).outputText, { exports, require: name => imports[name] || {}, console: { warn() {} }, Map, Set }, { filename });
  return exports;
}
class Label {
  constructor() {
    this.enabled = true; this.isValid = true; this.color = new Color(); this.font = null;
    this.fontFamily = 'Arial'; this.fontSize = 80; this.lineHeight = 80; this.useSystemFont = true;
    this.horizontalAlign = 1; this.verticalAlign = 1; this.isBold = true;
  }
  updateRenderData() {}
}
Label.Overflow = { SHRINK: 2 };
class UITransform {
  constructor() { this.anchorPoint = { x: .5, y: .5 }; }
  setContentSize(width, height) { this.width = width; this.height = height; this.contentSize = { width, height }; }
  setAnchorPoint(x, y) { this.anchorPoint = { x, y }; }
}
class Node {
  constructor(name) { this.name = name; this.active = true; this.isValid = true; this.layer = 33554432; this.children = []; this.components = new Map(); }
  getChildByName(name) { return this.children.find(child => child.name === name) || null; }
  getComponent(Type) { return this.components.get(Type) || null; }
  addComponent(Type) { const value = new Type(); value.node = this; this.components.set(Type, value); return value; }
  setPosition(x, y) { this.position = { x, y }; }
  destroy() { this.isValid = false; }
}
class Color {
  constructor(r = 255, g = 255, b = 255, a = 255) { Object.assign(this, { r, g, b, a }); }
  toCSS() { return `rgba(${this.r},${this.g},${this.b},${this.a / 255})`; }
}
const decorator = () => {};
const cc = { _decorator: { ccclass: () => Type => Type, property: decorator, requireComponent: () => decorator,
  disallowMultiple: decorator, menu: () => decorator }, Component: class {}, Label, UITransform, Node, Color,
  Mask: class {}, UIOpacity: class {}, Enum: value => value };
const catalog = load('packs/PackCatalog.ts');
const model = load('home/HomePackBrowserModel.ts', { '../packs/PackCatalog': catalog });
const { TextSweep } = load('common/TextSweep.ts', { cc, './UiFactory': {
  createNode: (name, parent, width, height) => {
    const node = new Node(name); parent.children.push(node); node.addComponent(UITransform).setContentSize(width, height); return node;
  },
} });
const { HomeController } = load('home/HomeController.ts', { cc, './HomePackBrowserModel': model,
  '../common/TextSweep': { TextSweep }, '../persistence/PackStore': { countAvailableSlots: pack => pack.slots.filter(slot => slot === 'available').length } });

const controller = new HomeController(); controller.startButtonLabel = {};
controller.prefabStartLabel = {}; controller.pack = { slots: ['available'] };
controller.refreshMainButtonText(); assert.equal(controller.prefabStartLabel.string, '来一根');
controller.pack = { slots: ['empty'] };
controller.refreshMainButtonText(); assert.equal(controller.prefabStartLabel.string, '补一盒');
controller.packBrowser = { isLife: false, animating: false, current: { pack: catalog.PACK_CATALOG[2], state: { unlocked: false } } };
controller.refreshMainButtonText(); assert.equal(controller.prefabStartLabel.string, '查看解锁条件');
controller.packBrowser.current.pack = catalog.PACK_CATALOG[1];
controller.refreshMainButtonText(); assert.equal(controller.prefabStartLabel.string, '用 2 张烟票解锁');
controller.lidAnimating = true; controller.refreshMainButtonText(); assert.equal(controller.prefabStartLabel.string, '正在抽出');
controller.lidAnimating = false; controller.entryMode = true;
controller.refreshMainButtonText(); assert.equal(controller.prefabStartLabel.string, '正在抽出');
controller.entryMode = false; controller.packBrowser = null; controller.pack = null;
controller.refreshMainButtonText(); assert.equal(controller.prefabStartLabel.string, '来一根', 'failed reads cannot fabricate an empty pack');
assert.equal(controller.prefabStartLabel.string, controller.startButtonLabel.string);

// Read the actual prefab's requested path and dimensions; bind the authored Label itself.
const serialized = JSON.parse(fs.readFileSync(path.join(root, 'assets/prefabs/common/bottom.prefab'), 'utf8'));
const oneRecord = serialized.find(item => item.__type__ === 'cc.Node' && item._name === 'one');
const bottom = new Node('bottom'), buttons = new Node('buttons'), one = new Node('one');
bottom.children.push(buttons); buttons.children.push(one);
let authoredLabel, labelNode, originalWidth;
for (const ref of oneRecord._children) {
  const record = serialized[ref.__id__], node = new Node(record._name); one.children.push(node);
  for (const componentRef of record._components) {
    const data = serialized[componentRef.__id__];
    if (data.__type__ === 'cc.UITransform') node.addComponent(UITransform).setContentSize(data._contentSize.width, data._contentSize.height);
    if (data.__type__ === 'cc.Label') {
      authoredLabel = node.addComponent(Label); labelNode = node; authoredLabel.fontSize = data._fontSize;
      originalWidth = node.getComponent(UITransform).width;
    }
  }
}
const control = new HomeController();
control.footerRoot = { active: true }; control.bottomTabRoot = { active: true };
control.collectSecondaryOpacity = () => {}; control.bindPrefabButton = () => null;
control.refreshPrefabStart = () => {}; control.refreshLayout = () => {};
control.attachBottomPrefab(bottom);
assert.equal(control.prefabStartLabel, authoredLabel);
assert.equal(labelNode.active, true); assert.equal(authoredLabel.enabled, true);
assert.equal(authoredLabel.enableWrapText, false); assert.equal(authoredLabel.overflow, Label.Overflow.SHRINK);
assert(labelNode.getComponent(UITransform).width > originalWidth, 'long action copy receives the button width');
assert.equal(control.prefabStartSweep.renderBaseWithLabel, true);
assert.equal(one.getChildByName('icon').active, false);

const sweep = control.prefabStartSweep, label = authoredLabel;
label.string = '用 2 张烟票解锁'; labelNode.getComponent(UITransform).setAnchorPoint(.3, .7);
sweep.onLoad(); sweep.onEnable();
assert.equal(sweep.texture, null, 'native highlights never redraw the glyphs with Canvas');
assert.equal(label.enabled, true);
for (const band of sweep.nativeBands) {
  const overlay = band.label;
  for (const property of ['string', 'font', 'fontFamily', 'fontSize', 'lineHeight', 'spacingX', 'isBold', 'overflow', 'enableWrapText', 'horizontalAlign', 'verticalAlign']) {
    assert.equal(overlay[property], label[property], `native glyph layout must share ${property}`);
  }
  assert.equal(overlay.node.getComponent(UITransform).width, labelNode.getComponent(UITransform).width);
  assert.equal(overlay.node.getComponent(UITransform).anchorPoint.x, .3);
  assert.equal(overlay.node.getComponent(UITransform).anchorPoint.y, .7);
  assert.equal(band.clip.position.x + overlay.node.position.x, 0, 'the mask cannot shift the glyph origin');
  assert.equal(band.clip.position.y + overlay.node.position.y, 0);
}
sweep.playingOverride = false; sweep.refresh(true);
assert.equal(label.enabled, true); assert.equal(sweep.nativeRoot.active, false);
sweep.onDisable(); assert.equal(label.enabled, true);
sweep.active = true; sweep.refreshNativeLayout = () => { throw Error('effect failed'); }; sweep.refresh();
assert.equal(label.enabled, true); assert.equal(sweep.nativeRoot.active, false);
const canvasSweep = new TextSweep(); canvasSweep.label = label; canvasSweep.active = true;
canvasSweep.texture = { node: { isValid: true, active: false }, redraw() {} };
canvasSweep.paint(); assert.equal(label.enabled, false, 'existing canvas-base mode keeps its ownership semantics');
canvasSweep.onDisable(); assert.equal(label.enabled, true);
console.log('PASS: old-package main-action copy, exact Label binding, long-copy configuration, shared native font/layout/origin, baseline on pause/failure, and existing canvas mode. No visual validation.');
