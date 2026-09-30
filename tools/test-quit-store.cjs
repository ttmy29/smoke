const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('C:/ProgramData/cocos/editors/Creator/3.8.6/resources/resources/3d/engine/node_modules/typescript');

require.extensions['.ts'] = (module, filename) => {
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2018,
  } }).outputText;
  module._compile(compiled, filename);
};

const { QuitStore, QUIT_STORAGE_KEY } = require(path.resolve(__dirname,
  '../assets/scripts/persistence/QuitStore.ts'));
const { buildQuitTrend } = require(path.resolve(__dirname,
  '../assets/scripts/quit/QuitTrendModel.ts'));
const day = (date) => new Date(`${date}T12:00:00`).getTime();
const data = new Map();
let fail = false;
const storage = {
  getItem: (key) => data.get(key) ?? null,
  setItem: (key, value) => { if (fail) { fail = false; throw Error('full'); } data.set(key, value); },
  removeItem: (key) => data.delete(key),
};
const store = new QuitStore(storage);
const monday = day('2026-09-28');
const tuesday = day('2026-09-29');
const wednesday = day('2026-09-30');

assert.equal(store.readSnapshot(monday).todayCostCents, 0);
assert.equal(store.confirmQuit('  第一天  ', monday), 'saved');
assert.equal(store.readSnapshot(monday).light, true);
assert.equal(store.confirmQuit('第一天', monday), 'unchanged');
assert.equal(store.confirmQuit('第二天', tuesday), 'saved');
assert.deepEqual([store.readSnapshot(tuesday).totalDays, store.readSnapshot(tuesday).currentStreak,
  store.readSnapshot(tuesday).longestStreak], [2, 2, 2]);
assert.equal(store.recordReal('a', false, tuesday), 'conflict');
assert.equal(store.recordReal('a', true, tuesday, monday), 'conflict');
assert.equal(store.recordReal('a', true, tuesday), 'saved');
assert.equal(store.readSnapshot(tuesday).light, true);
assert.equal(store.recordReal('a', true, tuesday), 'unchanged');
assert.equal(store.readSnapshot(tuesday).confirmed, false);
assert.equal(store.readSnapshot(tuesday).records.length, 1);
assert.equal(store.readSnapshot(tuesday).todayCostCents, null);
assert.equal(store.readSnapshot(wednesday).lastRealAt, tuesday);
assert.equal(store.confirmQuit('', tuesday), 'conflict');
assert.equal(store.undoReal('a', wednesday), 'missing');
assert.equal(store.undoReal('a', tuesday), 'saved');
assert.equal(store.readSnapshot(tuesday).confirmed, false);
assert.equal(store.confirmQuit('恢复', tuesday), 'saved');
assert.equal(store.cancelQuit(tuesday), 'saved');
assert.equal(store.readSnapshot(wednesday).currentStreak, 0);
assert.equal(store.readSnapshot(wednesday).longestStreak, 1);
assert.equal(store.confirmQuit('x'.repeat(201), wednesday), 'failed');
assert.equal(store.savePrice(2000, 20), 'saved');
assert.equal(store.recordReal('priced', false, wednesday), 'saved');
assert.equal(store.readSnapshot(wednesday).todayCostCents, 100);
assert.equal(store.savePrice(4000, 20), 'saved');
assert.equal(store.readSnapshot(wednesday).todayCostCents, 100);
assert.equal(store.undoReal('priced', wednesday), 'saved');
assert.equal(store.readHistory().real.length, 0);
const backfillData = new Map();
const backfillStore = new QuitStore({
  getItem: (key) => backfillData.get(key) ?? null,
  setItem: (key, value) => backfillData.set(key, value),
  removeItem: (key) => backfillData.delete(key),
});
assert.equal(backfillStore.recordReal('unpriced', false, wednesday), 'saved');
assert.equal(backfillStore.readSnapshot(wednesday).todayCostCents, null);
assert.equal(backfillStore.savePrice(2000, 20), 'saved');
assert.equal(backfillStore.readSnapshot(wednesday).todayCostCents, 100);
const zeroData = new Map();
const zeroStore = new QuitStore({
  getItem: (key) => zeroData.get(key) ?? null,
  setItem: (key, value) => zeroData.set(key, value),
  removeItem: (key) => zeroData.delete(key),
});
assert.equal(zeroStore.recordReal('zero-backfill', false, wednesday), 'saved');
assert.equal(zeroStore.readSnapshot(wednesday).todayCostCents, null);
assert.equal(zeroStore.savePrice(0, 20), 'saved');
assert.equal(zeroStore.readSnapshot(wednesday).packPriceCents, 0);
assert.equal(zeroStore.readSnapshot(wednesday).todayCostCents, 0);
assert.equal(zeroStore.recordReal('zero-priced', false, wednesday + 1000), 'saved');
assert.equal(zeroStore.readSnapshot(wednesday).todayCostCents, 0);
const revisionData = new Map();
const revisionStore = new QuitStore({
  getItem: (key) => revisionData.get(key) ?? null,
  setItem: (key, value) => revisionData.set(key, value),
});
assert.equal(revisionStore.confirmQuit('首次确认', monday), 'saved');
assert.equal(revisionStore.readHistory().quit[0].revision, 1);
assert.equal(revisionStore.readHistory().quit[0].firstConfirmedAt, monday);
assert.equal(revisionStore.confirmQuit('更新感受', monday + 1000), 'saved');
assert.equal(revisionStore.readHistory().quit[0].revision, 2);
assert.equal(revisionStore.readHistory().quit[0].firstConfirmedAt, monday);
assert.equal(revisionStore.readHistory().quit[0].confirmedAt, monday + 1000);
const confirmedTrend = buildQuitTrend(revisionStore.readHistory(), 7, wednesday);
assert.deepEqual(confirmedTrend.days.slice(-3).map((item) => item.count), [0, null, null]);
assert.equal(confirmedTrend.totalCostCents, 0);
const zeroTrend = buildQuitTrend(zeroStore.readHistory(), 7, wednesday);
assert.equal(zeroTrend.days[6].count, 2);
assert.equal(zeroTrend.days[6].costCents, 0);
const unknownData = new Map();
const unknownStore = new QuitStore({
  getItem: (key) => unknownData.get(key) ?? null,
  setItem: (key, value) => unknownData.set(key, value),
});
assert.equal(unknownStore.recordReal('unknown', false, wednesday), 'saved');
const unknownTrend = buildQuitTrend(unknownStore.readHistory(), 7, wednesday);
assert.equal(unknownTrend.days[6].costCents, null);
assert.equal(unknownTrend.unknownCosts, true);
const roundingData = new Map();
const roundingStore = new QuitStore({
  getItem: (key) => roundingData.get(key) ?? null,
  setItem: (key, value) => roundingData.set(key, value),
});
assert.equal(roundingStore.savePrice(1, 2), 'saved');
assert.equal(roundingStore.recordReal('round-one', false, monday), 'saved');
assert.equal(roundingStore.recordReal('round-two', false, tuesday), 'saved');
assert.equal(buildQuitTrend(roundingStore.readHistory(), 7, wednesday).totalCostCents, 1);
fail = true;
assert.equal(store.confirmQuit('第三天', wednesday), 'failed');
assert.equal(store.readSnapshot(wednesday).confirmed, false);
data.set(QUIT_STORAGE_KEY, '{invalid');
assert.equal(store.readSnapshot(wednesday), null);
assert.equal(store.recordReal('b', false, wednesday), 'failed');
assert.equal(data.get(QUIT_STORAGE_KEY), '{invalid');
data.set(QUIT_STORAGE_KEY, JSON.stringify({ version: 1,
  real: [{ id: 'x', at: wednesday, undone: false }],
  quit: [{ day: '2026-09-30', feeling: '', confirmedAt: wednesday, cancelled: false }] }));
assert.equal(store.readSnapshot(wednesday), null);
console.log('quit store logic passed');
