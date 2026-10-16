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
class Color {
  constructor(r = 255, g = 255, b = 255, a = 255) { Object.assign(this, { r, g, b, a }); }
}
Color.WHITE = new Color();
class Component { enabledInHierarchy = true; }
class Button { enabled = true; interactable = true; }
Button.Transition = { NONE: 0 };
Button.EventType = { CLICK: 'click' };
class Sprite {}
class Node {
  components = [];
  events = new Map();
  getComponent(Type) { return this.components.find((component) => component instanceof Type) ?? null; }
  addComponent(Type) {
    const component = new Type();
    component.node = this;
    this.components.push(component);
    component.onLoad?.();
    component.onEnable?.();
    return component;
  }
  on(event, fn, target) { this.events.set(event, [...(this.events.get(event) ?? []), { fn, target }]); }
  off(event, fn, target) {
    this.events.set(event, (this.events.get(event) ?? []).filter((entry) => entry.fn !== fn || entry.target !== target));
  }
  emit(event) { for (const entry of [...(this.events.get(event) ?? [])]) entry.fn.call(entry.target); }
}
Node.EventType = { TOUCH_START: 'start', TOUCH_END: 'end', TOUCH_CANCEL: 'cancel', MOUSE_LEAVE: 'leave' };
const decorator = () => {};
const cc = { Component, Button, Node, Sprite, Color,
  EventHandler: { emitEvents: (events, data) => events.forEach((event) => event.emit(data)) },
  _decorator: { ccclass: () => (Type) => Type, property: decorator,
    requireComponent: () => decorator, disallowMultiple: decorator, menu: () => decorator } };
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'cc') return cc;
  return originalLoad.call(this, request, parent, isMain);
};
const { UIButton } = require(path.resolve(__dirname, '../assets/scripts/common/UIButton.ts'));
const originalNow = Date.now;
let now = 1000;
Date.now = () => now;
try {
  const node = new Node();
  let first = 0;
  let second = 0;
  let editorEvents = 0;
  const control = UIButton.bind(node, () => first++);
  control.clickEvents.push({ emit: (sender) => { assert.equal(sender, control); editorEvents++; } });
  node.emit('click');
  node.emit('click');
  assert.equal(first, 1, 'suppress rapid repeated click callbacks');
  assert.equal(editorEvents, 1);
  now += 250;
  node.emit('click');
  assert.equal(first, 2);
  assert.equal(UIButton.bind(node, () => second++), control);
  assert.equal(node.events.get('click').length, 1, 'binding replaces handler without extra listeners');
  now += 250;
  node.emit('click');
  assert.equal(first, 2);
  assert.equal(second, 1);
  control.interactable = false;
  now += 250;
  node.emit('click');
  assert.equal(second, 1);
  assert.equal(node.getComponent(Button).interactable, false);
  control.interactable = true;
  control.enabledInHierarchy = false;
  node.emit('click');
  assert.equal(second, 1);
  control.onDisable();
  assert.ok([...node.events.values()].every((events) => events.length === 0));
  control.enabledInHierarchy = true;
  control.onEnable();
  node.emit('click');
  assert.equal(second, 2);
  control.setHandler(null);
  now += 250;
  node.emit('click');
  assert.equal(second, 2, 'an unconnected button adds no business action');
  control.onDisable();
  console.log('PASS: callback replacement, cooldown, disabled guard, inspector callback routing and listener cleanup. No visual effects tested.');
} finally { Date.now = originalNow; }
