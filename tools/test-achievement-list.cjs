// Node-management checks only: no rendering, animation playback, or visual assertions.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('C:/ProgramData/cocos/editors/Creator/3.8.6/resources/resources/3d/engine/node_modules/typescript');

require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2018,
      experimentalDecorators: true },
  }).outputText, filename);
};
const stopped = [];
const cc = {
  Component: class {}, UITransform: class {},
  Vec2: class { constructor(x, y) { Object.assign(this, { x, y }); } },
  Tween: { stopAllByTarget: (target) => stopped.push(target) },
  view: { getVisibleSize: () => ({ width: 941, height: 1672 }) },
  _decorator: { ccclass: () => (Type) => Type },
};
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'cc') return cc;
  if (request === '../common/UiFactory' || request === './AchievementIcon') return {};
  return originalLoad.call(this, request, parent, isMain);
};
let AchievementController, ACHIEVEMENT_GROUPS;
try {
  ({ AchievementController } = require(path.resolve(__dirname,
    '../assets/scripts/achievement/AchievementController.ts')));
  ({ ACHIEVEMENT_GROUPS } = require(path.resolve(__dirname,
    '../assets/scripts/achievement/AchievementCatalog.ts')));
} finally { Module._load = originalLoad; }

const controller = new AchievementController();
const items = ACHIEVEMENT_GROUPS.flatMap((group) => group.items.map((item) =>
  ({ item, groupId: group.id })));
const height = items.length * 168;
let offset = 0;
let created = 0;
let scrollTarget;
controller.content = { getComponent: () => ({ height }) };
controller.viewport = { getComponent: () => ({ height: 1248 }) };
controller.scroll = {
  getScrollOffset: () => ({ y: offset }),
  stopAutoScroll: () => {},
  scrollToTop: () => { offset = 0; },
  scrollToOffset: (target) => { scrollTarget = target; },
};
controller.rowLayouts = items.map((entry, index) =>
  ({ ...entry, y: height / 2 - index * 168 - 78 }));
controller.renderRow = (item) => {
  created++;
  const flipper = { id: item.id };
  return { backVisible: controller.flipped.has(item.id), removed: false, destroyed: false,
    getChildByName: () => flipper,
    removeFromParent() { this.removed = true; },
    destroy() { this.destroyed = true; } };
};
controller.updateVisibleRows();
assert(controller.rowNodes.size > 0 && controller.rowNodes.size < 20,
  'initial creation is bounded by the viewport, not the full catalog');
const initialCreated = created;
controller.updateVisibleRows();
assert.equal(created, initialCreated, 'unchanged scrolling reuses existing nodes');
const firstId = items[0].item.id;
const firstRow = controller.rowNodes.get(firstId);
controller.flipped.add(firstId);
controller.flipping.add(firstId);
offset = height - 1248;
controller.updateVisibleRows();
assert(firstRow.removed && firstRow.destroyed, 'offscreen nodes are detached and released');
assert(stopped.some((target) => target.id === firstId), 'releasing stops pending flip callbacks');
assert(!controller.flipping.has(firstId), 'released row does not retain its click lock');
assert(controller.rowNodes.size < 20, 'scrolling keeps node count bounded');
offset = 0;
controller.updateVisibleRows();
assert(controller.rowNodes.get(firstId).backVisible, 'flip state survives offscreen release');

const last = items[items.length - 1].item;
assert(!controller.rowNodes.has(last.id));
controller.results.set(last.id, { id: last.id, completed: true, unread: true });
controller.locateUnread();
const lastLayout = controller.rowLayouts.find((row) => row.item.id === last.id);
assert.equal(scrollTarget.y, Math.max(0, height / 2 - lastLayout.y - 80),
  'unread navigation uses full-list coordinates even without an instantiated node');
controller.rowLayouts = [];
offset = 500;
controller.updateVisibleRows(true);
assert.equal(offset, 0, 'empty and error states also reset scrolling');

const opening = new AchievementController();
let layouts = 0;
let renders = 0;
opening.source = { readResults: () => [] };
opening.node = { active: false, setPosition: () => {} };
opening.resize = (render) => { assert.equal(render, false); layouts++; };
opening.render = (reset) => { assert.equal(reset, true); renders++; };
opening.present();
assert.equal(layouts, 1);
assert.equal(renders, 1, 'opening performs one list rebuild');
console.log('Achievement list node-management checks passed.');
