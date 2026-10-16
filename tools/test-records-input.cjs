// Lifecycle regression only; does not create a browser or judge UI appearance.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('C:/ProgramData/cocos/editors/Creator/3.8.6/resources/resources/3d/engine/node_modules/typescript');
const filename = path.resolve(__dirname, '../assets/scripts/records/RecordsController.ts');
const timers = [];
let now = 1000;
let sizeReads = 0;
const exportsObject = {};
const cc = {
  _decorator: { ccclass: () => type => type }, Component: class {},
  HorizontalTextAlignment: { LEFT: 0, RIGHT: 1, CENTER: 2 },
  view: { getVisibleSize: () => { sizeReads++; return { width: 941, height: 1672 }; } },
};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2018,
    experimentalDecorators: true },
}).outputText, {
  exports: exportsObject,
  require: name => name === 'cc' ? cc : name.endsWith('UiFactory')
    ? { DESIGN_WIDTH: 941, DESIGN_HEIGHT: 1672 } : {},
  Date: { now: () => now },
  setTimeout: (run, delay) => { timers.push({ run, at: now + delay }); },
}, { filename });
const { RecordsController } = exportsObject;
function node(parent = null) {
  const result = {
    parent, children: [], active: true, isValid: true,
    removeFromParent() {
      if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1);
      this.parent = null;
    },
    destroy() { this.isValid = false; },
  };
  if (parent) parent.children.push(result);
  return result;
}
function editor(parent) {
  const input = node(parent);
  const edit = { node: input, isValid: true, focused: true, string: '12.50',
    native: { scrollIntoView() {} }, isFocused() { return this.focused; },
    blur() { this.focused = false; } };
  input.destroy = () => { input.isValid = false; edit.native = null; };
  return edit;
}
function advance(time) {
  now = time;
  for (const timer of timers.splice(0)) {
    if (timer.at <= now) timer.run();
    else timers.push(timer);
  }
}
const controller = new RecordsController();
const root = node();
const panel = node(root);
const edit = editor(panel);
controller.priceInput = edit;
controller.height = 1672 / (941 / 750);
controller.resize();
assert.equal(sizeReads, 0, 'keyboard resize must not rebuild a focused input');
assert.equal(edit.string, '12.50', 'keyboard resize retains the current draft');
const unrelated = node();
const tab = node(unrelated);
controller.clear(unrelated);
assert.equal(tab.isValid, false);
assert.equal(controller.priceInput, edit, 'clearing a different subtree keeps the editor');

controller.clear(root);
assert.equal(panel.isValid, false, 'the old panel is released immediately');
assert.equal(edit.node.active, false);
assert.equal(edit.node.parent, null, 'input is detached before its parent is destroyed');
assert.equal(edit.focused, false);
assert.equal(controller.priceInput, null);
assert.equal(edit.node.isValid, true, 'native input survives deferred engine scrolling');
advance(1400);
assert.doesNotThrow(() => edit.native.scrollIntoView(), 'the engine 400ms callback still has a DOM reference');
controller.resize();
assert.equal(sizeReads, 0, 'layout also waits for keyboard dismissal');
advance(1500);
assert.equal(edit.node.isValid, false, 'retired input is eventually released');
controller.resize();
assert.equal(sizeReads, 1, 'layout resumes after the keyboard grace period');
controller.retirePriceInput();
assert.equal(timers.length, 0, 'repeated cleanup does not schedule duplicate disposal');

// An event still on the retiring input cannot overwrite a newly opened editor.
const current = editor(node());
controller.priceInput = current;
controller.priceOpen = true;
controller.priceDraft = 'new draft';
controller.render = () => { throw new Error('stale input must not rebuild or save'); };
controller.savePrice(edit);
assert.equal(controller.priceDraft, 'new draft');
controller.retirePriceInput();
current.node.destroy();
advance(2000);
assert.equal(timers.length, 0, 'already destroyed retired nodes are handled safely');
console.log('PASS: records EditBox focus/resize, delayed native input disposal, and stale save events. Lifecycle checks only.');
