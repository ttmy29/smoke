// Data branches, UI state and return routing only; no drawing or visual simulation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('C:/ProgramData/cocos/editors/Creator/3.8.6/resources/resources/3d/engine/node_modules/typescript');
const root = path.resolve(__dirname, '../assets/scripts');
function load(file, imports = {}) {
  const exports = {}, filename = path.join(root, file);
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2018, experimentalDecorators: true,
  } }).outputText, { exports, require: name => imports[name] || {}, console }, { filename });
  return exports;
}
const catalog = load('packs/PackCatalog.ts');
const model = load('packs/PackLockedAction.ts', { './PackCatalog': catalog });
const { resolvePackLockedAction: resolve } = model;
for (const tickets of [null, -1, 1.5, Infinity]) assert.equal(resolve('flowing-gold', null, tickets).kind, 'toast');
for (const tickets of [0, 1]) assert.equal(resolve('flowing-gold', null, tickets).kind, 'checkin');
for (const tickets of [2, 50]) assert.equal(resolve('flowing-gold', null, tickets).kind, 'exchange');
assert.equal(resolve('flowing-gold', { unlocked: true }, 0).kind, 'none');
assert.equal(resolve('missing', null, 2).kind, 'none');
assert.equal(resolve('neon-bridge', { unlocked: false, progress: 30, target: 30 }, 2).text, '成就数达到 30 个');

class UITransform {
  setContentSize(width, height) { this.width = width; this.height = height; }
  setAnchorPoint() {}
}
class Node {
  constructor(name) { this.name = name; this.children = []; this.active = true; this.components = new Map(); }
  addComponent(type) { const value = new type(); value.node = this; this.components.set(type, value); return value; }
  getComponent(type) { return this.components.get(type); }
  setParent(parent) { this.removeFromParent(); this.parent = parent; parent.children.push(this); }
  removeFromParent() { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; }
  setPosition() {} setScale() {} setSiblingIndex() {} destroy() {}
}
class Label { updateRenderData() {} } Label.Overflow = { RESIZE_HEIGHT: 1 };
class ScrollView {}
function createNode(name, parent, width, height) {
  const node = new Node(name); node.setParent(parent); node.addComponent(UITransform).setContentSize(width, height); return node;
}
const ui = { createNode, createRect: (name, parent, w, h) => createNode(name, parent, w, h),
  createLabel(name, parent, text, font, color, w, h) { const label = createNode(name, parent, w, h).addComponent(Label); label.string = text; return label; } };
const cc = { _decorator: { ccclass: () => type => type }, Component: class {}, Label, Node, UITransform,
  BlockInputEvents: class {}, UIOpacity: class {}, ScrollView, Mask: class {}, HorizontalTextAlignment: { LEFT: 0 },
  screen: { windowSize: { width: 375 }, devicePixelRatio: 1 }, view: { getVisibleSize: () => ({ width: 941, height: 1672 }) } };
const { PackLockedController } = load('packs/PackLockedController.ts', {
  cc, '../common/UiFactory': ui, './PackLockedAction': model,
  '../common/UIButton': { UIButton: { bind(node, click) { node.click = click; return {}; } } },
  '../session/effects/CanvasTexture': { CanvasTexture: class { redraw() {} dispose() {} } },
});
function find(node, name) { if (node.name === name) return node; for (const child of node.children) { const result = find(child, name); if (result) return result; } }
(async () => {
  let tickets = 2, routed = null, changed = 0, calls = 0;
  const modalStates = [];
  const controller = new PackLockedController(); controller.node = new Node('OverlayRoot');
  controller.initialize({ readTickets: () => tickets, readState: () => null, onCheckIn: origin => routed = origin, onChanged: () => changed++,
    onModalChanged: (open, origin) => modalStates.push({ open, origin }) });
  controller.present('night-voyage', 'home'); assert.equal(controller.modalOpen, false); assert.equal(controller.toast.active, true);
  controller.update(2.2); assert.equal(controller.node.active, false);
  controller.present('flowing-gold', 'home'); assert.equal(controller.modalOpen, true);
  assert.equal(find(controller.node, 'Title').getComponent(Label).string, '用 2 张烟票兑换华孑？');
  assert.equal(find(controller.node, 'Confirm').children[0].getComponent(Label).string, '兑换烟盒');
  await controller.confirm(); assert.equal(controller.modalOpen, true); assert.equal(tickets, 2); assert.equal(changed, 0, 'missing adapter never grants or deducts');
  find(controller.node, 'Cancel').click(); assert.equal(controller.modalOpen, false);
  assert.deepEqual(modalStates.slice(-2), [{ open: true, origin: 'home' }, { open: false, origin: 'home' }]);
  tickets = 1; controller.present('flowing-gold', 'catalog'); assert.equal(routed, 'catalog');
  tickets = 2; controller.present('flowing-gold', 'home'); tickets = 0;
  await controller.confirm(); assert.equal(routed, 'home', 'confirmation rechecks the current balance');
  tickets = null; controller.present('flowing-gold', 'home');
  assert.equal(controller.modalOpen, false); assert.equal(find(controller.toast, 'Text').getComponent(Label).string, '烟票暂时读不到，请再试一次');
  tickets = 2; controller.present('flowing-gold', 'catalog');
  let finish;
  controller.actions.onConfirmExchange = () => { calls++; return new Promise(resolve => finish = resolve); };
  const pending = controller.confirm(); await controller.confirm(); assert.equal(calls, 1);
  controller.dismiss(); finish(true); await pending; assert.equal(changed, 0, 'late success cannot reopen or refresh a dismissed UI');
  controller.actions.onConfirmExchange = () => true;
  controller.present('flowing-gold', 'home'); await controller.confirm(); assert.equal(changed, 1); assert.equal(controller.modalOpen, false);
  assert.equal(tickets, 2, 'the UI controller never writes the wallet');

  const { DemoFlow } = load('app/DemoFlow.ts', { cc }); const flow = new DemoFlow();
  flow.node = { children: [1, 2, 3] }; flow.checkInPanel = { active: false, setSiblingIndex() {} };
  flow.packSelectPanel = { active: true, setSiblingIndex() {} };
  let paused = false, resumed = 0, refreshed = 0;
  flow.packSelectController = { suspend: visible => paused = visible, resume: () => resumed++, refresh: () => refreshed++ };
  flow.showCheckIn = () => flow.checkInPanel.active = true;
  flow.checkInController = { dismiss: () => flow.checkInPanel.active = false };
  flow.homeController = { setCheckInSnapshot() {}, refreshPackBrowsing() {} };
  flow.checkInStore = { readSnapshot: () => ({ ticketBalance: 2 }) };
  flow.showPackCheckIn('catalog'); assert.equal(paused, true); assert.equal(flow.packCheckInOrigin, 'catalog');
  flow.closeCheckIn(); assert.equal(flow.checkInPanel.active, false); assert.equal(resumed, 1); assert.equal(refreshed, 1);
  flow.showPackCheckIn('home'); flow.closeCheckIn(); assert.equal(resumed, 1, 'home return must not open the catalogue');
  let regular = false; flow.closeRecordsChild = child => regular = child === 'checkin'; flow.closeCheckIn(); assert(regular);
  console.log('PASS: ordinary lock toast, exact exchange UI, live balance branch, no fake deduction/unlock, cancel/repeat/late-callback isolation, and home/catalogue check-in returns. No visual validation.');
})().catch(error => { console.error(error); process.exitCode = 1; });
