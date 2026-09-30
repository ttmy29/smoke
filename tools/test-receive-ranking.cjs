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

const { buildReceiveRanking, receivedGiftStatus } = require(path.resolve(__dirname,
  '../assets/scripts/ranking/ReceiveRankingModel.ts'));
const now = new Date('2026-09-30T12:00:00').getTime();
const at = (day) => new Date(`2026-09-${day}T12:00:00`).getTime();
const events = [
  { eventId: 'a-old', senderLocalId: 'sender-a', receivedAt: at('23'),
    nicknameSnapshot: '同名' },
  { eventId: 'a-new', senderLocalId: 'sender-a', receivedAt: at('30'),
    nicknameSnapshot: '同名', receiveAction: 'stored' },
  { eventId: 'b', senderLocalId: 'sender-b', receivedAt: at('29'),
    nicknameSnapshot: '同名', receiveAction: 'direct' },
  { eventId: 'cancelled', senderLocalId: 'sender-b', receivedAt: at('30'),
    nicknameSnapshot: '同名', cancelledAt: at('30') },
];
const seven = buildReceiveRanking(events, 'seven-days', now);
assert.deepEqual(seven.map((item) => [item.senderLocalId, item.count]),
  [['sender-a', 1], ['sender-b', 1]]);
assert.deepEqual(seven.map((item) => item.displayNickname), ['同名', '同名（2）']);
const all = buildReceiveRanking(events, 'all', now);
assert.deepEqual(all.map((item) => item.count), [2, 1]);
assert.equal(receivedGiftStatus(events[2]), '直接抽了');
assert.equal(receivedGiftStatus({ ...events[2], discardedAt: now }), '后来丢掉了');
console.log('receive ranking logic passed');
