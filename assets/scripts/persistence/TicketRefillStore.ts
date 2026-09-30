import type { KeyValueStorage } from './ProgressStore';
import { CheckInStore } from './CheckInStore';
import { countAvailableSlots, PackStore } from './PackStore';

export const TICKET_REFILL_PENDING_KEY = 'smoke.refill.ticket.pending.v1';

interface PendingTicketRefill {
  version: 1;
  packInstanceId: string;
  nextInstanceId: string;
  transactionId: string;
}

export type TicketRefillResult = 'completed' | 'insufficient' | 'invalid-pack' | 'failed';

/** A write-ahead record lets a ticket debit and box refill finish after an interruption. */
export class TicketRefillStore {
  constructor(private readonly storage: KeyValueStorage | null,
    private readonly tickets: CheckInStore, private readonly packs: PackStore) {}

  public hasPending(): boolean {
    if (!this.storage) return false;
    try { return this.storage.getItem(TICKET_REFILL_PENDING_KEY) !== null; } catch { return true; }
  }

  public recoverPending(): boolean {
    try {
      const raw = this.storage?.getItem(TICKET_REFILL_PENDING_KEY);
      if (raw === null || raw === undefined) return this.storage !== null;
      const pending: unknown = JSON.parse(raw);
      if (!this.isPending(pending)) return false;
      const pack = this.packs.readPack();
      if (!pack) return false;
      const oldEmpty = pack.instanceId === pending.packInstanceId
        && countAvailableSlots(pack) === 0;
      const newByTicket = pack.instanceId === pending.nextInstanceId
        && pack.lastRefillTransactionId === pending.transactionId;
      if (!oldEmpty && !newByTicket) return false;
      if (!this.tickets.spendTicketForRefill(pending.transactionId)) return false;
      if (!this.packs.refillAfterTicket(pending.packInstanceId, pending.transactionId)) return false;
      this.storage!.removeItem(TICKET_REFILL_PENDING_KEY);
      return this.storage!.getItem(TICKET_REFILL_PENDING_KEY) === null;
    } catch {
      return false;
    }
  }

  public refill(packInstanceId: string): TicketRefillResult {
    const existingPending = this.readPending();
    if (!this.recoverPending()) return 'failed';
    if (existingPending?.packInstanceId === packInstanceId
      && this.packs.readPack()?.lastRefillTransactionId === existingPending.transactionId) return 'completed';
    const pack = this.packs.readPack();
    if (!pack || pack.instanceId !== packInstanceId || countAvailableSlots(pack) !== 0
      || pack.sequence >= Number.MAX_SAFE_INTEGER) return 'invalid-pack';
    const ticketBalance = this.tickets.readSnapshot()?.ticketBalance;
    if (ticketBalance === undefined) return 'failed';
    if (ticketBalance < 1) return 'insufficient';
    const pending: PendingTicketRefill = {
      version: 1, packInstanceId, nextInstanceId: `wang-xi:${pack.sequence + 1}`,
      transactionId: `refill:${packInstanceId}`,
    };
    try {
      const encoded = JSON.stringify(pending);
      this.storage!.setItem(TICKET_REFILL_PENDING_KEY, encoded);
      if (this.storage!.getItem(TICKET_REFILL_PENDING_KEY) !== encoded) return 'failed';
    } catch {
      return 'failed';
    }
    return this.recoverPending() ? 'completed' : 'failed';
  }

  private readPending(): PendingTicketRefill | null {
    try {
      const raw = this.storage?.getItem(TICKET_REFILL_PENDING_KEY);
      if (!raw) return null;
      const value: unknown = JSON.parse(raw);
      return this.isPending(value) ? value : null;
    } catch {
      return null;
    }
  }

  private isPending(value: unknown): value is PendingTicketRefill {
    if (!value || typeof value !== 'object') return false;
    const pending = value as Partial<PendingTicketRefill>;
    const match = typeof pending.packInstanceId === 'string'
      ? /^wang-xi:([1-9]\d*)$/.exec(pending.packInstanceId) : null;
    if (!match) return false;
    const sequence = Number(match[1]);
    return pending.version === 1 && Number.isSafeInteger(sequence)
      && sequence < Number.MAX_SAFE_INTEGER
      && pending.nextInstanceId === `wang-xi:${sequence + 1}`
      && pending.transactionId === `refill:${pending.packInstanceId}`;
  }
}

export function createBrowserTicketRefillStore(tickets: CheckInStore, packs: PackStore): TicketRefillStore {
  try { return new TicketRefillStore(window.localStorage, tickets, packs); }
  catch { return new TicketRefillStore(null, tickets, packs); }
}
