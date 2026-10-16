// Input, state, ownership and lifecycle checks; no canvas, browser or animation appearance validation.
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
  } }).outputText, { exports, require: name => imports[name] || {}, console, Map, Set }, { filename });
  return exports;
}
const catalog = load('packs/PackCatalog.ts');
const model = load('home/HomePackBrowserModel.ts', { '../packs/PackCatalog': catalog });
const { readHomePacks, homePackAction, HomePackGesture } = model;
assert.equal(readHomePacks(() => null).length, 8);
assert.equal(readHomePacks(() => { throw Error('unavailable'); }).length, 8);
const special = readHomePacks(id => ({ unlocked: id === 'shadowless', owned: id === 'zuguo' }));
assert.equal(special.length, 10); assert.equal(special[0].pack.id, 'shadowless');
assert.equal(special[9].pack.id, 'zuguo');
assert.equal(readHomePacks(id => ({ unlocked: id === 'zuguo' })).length, 8, 'national ownership is separate evidence');
assert.equal(homePackAction({ pack: catalog.PACK_CATALOG[1], state: { unlocked: false } }), '用 2 张烟票解锁');
assert.equal(homePackAction({ pack: catalog.PACK_CATALOG[2], state: { unlocked: false, progress: 2, target: 2 } }), '查看解锁条件');
const gesture = new HomePackGesture();
for (const [x, y, result] of [[50, 0, 'previous'], [-50, 0, 'next'], [3, 3, 'tap'], [0, 60, 'cancel'], [20, 0, 'cancel'], [50, 55, 'cancel']]) {
  gesture.begin(1, 0, 0, 1); assert.equal(gesture.end(1, x, y, 1), result);
}
gesture.begin(1, 0, 0, 1); gesture.begin(2, 0, 0, 2); assert.equal(gesture.end(1, -80, 0, 1), 'cancel');
gesture.begin(1, 0, 0, 1); gesture.move(1, 0, 30, 1);
assert.equal(gesture.end(1, -90, 30, 1), 'cancel', 'a vertical gesture cannot turn into a pack switch');
gesture.begin(1, 0, 0, 1); gesture.cancel(); assert.equal(gesture.end(1, -80, 0, 1), 'cancel');
gesture.begin(1, 0, 0, 1); assert.equal(gesture.end(1, 0, 0, 1), 'tap', 'cancel does not poison the next touch');
assert.equal(gesture.end(1, 0, 0, 1), 'cancel', 'unmatched release cannot open or consume');

class UITransform { setContentSize(width, height) { this.width = width; this.height = height; } }
class Node {
  constructor(name) { this.name = name; this.children = []; this.active = true; this.valid = true; this.components = new Map(); this.events = []; }
  get activeInHierarchy() { return this.active && (!this.parent || this.parent.activeInHierarchy); }
  setParent(parent) { this.removeFromParent(); parent.children.push(this); this.parent = parent; }
  removeFromParent() { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; }
  getChildByName(name) { return this.children.find(child => child.name === name); }
  addComponent(type) { const component = new type(); component.node = this; this.components.set(type, component); return component; }
  getComponent(type) { return this.components.get(type); }
  setPosition() {} setScale() {} on(...event) { this.events.push(event); }
  destroy() { this.valid = false; }
}
Node.EventType = { TOUCH_START: 'start', TOUCH_MOVE: 'move', TOUCH_END: 'end', TOUCH_CANCEL: 'cancel' };
function createNode(name, parent, w, h) { const node = new Node(name); node.setParent(parent); node.addComponent(UITransform).setContentSize(w, h); return node; }
class Graphics { roundRect() {} fill() {} stroke() {} }
const frameRequests = [], views = [];
class PackBoxView {
  constructor(node, pack, w, h, materials, mode) { this.pack = pack; this.mode = mode; views.push(this); materials.push({ dispose() {} }); }
  setFrame(frame) { this.frame = frame; } setLocked(value) { this.locked = value; }
}
const cc = { _decorator: { ccclass: () => type => type }, Component: class { scheduleOnce() {} }, UITransform, Node, Graphics,
  Mask: class {}, UIOpacity: class {}, SpriteFrame: class {}, isValid: value => value.valid !== false,
  view: { getVisibleSize: () => ({ width: 941, height: 1672 }) } };
const { HomePackBrowser } = load('home/HomePackBrowser.ts', {
  cc, './HomePackBrowserModel': model, '../packs/PackBoxView': { PackBoxView },
  '../common/UiFactory': { createNode, color: value => value, createLabel: (name, parent) => ({ node: createNode(name, parent, 100, 40) }) },
  '../assets/BundleLoader': { BundleLoader: { loadBundle: async () => ({ load: (key, type, done) => frameRequests.push({ key, done }) }) } },
});
(async () => {
  let blocked = false, changes = [], action = null;
  const browser = new HomePackBrowser(); browser.node = new Node('Browser'); const real = new Node('RealWangXi');
  browser.initialize(real, { readState: id => ({ unlocked: id === 'life' }), blocked: () => blocked,
    onChanged: (entry, index, count) => changes.push({ id: entry.pack.id, index, count }), onPreviewAction: id => action = id });
  assert.equal(real.parent, browser.life); assert(browser.node.events.every(event => event[3] === true), 'gesture capture precedes slot tap handlers');
  browser.browse(-1); assert.equal(browser.current.pack.id, 'red-equator'); assert.equal(changes.at(-1).count, 8);
  assert.equal(views[0].mode, 'home'); assert.equal(views[0].locked, true);
  browser.browse(1); assert.equal(browser.current.pack.id, 'red-equator', 'no overlapping switch');
  browser.update(.28); browser.activate(); assert.equal(action, 'red-equator');
  browser.browse(1); browser.update(.28); assert.equal(browser.current.pack.id, 'life'); assert.equal(real.parent, browser.life);
  assert.equal(browser.life.active, true, 'return restores the same interactive box');
  blocked = true; browser.browse(1); assert.equal(browser.current.pack.id, 'life'); blocked = false;
  const event = (x, y, count = 1) => ({ getUILocation: () => ({ x: x * 941 / 375, y: y * 941 / 375 }),
    touch: { getID: () => 1 }, getAllTouches: () => Array(count).fill({}) });
  browser.touchStart(event(0, 0)); const tap = event(0, 0, 0); browser.touchEnd(tap);
  assert.equal(tap.propagationStopped, undefined, 'ordinary life tap reaches its original handler');
  browser.touchStart(event(0, 0)); const swipe = event(-70, 0, 0); browser.touchEnd(swipe);
  assert.equal(swipe.propagationImmediateStopped, true); assert.equal(browser.current.pack.id, 'flowing-gold');
  browser.update(.28); await Promise.resolve(); await Promise.resolve();
  const frame = { refs: 0, addRef() { this.refs++; }, decRef() { this.refs--; } };
  frameRequests.find(request => request.key.includes('flowing-gold')).done(null, frame); assert.equal(frame.refs, 1);
  const late = frameRequests.find(request => request.key.includes('red-equator'));
  browser.onDestroy(); assert.equal(frame.refs, 0); late.done(null, frame); assert.equal(frame.refs, 0);

  const { HomeController } = load('home/HomeController.ts', { cc, './HomePackBrowserModel': model }); const home = new HomeController();
  let activated = 0, consumed = 0;
  home.pack = { lidOpen: true, slots: ['available'], instanceId: 'real-life' };
  home.packBrowser = { isLife: false, animating: false, activate: () => activated++,
    current: { pack: catalog.PACK_CATALOG[1], state: { unlocked: false } } };
  home.onStart = () => consumed++;
  home.activateMainButton(); home.beginOpenLid(false); home.startDefaultSlot();
  assert.equal(home.defaultSlot(), -1); assert.equal(home.getExtractionSource(0, null), null);
  assert.equal(consumed, 0); assert.equal(activated, 1);
  home.packStatusLabel = {}; home.inventoryUnitLabel = {}; home.startButtonLabel = {};
  home.startButton = {}; home.prefabPackLabel = {}; home.prefabStartLabel = {}; home.prefabStartButton = {};
  home.prefabInventoryIcons = [{ active: true }]; home.inventorySegments = [{ filled: { node: {} }, empty: { node: {} } }];
  home.refreshBrowseChrome();
  assert.equal(home.prefabPackLabel.string, '—'); assert.equal(home.prefabInventoryIcons[0].active, false);
  assert.equal(home.prefabStartLabel.string, '用 2 张烟票解锁'); assert.equal(home.pack.slots[0], 'available');
  home.browseBlocked = () => true; home.activateMainButton(); assert.equal(activated, 1);
  home.refreshBrowseChrome(); assert.equal(home.startButton.interactable, false);
  home.browseBlocked = () => false; home.refreshLayout = () => {};
  home.homeStatusMinute = Math.floor(Date.now() / 60000); home.update(0);
  assert.equal(home.startButton.interactable, true, 'closing an overlay re-enables the main action even when refresh preceded panel hiding');
  console.log('PASS: dynamic 8/9/10 packs, ownership, gesture cancellation/multi-touch, circular arrows, capture routing, shared home view, asset refs and WangXi inventory isolation. No visual validation.');
})().catch(error => { console.error(error); process.exitCode = 1; });
