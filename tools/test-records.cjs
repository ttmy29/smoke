const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('C:/ProgramData/cocos/editors/Creator/3.8.6/resources/resources/3d/engine/node_modules/typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(
  fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2018 } }).outputText, filename);
const root = path.resolve(__dirname, '../assets/scripts');
const { SmokingRecordStore, SMOKING_RECORD_STORAGE_KEY } = require(path.join(root, 'persistence/SmokingRecordStore.ts'));
const { ProgressStore } = require(path.join(root, 'persistence/ProgressStore.ts'));
const { CheckInStore } = require(path.join(root, 'persistence/CheckInStore.ts'));
const { QuitStore } = require(path.join(root, 'persistence/QuitStore.ts'));
const { createLocalRecordsSource, parseRecordsPrice, recordsDuration, recordedSavingsCount,
  RECORD_TABS, RECORD_EFFECT_TASKS } = require(path.join(root, 'records/RecordsModel.ts'));
function memory() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value),
    removeItem: key => data.delete(key) };
}
function stores() {
  const storage = memory();
  return { storage, smoking: new SmokingRecordStore(storage), progress: new ProgressStore(storage),
    checkin: new CheckInStore(storage), quit: new QuitStore(storage), completedPacks: () => 0 };
}
const at = day => new Date(2026, 9, day, 12).getTime();
const snapshot = { outcome: 'finished', elapsedSeconds: 61, inhaleCount: 4, ashFlickCount: 2, smokeRingCount: 1 };
const s = stores();
for (const [id, day] of [['old', 9], ['edge', 10], ['today', 16]]) {
  assert.equal(s.smoking.recordSession(id, 0, snapshot, at(day)), true);
  assert.equal(s.progress.recordCompletedCigarette(id, at(day)), s.smoking.read().totalCount);
}
assert.equal(s.smoking.recordSession('today', 0, snapshot, at(16)), true);
assert.equal(s.smoking.read().totalCount, 3, 'duplicate completion does not create another row');
assert.equal(s.smoking.recordSession('invalid', 10, snapshot, at(16)), false);
assert.equal(s.quit.confirmQuit('今天没抽', at(15)), 'saved');
assert.equal(s.quit.recordReal('real-one', false, at(16)), 'saved');
const source = createLocalRecordsSource(s);
const view = source.read(at(16));
assert.equal(view.todayCount, 1);
assert.equal(view.last7Count, 2, '7-day interval includes today and six prior local dates');
assert.equal(view.totalCount, 3);
assert.equal(view.totalPuffs, 12);
assert.equal(view.durationSeconds, 183);
assert.equal(view.sessions[0].id, 'today');
assert.equal(view.favoritePack, '王溪');
assert.equal(view.quitDays.length, 2);
assert.equal(view.quitDays[0].count, 1);
assert.equal(view.quitDays[0].costCents, null);
assert.equal(view.quitTotal, 1);
assert.equal(source.setPackPrice(2000), true);
assert.equal(source.read(at(16)).packPriceCents, 2000);
assert.equal(source.read(at(16)).savingsCount, 3);
assert.equal(source.read(at(16)).estimatedSavedCents, 300);
assert.equal(source.setPackPrice(null), true);
assert.equal(source.read(at(16)).estimatedSavedCents, null);
assert.equal(s.smoking.setPackPrice(0), false);
assert.equal(source.completeTask, undefined, 'unimplemented rewards cannot be marked completed');
assert.deepEqual(RECORD_TABS.map(item => item.label), ['打卡', '抽烟', '戒烟', '任务', '烟票']);
assert.equal(RECORD_EFFECT_TASKS.length, 9);
assert.equal(RECORD_EFFECT_TASKS.find(item => item.id === 'T05').goals[0].target, 5);
assert.equal(recordsDuration(61), '1 分 1 秒');
assert.equal(recordsDuration(120), '2 分钟');
assert.equal(recordsDuration(null), '—');
assert.equal(parseRecordsPrice('  ').cents, null);
assert.equal(parseRecordsPrice('0.01').cents, 1);
assert.equal(parseRecordsPrice('10000').cents, 1000000);
for (const value of ['0', '-1', '1.001', '10000.01', 'x']) assert.ok(parseRecordsPrice(value).error);

const legacy = stores();
assert.equal(legacy.progress.initializePreview(42, at(16)), true);
assert.equal(legacy.checkin.initializePreview({ cumulativeDays: 3, streak: 2,
  ticketBalance: 10, checkedToday: false }, at(16)), true);
const missing = createLocalRecordsSource(legacy).read(at(16));
assert.equal(missing.totalCount, 42);
assert.equal(missing.last7Count, null);
assert.equal(missing.totalPuffs, null);
assert.equal(missing.sessions.length, 0, 'seed and old totals do not fabricate session history');
assert.equal(missing.ledger.length, 0, 'seed balance does not fabricate ledger rows');
assert.equal(missing.ledgerIncomplete, true);
assert.equal(missing.savingsCount, 0, 'seed lifetime total is not evidence of completed sessions');
const legacySource = createLocalRecordsSource(legacy);
assert.equal(legacySource.setPackPrice(2000), true);
assert.equal(legacySource.read(at(16)).estimatedSavedCents, 0, '42 seeded cigarettes must not generate an estimate');
const todayRecord = s.smoking.read().sessions.find(item => item.id === 'today');
assert.equal(recordedSavingsCount({ sessions: [todayRecord],
  dayCounts: { '2026-10-09': 40, '2026-10-16': 1, '2026-10-17': 2 } }, at(16)), 41,
'past date aggregates remain valid when older row details were evicted; future dates are excluded');
assert.equal(recordedSavingsCount({ sessions: [{ ...todayRecord, endedAt: at(16) + 1000 }],
  dayCounts: { '2026-10-16': 1 } }, at(16)), 0, 'future timestamps today are excluded');
assert.equal(recordedSavingsCount({ sessions: [todayRecord], dayCounts: { '2026-10-16': 2 } }, at(16)), null,
'evicted same-day timestamps must not be guessed');

const tickets = new CheckInStore(memory());
assert.equal(tickets.checkInToday(at(16)), 'checked');
assert.equal(tickets.checkInToday(at(16)), 'already-checked');
assert.equal(tickets.claimExtraTicket(at(16)), true);
assert.equal(tickets.claimExtraTicket(at(16)), false);
assert.equal(tickets.spendTicketForRefill('refill:one'), true);
assert.equal(tickets.spendTicketForRefill('refill:one'), true);
assert.equal(tickets.readHistory().ledger.length, 3, 'reward and refill replays do not duplicate ledger entries');
assert.equal(tickets.readSnapshot(at(16)).ticketBalance, 1);
const many = new CheckInStore(memory());
for (let i = 0; i < 205; i++) assert.equal(many.checkInToday(new Date(2025, 0, i + 1, 12).getTime()), 'checked');
assert.equal(many.readHistory().ledger.length, 200);
assert.equal(many.readHistory().archived, true);
assert.equal(many.readSnapshot().ticketBalance, 205, 'bounded history never rewrites the balance');
s.storage.setItem(SMOKING_RECORD_STORAGE_KEY, '{bad');
assert.equal(source.read(at(16)), null, 'bad storage yields an error state without overwriting data');
assert.equal(s.storage.getItem(SMOKING_RECORD_STORAGE_KEY), '{bad');
console.log('PASS: real session and ticket history, deduplication, 7-day counts, partial legacy history, quit grouping, price rules, and task reward boundary. In-memory checks only.');
