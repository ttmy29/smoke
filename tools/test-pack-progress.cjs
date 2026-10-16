const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('C:/ProgramData/cocos/editors/Creator/3.8.6/resources/resources/3d/engine/node_modules/typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(
  fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2018,
  } }).outputText, filename);
const root = path.resolve(__dirname, '../assets/scripts');
const { CheckInStore, CHECK_IN_STORAGE_KEY } = require(path.join(root, 'persistence/CheckInStore.ts'));
const { AchievementStore } = require(path.join(root, 'persistence/AchievementStore.ts'));
const { ACHIEVEMENT_GROUPS } = require(path.join(root, 'achievement/AchievementCatalog.ts'));
const { createPackUnlockProgressReader } = require(path.join(root, 'packs/PackUnlockProgress.ts'));
const data = new Map();
const storage = { getItem: key => data.get(key) ?? null,
  setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
const at = day => new Date(2026, 9, day, 12).getTime();
const checkin = new CheckInStore(storage);
for (let day = 1; day <= 8; day++) assert.equal(checkin.checkInToday(at(day)), 'checked');
assert.equal(checkin.readSnapshot(at(12)).streak, 0);
assert.equal(checkin.readLongestKnownStreak(), 8, 'a gap cannot reset catalogue progress');
assert.equal(checkin.checkInToday(at(12)), 'checked');
assert.equal(new CheckInStore(storage).readLongestKnownStreak(), 8, 'peak survives restart and a new run');
assert.equal(checkin.checkInToday(at(12)), 'already-checked');

// An old save lacks maxStreak. Recover only evidence actually present in its ledger.
const legacy = JSON.parse(data.get(CHECK_IN_STORAGE_KEY));
delete legacy.maxStreak;
data.set(CHECK_IN_STORAGE_KEY, JSON.stringify(legacy));
assert.equal(checkin.readLongestKnownStreak(), 8);
assert.equal(checkin.checkInToday(at(13)), 'checked');
assert.equal(JSON.parse(data.get(CHECK_IN_STORAGE_KEY)).maxStreak, 8);
const withoutHistory = { ...legacy, ledger: undefined, streak: 4 };
data.set(CHECK_IN_STORAGE_KEY, JSON.stringify(withoutHistory));
assert.equal(checkin.readSnapshot(at(20)).streak, 0);
assert.equal(checkin.readLongestKnownStreak(), 4, 'expired stored streak remains historical evidence');
assert.equal(checkin.checkInToday(at(20)), 'checked');
assert.equal(checkin.readLongestKnownStreak(), 4);

const achievements = new AchievementStore(storage);
const ids = ACHIEVEMENT_GROUPS.flatMap(group => group.items.map(item => item.id)).slice(0, 14);
for (const id of ids) assert(achievements.recordProgress(id, 1, 1, at(1)));
for (const id of ids) achievements.markRead(id);
assert.equal(achievements.hasUnread(), false);
let sessions = 14;
const reader = createPackUnlockProgressReader({
  readCompletedAchievements: () => achievements.readResults()?.filter(item => item.completed).length ?? null,
  readMaxCheckinStreak: () => checkin.readLongestKnownStreak(),
  readCompletedSessions: () => sessions,
});
const before = JSON.stringify([...data]);
assert.deepEqual(reader('neon-bridge'), { unlocked: false, target: 30, progress: 14 }, 'completed count is independent of unread');
assert.deepEqual(reader('night-voyage'), { unlocked: false, target: 2, progress: 2 });
assert.deepEqual(reader('slow-tide'), { unlocked: false, target: 7, progress: 4 });
assert.deepEqual(reader('red-equator'), { unlocked: false, target: 14, progress: 4 });
assert.deepEqual(reader('zero-hour'), { unlocked: false, target: 50, progress: 14 });
sessions = 100;
assert.deepEqual(reader('zero-hour'), { unlocked: false, target: 50, progress: 50 }, 'clamp without granting unlock');
assert.deepEqual(reader('fog-harbor'), { unlocked: false, target: 10, progress: undefined });
assert.equal(reader('flowing-gold'), null, 'exchange has no task fraction');
assert.equal(reader('shadowless'), null);
assert.equal(reader('toString'), null);
assert.equal(JSON.stringify([...data]), before, 'reading fractions never writes inventory or unlock state');
const unknown = createPackUnlockProgressReader({ readCompletedAchievements: () => { throw new Error('read failed'); },
  readMaxCheckinStreak: () => null, readCompletedSessions: () => -1, readShareCount: () => 0 });
assert.equal(unknown('neon-bridge').progress, undefined);
assert.equal(unknown('red-equator').progress, undefined);
assert.equal(unknown('zero-hour').progress, undefined);
assert.equal(unknown('fog-harbor').progress, 0, 'a known zero differs from missing data');
assert.equal(new CheckInStore(null).readLongestKnownStreak(), null);
data.set(CHECK_IN_STORAGE_KEY, 'corrupt');
assert.equal(checkin.readLongestKnownStreak(), null);
console.log('PASS: 14/30 completed achievements, clamped task fractions, live reads, no unlock writes, unknown sources, and historical check-in peaks across gaps/restarts/old saves.');
