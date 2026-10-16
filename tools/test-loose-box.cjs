// State, navigation and lifecycle checks only. No canvas, browser or visual simulation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('C:/ProgramData/cocos/editors/Creator/3.8.6/resources/resources/3d/engine/node_modules/typescript');
const root = path.resolve(__dirname, '../assets/scripts');
function load(relative, imports = {}) {
  const filename = path.join(root, relative), exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2018, experimentalDecorators: true },
  }).outputText, { exports, require: name => imports[name] || {}, console, Set, Map, Date }, { filename });
  return exports;
}
const model = load('packs/LooseBoxModel.ts');
const gift = (id, quantity = 1) => ({ id, quantity, senderName: '烟友', receivedAt: Date.now(), themeName: '王溪',
  badge: { id: 'badge', title: '烟友徽章', description: '数据源提供的徽章说明' } });
for (const [index, capacity] of [1, 5, 7, 10, 15, 20].entries()) {
  const state = model.readLooseBox({ readSnapshot: () => ({ level: index + 1, items: [] }) });
  assert.equal(state.capacity, capacity); assert.equal(state.count, 0);
  assert.equal(state.nextTier?.level ?? null, index === 5 ? null : index + 2);
}
for (const snapshot of [null, { level: 0, items: [] }, { level: 7, items: [] },
  { level: 1, items: [gift('a', 5)] }, { level: 2, items: [gift('a'), gift('a')] },
  { level: 2, items: [gift('a', 2)] }]) {
  const state = model.readLooseBox({ readSnapshot: () => snapshot });
  assert.equal(state.known, false); assert.equal(state.count, null); assert.equal(state.capacity, null);
}
assert.equal(model.readLooseBox({ readSnapshot: () => { throw Error('unavailable'); } }).count, null);
assert.equal(model.readLooseBox({ readSnapshot: () => ({ level: 3, items: [gift('a', 5), gift('b')] }) }).count, 6);

class UITransform { setContentSize(w, h) { this.width = w; this.height = h; } setAnchorPoint() {} }
class Graphics { clear() {} rect() {} circle() {} fill() {} moveTo() {} lineTo() {} close() {} stroke() {} }
class Mask { constructor() { this.subComp = new Graphics(); } }
Mask.Type = { GRAPHICS_STENCIL: 1 };
class Label { updateRenderData() {} }
Label.Overflow = { RESIZE_HEIGHT: 1 };
class ScrollView {
  constructor() { this.enabled = true; this.offset = { y: 0 }; }
  getScrollOffset() { return this.offset; } stopAutoScroll() {}
  scrollToOffset(offset) { this.offset = offset; } scrollToTop() { this.offset = { y: 0 }; }
}
class Sprite {} Sprite.SizeMode = { CUSTOM: 1 };
class Node {
  constructor(name) { this.name = name; this.children = []; this.active = true; this.valid = true; this.components = new Map(); }
  addChild(child) { child.parent = this; this.children.push(child); }
  addComponent(type) { const component = new type(); component.node = this; this.components.set(type, component); return component; }
  getComponent(type) { return this.components.get(type); }
  setPosition() {} setScale() {} on() {} setSiblingIndex() {}
  removeFromParent() { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; }
  destroy() { this.valid = false; for (const child of this.children) child.destroy(); }
}
Node.EventType = {};
function createNode(name, parent, width, height) {
  const node = new Node(name); parent.addChild(node); node.addComponent(UITransform).setContentSize(width, height); return node;
}
const ui = {
  createNode, color: value => value,
  createRect(name, parent, w, h) { const n = createNode(name, parent, w, h); n.addComponent(Graphics); return n; },
  createLabel(name, parent, copy, font, ink, w, h) {
    const label = createNode(name, parent, w, h).addComponent(Label); label.string = copy; return label;
  },
};
class CanvasTexture {
  constructor(name, parent, w, h) { this.node = createNode(name, parent, w, h); }
  redraw() {} dispose() { this.disposed = true; }
}
const cc = { _decorator: { ccclass: () => type => type }, Component: class {}, Node, UITransform, Graphics, Mask, Label,
  ScrollView, Sprite, UIOpacity: class {}, BlockInputEvents: class {}, HorizontalTextAlignment: { LEFT: 0 },
  Vec2: class { constructor(x, y) { this.x = x; this.y = y; } }, isValid: value => value.valid !== false,
  view: { getVisibleSize: () => ({ width: 941, height: 1672 }) }, screen: { windowSize: { width: 375 }, devicePixelRatio: 1 } };
const { LooseBoxController } = load('packs/LooseBoxController.ts', {
  cc, '../common/UiFactory': ui, './LooseBoxModel': model,
  '../common/UIButton': { UIButton: { bind(node, click) { node.click = click; return { interactable: true }; } } },
  '../session/effects/CanvasTexture': { CanvasTexture },
  './LooseContainerView': { createLooseContainer: (parent, w, h) => new CanvasTexture('Container', parent, w, h) },
});
function find(node, name) { if (node.name === name) return node; for (const child of node.children) { const found = find(child, name); if (found) return found; } }
function click(controller, name) { const node = find(controller.node, name); assert(node, `missing control: ${name}`); node.click(); }
async function flush() { await Promise.resolve(); await Promise.resolve(); }
(async () => {
  let back = 0, home = 0, ranking = 0, snapshot = null;
  const controller = new LooseBoxController(); controller.node = new Node('Root');
  controller.initialize({ onBack: () => back++, onHome: () => home++, onRanking: () => ranking++ }, { readSnapshot: () => snapshot });
  controller.present(); click(controller, 'RankingLink'); assert.equal(ranking, 0, 'entry motion blocks clicks');
  controller.update(.3); assert(find(controller.node, 'EmptyTitle'));
  assert.equal(find(controller.node, 'Count').getComponent(Label).string, '—');
  click(controller, 'RankingLink'); click(controller, 'GoHome'); assert.equal(ranking, 1); assert.equal(home, 1);
  const before = JSON.stringify(snapshot); click(controller, 'UpgradeAd'); await flush();
  assert.equal(JSON.stringify(snapshot), before, 'absent ad callback never fabricates capacity');

  snapshot = { level: 3, items: [gift('single'), gift('group', 5)] }; controller.setSource({ readSnapshot: () => snapshot });
  assert(find(controller.node, 'RandomSmoke')); controller.openDetail('group'); assert.equal(controller.modalOpen, true);
  assert.equal(controller.scroll.enabled, false); click(controller, 'RequestDiscard'); assert(find(controller.node, 'ConfirmDiscard'));
  click(controller, 'Keep'); assert(find(controller.node, 'RequestDiscard')); assert.equal(snapshot.items.length, 2);
  click(controller, 'BadgeInfo'); assert.equal(controller.badgeOpen, true);
  let mutations = 0; await controller.runBusiness(() => { mutations++; return true; }); assert.equal(mutations, 0);
  click(controller, 'CloseBadge'); click(controller, 'RequestDiscard'); click(controller, 'ConfirmDiscard'); await flush();
  assert.equal(snapshot.items.length, 2, 'absent discard callback preserves inventory and confirmation');
  controller.actions.onDiscard = id => { snapshot = { ...snapshot, items: snapshot.items.filter(item => item.id !== id) }; return true; };
  click(controller, 'ConfirmDiscard'); await flush(); assert.equal(snapshot.items.length, 1); assert.equal(controller.modalOpen, false);
  controller.scroll.offset = { y: 190 }; controller.suspend(); controller.resume(); assert.equal(controller.scroll.offset.y, 190);

  let resolve, refreshes = 0; controller.refresh = () => refreshes++;
  const request = controller.runBusiness(() => new Promise(done => { resolve = done; }));
  await controller.runBusiness(() => { mutations++; return true; }); assert.equal(mutations, 0, 'pending action blocks repeat submission');
  controller.suspend(true); assert.equal(controller.node.active, true);
  assert.equal(controller.scroll.enabled, false);
  click(controller, 'RankingLink'); assert.equal(ranking, 1, 'a visible covered page cannot navigate');
  resolve(true); await request; assert.equal(refreshes, 0, 'late success cannot rebuild even a visible suspended page');
  controller.resume(); controller.close(); controller.update(.3); assert.equal(back, 1); assert.equal(controller.node.active, false);
  controller.onDestroy(); assert.equal(controller.materials.length, 0); assert.equal(controller.detailMaterials.length, 0);

  const { PackSelectController } = load('packs/PackSelectController.ts', {
    cc, '../common/UiFactory': ui,
    '../common/UIButton': { UIButton: { bind(node, click) { node.click = click; return { interactable: true }; } } },
  });
  const catalog = new PackSelectController(); catalog.node = new Node('CatalogRoot');
  let popped = 0, clicked = 0, resized = 0;
  catalog.initialize({ onBack: () => popped++, readPack: () => null, readTickets: () => null });
  catalog.resize = () => resized++; catalog.loadImages = () => {};
  const hit = createNode('Action', catalog.node, 80, 80); catalog.bind(hit, () => clicked++);
  catalog.present(); hit.click(); assert.equal(clicked, 0);
  catalog.update(.3); hit.click(); assert.equal(clicked, 1);
  catalog.scroll.offset = { y: 280 }; catalog.suspend(true);
  assert.equal(catalog.node.active, true, 'catalog remains painted below the loose page throughout push/pop');
  assert.equal(catalog.scroll.enabled, false); hit.click(); assert.equal(clicked, 1);
  const beforeUpdate = resized; catalog.update(.3); assert.equal(resized, beforeUpdate, 'covered page does not rebuild');
  catalog.resume(); assert.equal(catalog.scroll.offset.y, 280); assert.equal(catalog.scroll.enabled, true);
  catalog.close(); hit.click(); assert.equal(clicked, 1);
  catalog.update(.1); assert.equal(popped, 0); assert.equal(catalog.node.active, true);
  catalog.update(.2); assert.equal(popped, 1); assert.equal(catalog.node.active, false);

  const { DemoFlow } = load('app/DemoFlow.ts', { cc }); const flow = new DemoFlow();
  flow.node = { children: [1, 2, 3] }; let packSuspended = 0, loosePresented = 0, looseSuspended = 0, looseResumed = 0;
  flow.homePanel = { active: false }; flow.packSelectPanel = { active: false, setSiblingIndex() {} };
  flow.looseBoxPanel = { active: false, setSiblingIndex() {} }; flow.rankingPanel = { active: false, setSiblingIndex() {} };
  for (const key of ['sessionPanel', 'resultPanel', 'supplyPanel', 'checkInPanel', 'quitPanel', 'transitionLayer']) flow[key] = { active: false };
  flow.packSelectController = {
    present: () => { assert.equal(flow.homePanel.active, true, 'home is visible before the catalogue enters'); flow.packSelectPanel.active = true; },
    suspend: keepVisible => { packSuspended++; flow.packSelectPanel.active = keepVisible; },
  };
  flow.looseBoxController = { present: () => { loosePresented++; flow.looseBoxPanel.active = true; },
    suspend: keepVisible => { looseSuspended++; flow.looseBoxPanel.active = keepVisible; }, resume: () => { looseResumed++; flow.looseBoxPanel.active = true; } };
  flow.rankingController = { present() {}, dismiss: () => { flow.rankingPanel.active = false; } };
  flow.showPackSelect(); assert.equal(flow.homePanel.active, true);
  flow.showLooseBox(); assert.equal(packSuspended, 1); assert.equal(loosePresented, 1);
  assert.equal(flow.packSelectPanel.active, true, 'parent is never hidden before or during child push/pop');
  flow.showRanking(true); assert.equal(looseSuspended, 1); assert.equal(flow.looseBoxPanel.active, true);
  flow.closeRanking(); assert.equal(looseResumed, 1); assert.equal(flow.rankingPanel.active, false);
  assert.equal(flow.looseBoxPanel.active, true, 'ranking returns to loose box');
  assert.equal(flow.homePanel.active, true, 'home remains available beneath the page stack');
  let returnedHome = false; flow.showHome = () => { returnedHome = true; }; flow.closeRanking(); assert(returnedHome);
  console.log('PASS: loose box data/detail paths, visible parent push/pop, covered input/scroll, async isolation, disposal and ranking return. No visual validation.');
})().catch(error => { console.error(error); process.exitCode = 1; });
