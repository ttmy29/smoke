const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('C:/ProgramData/cocos/editors/Creator/3.8.6/resources/resources/3d/engine/node_modules/typescript');
const root = path.resolve(__dirname, '../assets/scripts');

function load(relative, imports = {}, consoleStub = console) {
  const filename = path.join(root, relative);
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, experimentalDecorators: true,
  } }).outputText;
  vm.runInNewContext(code, { exports, Date, console: consoleStub, require(name) {
    if (Object.prototype.hasOwnProperty.call(imports, name)) return imports[name];
    throw new Error(`Unexpected runtime import: ${name}`);
  } }, { filename });
  return exports;
}

function storage() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value),
    removeItem: key => data.delete(key) };
}

const { CheckInStore } = load('persistence/CheckInStore.ts');
const { PackStore, countAvailableSlots } = load('persistence/PackStore.ts');
const { ProgressStore } = load('persistence/ProgressStore.ts');
const { newlyUnlockedFeatures } = load('checkin/CheckInUnlockCatalog.ts');
const { PreviewRewardedVideoGateway } = load('services/RewardedVideo.ts');
const now = new Date(2026, 9, 16, 12).getTime();

for (let days = 0; days < 4; days++) {
  const store = new CheckInStore(storage());
  assert.equal(store.initializePreview({ cumulativeDays: days, streak: Math.min(days, 1),
    ticketBalance: 20, checkedToday: false }, now), true);
  const initial = store.readSnapshot(now);
  assert.equal(initial.cumulativeDays, days);
  assert.equal(initial.streak, Math.min(days, 1));
  assert.equal(initial.ticketBalance, 20);
  assert.equal(initial.checkedToday, false);
  assert.equal(store.checkInToday(now), 'checked');
  const checked = store.readSnapshot(now);
  assert.equal(checked.cumulativeDays, days + 1);
  assert.equal(checked.streak, Math.min(days, 1) + 1);
  assert.equal(checked.ticketBalance, 21);
  assert.ok(newlyUnlockedFeatures(days, checked.cumulativeDays).length > 0);
  assert.equal(store.checkInToday(now), 'already-checked');
  assert.equal(store.initializePreview({ cumulativeDays: 0, streak: 0,
    ticketBalance: 0, checkedToday: false }, now), false, 'must not overwrite existing progress');
}

const checked = new CheckInStore(storage());
assert.equal(checked.initializePreview({ cumulativeDays: 9, streak: 3,
  ticketBalance: 17, checkedToday: true }, now), true);
assert.equal(checked.checkInToday(now), 'already-checked');
assert.equal(checked.readSnapshot(now).ticketBalance, 17, 'initial today state must not issue another ticket');
for (const invalid of [
  { cumulativeDays: 1, streak: 2, ticketBalance: 0, checkedToday: false },
  { cumulativeDays: 0, streak: 0, ticketBalance: 0, checkedToday: true },
  { cumulativeDays: 1, streak: 1, ticketBalance: -1, checkedToday: false },
]) assert.equal(new CheckInStore(storage()).initializePreview(invalid, now), false);

for (const remaining of [0, 3, 10]) {
  const packs = new PackStore(storage());
  assert.equal(packs.initializePreview({ packId: 'wang-xi', remaining, lidOpen: true }), true);
  const pack = packs.readPack();
  assert.equal(countAvailableSlots(pack), remaining);
  assert.equal(pack.lidOpen, true);
  if (remaining > 0) assert.equal(countAvailableSlots(packs.consumeSlot(0)), remaining - 1);
  else assert.equal(countAvailableSlots(packs.refillAfterReward(pack.instanceId)), 10);
  assert.equal(packs.initializePreview({ packId: 'wang-xi', remaining: 10, lidOpen: false }), false);
}
for (const settings of [{ packId: 'other', remaining: 10, lidOpen: false },
  { packId: 'wang-xi', remaining: 11, lidOpen: false }]) {
  assert.equal(new PackStore(storage()).initializePreview(settings), false);
}
const legacy = storage();
legacy.setItem('smoke.pack.wang-xi.v1', '{}');
assert.equal(new PackStore(legacy).initializePreview({ packId: 'wang-xi', remaining: 5, lidOpen: false }), false);

const progress = new ProgressStore(storage());
assert.equal(progress.initializePreview(42, now), true);
assert.equal(progress.readSmokedCount(), 42);
assert.equal(progress.readHomeSmokingStatus(now).todaySmoked, 0);
assert.equal(progress.readHomeSmokingStatus(now).lastCompletedAt, null);
assert.equal(progress.recordCompletedCigarette('preview-session', now), 43);
assert.equal(progress.readHomeSmokingStatus(now).todaySmoked, 1);
assert.equal(progress.initializePreview(0, now), false);
assert.equal(new CheckInStore(null).initializePreview({ cumulativeDays: 0, streak: 0,
  ticketBalance: 0, checkedToday: false }, now), false);
const failedStorage = { getItem: () => null, setItem() { throw new Error('write failed'); } };
assert.equal(new PackStore(failedStorage).initializePreview({ packId: 'wang-xi', remaining: 5, lidOpen: false }), false);
assert.equal(new ProgressStore(failedStorage).initializePreview(5, now), false);

class Component {}
const { DemoAudio } = load('audio/DemoAudio.ts', { cc: {
  Component, _decorator: { ccclass: () => Type => Type },
}, '../assets/AssetCatalog': { AssetCatalog: {} } });
const audio = new DemoAudio();
function source() { return { playing: false, volume: 0,
  stop() { this.playing = false; }, play() { this.playing = true; } }; }
audio.primarySource = source();
audio.accentSource = source();
for (const sound of ['ignition', 'inhale', 'exhale', 'ashTap']) audio.clips.set(sound, {});
assert.equal(audio.initializeDefaults(true, 0.5), true);
audio.play('inhale');
assert.equal(audio.primarySource.volume, 0.45);
audio.play('ashTap');
assert.equal(audio.accentSource.volume, 0.14);
assert.equal(audio.initializeDefaults(false, 0), true);
assert.equal(audio.isMuted, true);
assert.equal(audio.primarySource.playing, false);
assert.equal(audio.toggleMuted(), false);
audio.play('ignition');
assert.equal(audio.primarySource.volume, 0);
assert.equal(audio.initializeDefaults(true, 2), false);

for (const enabled of [false, true]) {
  let logs = 0;
  load('services/DebugLog.ts', { '../config/InitialSettings': { ENABLE_DEBUG_LOGS: enabled } },
    { debug() { logs++; } }).debugLog('initialization');
  assert.equal(logs, enabled ? 1 : 0);
}

(async () => {
  let opened = 0;
  const present = async () => { opened++; return 'completed'; };
  const request = { placement: 'pack:refill', resourceId: 'preview' };
  assert.equal(await new PreviewRewardedVideoGateway(present, false).show(request), 'unavailable');
  assert.equal(opened, 0, 'disabled preview cannot open a modal or simulate completion');
  assert.equal(await new PreviewRewardedVideoGateway(present, true).show(request), 'completed');
  assert.equal(opened, 1);
  console.log('PASS: independent initial data, inventory/progress updates, validation/no overwrite, audio gain, logs, and ad preview gate. In-memory checks only.');
})().catch(error => { console.error(error); process.exitCode = 1; });
