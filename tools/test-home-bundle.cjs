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

class Component { isValid = true; }
class Node {
  constructor(name) { this.name = name; this.children = []; this.active = true; this.isValid = true; }
  addChild(node) { node.parent = this; this.children.push(node); }
  getChildByName(name) { return this.children.find((node) => node.name === name) ?? null; }
  addComponent(Type) { const component = new Type(); component.node = this; return component; }
  destroy() { this.isValid = false; }
}
class UITransform { setContentSize() {} }
class Prefab {
  constructor(name) { this.name = name; this.refs = 0; }
  addRef() { this.refs++; }
  decRef() { this.refs--; }
}
class DemoFlow {
  attachments = [];
  attachTopPrefab(node) { this.attach(node); }
  attachBottomPrefab(node) { this.attach(node); }
  attachSidePrefab(node) { this.attach(node); }
  attach(node) {
    assert.equal(this.node.active, false, 'wire before activating flow');
    assert.equal(node.parent, this.node.parent, 'keep the prefab directly below Canvas');
    this.attachments.push(node);
  }
}

const names = ['bottom', 'side', 'top', 'smokePack'];
let bundleCalls = 0;
let failBundle = false;
let failedPath = '';
const cached = new Map();
let loadedAssets = [];
const bundle = {
  load(assetPath, Type, callback) {
    assert.equal(Type, Prefab);
    queueMicrotask(() => {
      if (assetPath === failedPath) return callback(new Error('missing asset'));
      const prefab = new Prefab(assetPath);
      loadedAssets.push(prefab);
      callback(null, prefab);
    });
  },
};
const cc = {
  Component, Node, Prefab, UITransform,
  _decorator: { ccclass: () => (Type) => Type },
  ResolutionPolicy: { FIXED_WIDTH: 1 }, view: { setDesignResolutionSize() {} },
  isValid: (object) => object?.isValid === true,
  instantiate: (prefab) => new Node(prefab.name.split('/').pop()),
  assetManager: {
    getBundle: (name) => cached.get(name),
    loadBundle(name, callback) {
      bundleCalls++;
      queueMicrotask(() => {
        if (failBundle) return callback(new Error('bundle unavailable'));
        cached.set(name, bundle);
        callback(null, bundle);
      });
    },
  },
};
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'cc') return cc;
  if (request === './DemoFlow') return { DemoFlow };
  if (request === '../common/UiFactory') return { alignWidget() {}, DESIGN_WIDTH: 941, DESIGN_HEIGHT: 1672 };
  return originalLoad.call(this, request, parent, isMain);
};
const root = path.resolve(__dirname, '..');
const { BundleLoader } = require(path.join(root, 'assets/scripts/assets/BundleLoader.ts'));
const { GameBootstrap } = require(path.join(root, 'assets/scripts/app/GameBootstrap.ts'));

(async () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'assets/prefabs.meta'), 'utf8'));
  assert.equal(config.userData.isBundle, true);
  assert.equal(config.userData.bundleName, 'prefabs');
  for (const name of names) assert.ok(fs.existsSync(path.join(root, `assets/prefabs/common/${name}.prefab`)));

  const first = BundleLoader.loadBundle('prefabs');
  assert.equal(BundleLoader.loadBundle('prefabs'), first);
  await first;
  await BundleLoader.loadBundle('prefabs');
  assert.equal(bundleCalls, 1, 'share concurrent requests and reuse cached bundle');

  const app = new GameBootstrap();
  app.node = new Node('Canvas');
  const existingPack = new Node('smokePack');
  app.node.addChild(existingPack);
  const start = app.startApplication();
  assert.equal(app.node.getChildByName('AppRoot'), null, 'do not start before resources arrive');
  await start;
  for (const name of names) {
    const matches = app.node.children.filter((node) => node.name === name);
    assert.equal(matches.length, 1);
    assert.equal(matches[0].parent, app.node);
    assert.equal(matches[0].active, name !== 'smokePack');
  }
  assert.equal(app.node.getChildByName('smokePack'), existingPack);
  assert.equal(app.node.getChildByName('AppRoot').active, true);
  assert.equal(loadedAssets.length, 4);
  assert.ok(loadedAssets.every((asset) => asset.refs === 1));
  app.onDestroy();
  assert.ok(loadedAssets.every((asset) => asset.refs === 0));

  const cancelled = new GameBootstrap();
  cancelled.node = new Node('Canvas');
  const cancelledStart = cancelled.startApplication();
  cancelled.isValid = false;
  await cancelledStart;
  assert.equal(cancelled.node.children.length, 0, 'no late instantiation after destruction');

  failedPath = 'common/side';
  const broken = new GameBootstrap();
  broken.node = new Node('Canvas');
  await assert.rejects(broken.startApplication(), /prefabs\/common\/side/);
  assert.equal(broken.node.children.length, 0, 'failed batch mounts no partial page');
  failedPath = '';

  failBundle = true;
  await assert.rejects(BundleLoader.loadBundle('retry'), /bundle unavailable/);
  failBundle = false;
  assert.equal(await BundleLoader.loadBundle('retry'), bundle, 'failed requests can be retried');
  console.log('PASS: bundle config and paths, concurrent/cache reuse, deferred startup, Canvas parents, no duplicates, reference cleanup, cancellation, atomic failure and retry.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
