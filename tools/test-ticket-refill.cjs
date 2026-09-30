const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('C:/ProgramData/cocos/editors/Creator/3.8.6/resources/resources/3d/engine/node_modules/typescript');

require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2018,
  } }).outputText;
  module._compile(compiled, filename);
};

const root = path.resolve(__dirname, '../assets/scripts/persistence');
const { CheckInStore } = require(path.join(root, 'CheckInStore.ts'));
const { PackStore } = require(path.join(root, 'PackStore.ts'));
const { TicketRefillStore } = require(path.join(root, 'TicketRefillStore.ts'));

function makeStorage() {
  const data = new Map();
  let failedWriteKey = null;
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      if (key === failedWriteKey) {
        failedWriteKey = null;
        throw new Error('simulated write failure');
      }
      data.set(key, value);
    },
    removeItem: (key) => data.delete(key),
    failNextWrite: (key) => { failedWriteKey = key; },
  };
}

function makeStores() {
  const storage = makeStorage();
  const tickets = new CheckInStore(storage);
  const packs = new PackStore(storage);
  const refill = new TicketRefillStore(storage, tickets, packs);
  return { storage, tickets, packs, refill };
}

function emptyFirstPack(packs) {
  for (let index = 0; index < 10; index += 1) assert.ok(packs.consumeSlot(index));
  assert.equal(packs.readPack().instanceId, 'wang-xi:1');
}

{
  const { tickets, packs, refill } = makeStores();
  emptyFirstPack(packs);
  assert.equal(refill.refill('wang-xi:1'), 'insufficient');
  assert.equal(packs.readPack().instanceId, 'wang-xi:1');
  assert.equal(tickets.readSnapshot().ticketBalance, 0);
}

{
  const { tickets, packs, refill } = makeStores();
  assert.equal(tickets.checkInToday(), 'checked');
  assert.equal(refill.refill('wang-xi:1'), 'invalid-pack');
  assert.equal(tickets.readSnapshot().ticketBalance, 1);
  assert.equal(packs.readPack().instanceId, 'wang-xi:1');
}

{
  const { tickets, packs, refill } = makeStores();
  emptyFirstPack(packs);
  assert.equal(tickets.checkInToday(), 'checked');
  assert.equal(refill.refill('wang-xi:1'), 'completed');
  assert.equal(packs.readPack().instanceId, 'wang-xi:2');
  assert.equal(packs.readPack().slots.filter((slot) => slot === 'available').length, 10);
  assert.equal(tickets.readSnapshot().ticketBalance, 0);
  assert.equal(refill.refill('wang-xi:1'), 'invalid-pack');
  assert.equal(tickets.readSnapshot().ticketBalance, 0);
}

{
  const { storage, tickets, packs, refill } = makeStores();
  emptyFirstPack(packs);
  assert.equal(tickets.checkInToday(), 'checked');
  storage.failNextWrite('smoke.pack.wang-xi.v2');
  assert.equal(refill.refill('wang-xi:1'), 'failed');
  assert.equal(refill.hasPending(), true);
  assert.equal(tickets.readSnapshot().ticketBalance, 0);
  assert.equal(packs.readPack().instanceId, 'wang-xi:1');
  const restartedTickets = new CheckInStore(storage);
  const restartedPacks = new PackStore(storage);
  const restartedRefill = new TicketRefillStore(storage, restartedTickets, restartedPacks);
  assert.equal(restartedRefill.recoverPending(), true);
  assert.equal(restartedRefill.hasPending(), false);
  assert.equal(restartedPacks.readPack().instanceId, 'wang-xi:2');
  assert.equal(restartedTickets.readSnapshot().ticketBalance, 0);
}

{
  const { storage, tickets, packs, refill } = makeStores();
  emptyFirstPack(packs);
  assert.equal(tickets.checkInToday(), 'checked');
  storage.failNextWrite('smoke.check-in.v1');
  assert.equal(refill.refill('wang-xi:1'), 'failed');
  assert.equal(refill.hasPending(), true);
  assert.equal(tickets.readSnapshot().ticketBalance, 1);
  assert.equal(packs.readPack().instanceId, 'wang-xi:1');
  assert.equal(refill.refill('wang-xi:1'), 'completed');
  assert.equal(tickets.readSnapshot().ticketBalance, 0);
  assert.equal(packs.readPack().instanceId, 'wang-xi:2');
}

console.log('Ticket refill tests passed');
