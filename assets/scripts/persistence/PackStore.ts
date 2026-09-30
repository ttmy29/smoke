import type { KeyValueStorage } from './ProgressStore';

export type PackSlotState = 'available' | 'empty';

export interface PackSnapshot {
  version: 2;
  packId: 'wang-xi';
  /** A refill creates a new box; the previous box never becomes full again. */
  sequence: number;
  instanceId: string;
  /** The legacy box keeps its lid state on the box instance. */
  lidOpen: boolean;
  slots: PackSlotState[];
  /** Identifies a ticket-funded refill when a pending transaction is replayed. */
  lastRefillTransactionId?: string;
}

interface LegacyPackSnapshot {
  version: 1;
  packId: 'wang-xi';
  slots: PackSlotState[];
}

const STORAGE_KEY = 'smoke.pack.wang-xi.v2';
const LEGACY_STORAGE_KEY = 'smoke.pack.wang-xi.v1';
const SLOT_COUNT = 10;

function freshPack(sequence = 1, lastRefillTransactionId?: string): PackSnapshot {
  return {
    version: 2, packId: 'wang-xi', sequence,
    instanceId: `wang-xi:${sequence}`,
    lidOpen: false,
    slots: Array(SLOT_COUNT).fill('available'),
    lastRefillTransactionId,
  };
}

function validSlots(slots: unknown): slots is PackSlotState[] {
  return Array.isArray(slots) && slots.length === SLOT_COUNT
    && slots.every((slot) => slot === 'available' || slot === 'empty');
}

function parsePackSnapshot(value: unknown): PackSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const pack = value as Partial<PackSnapshot>;
  if (!(pack.version === 2 && pack.packId === 'wang-xi'
    && Number.isSafeInteger(pack.sequence) && (pack.sequence ?? 0) >= 1
    && pack.instanceId === `wang-xi:${pack.sequence}` && validSlots(pack.slots)
    && (pack.lastRefillTransactionId === undefined
      || (typeof pack.lastRefillTransactionId === 'string'
        && pack.lastRefillTransactionId.length > 0)))) return null;
  // Early V2 previews predate the lid field. Treat those boxes as sealed once,
  // then persist the explicit state on the first open/consume write.
  return { ...pack, lidOpen: pack.lidOpen === true, slots: [...pack.slots] } as PackSnapshot;
}

function isLegacyPackSnapshot(value: unknown): value is LegacyPackSnapshot {
  if (!value || typeof value !== 'object') return false;
  const pack = value as Partial<LegacyPackSnapshot>;
  return pack.version === 1 && pack.packId === 'wang-xi' && validSlots(pack.slots);
}

/** Local box inventory. An old V1 box is read without erasing its ten chosen holes. */
export class PackStore {
  constructor(private readonly storage: KeyValueStorage | null) {}

  /** Null means unavailable or corrupt, never an implicitly refilled pack. */
  public readPack(): PackSnapshot | null {
    try {
      if (!this.storage) return null;
      const raw = this.storage.getItem(STORAGE_KEY);
      if (raw !== null) {
        const parsed: unknown = JSON.parse(raw);
        return parsePackSnapshot(parsed);
      }
      const legacyRaw = this.storage.getItem(LEGACY_STORAGE_KEY);
      if (legacyRaw === null) return freshPack();
      const legacy: unknown = JSON.parse(legacyRaw);
      return isLegacyPackSnapshot(legacy)
        ? { ...freshPack(), slots: [...legacy.slots] } : null;
    } catch {
      return null;
    }
  }

  /** Direct selection confirms one available slot before the extraction animation. */
  public consumeSlot(index: number): PackSnapshot | null {
    if (!Number.isInteger(index) || index < 0 || index >= SLOT_COUNT) return null;
    const pack = this.readPack();
    if (!pack || pack.slots[index] !== 'available') return null;
    const slots = [...pack.slots];
    slots[index] = 'empty';
    return this.writePack({ ...pack, slots });
  }

  /** Opening belongs to the current box instance and survives returning home/reload. */
  public openLid(expectedInstanceId: string): PackSnapshot | null {
    const pack = this.readPack();
    if (!pack || pack.instanceId !== expectedInstanceId) return null;
    if (pack.lidOpen) return pack;
    return this.writePack({ ...pack, lidOpen: true });
  }

  /** Must only be called after the rewarded-ad adapter reports completed. */
  public refillAfterReward(expectedInstanceId: string): PackSnapshot | null {
    const pack = this.readPack();
    if (!pack || pack.instanceId !== expectedInstanceId || countAvailableSlots(pack) !== 0
      || pack.sequence >= Number.MAX_SAFE_INTEGER) return null;
    return this.writePack(freshPack(pack.sequence + 1));
  }

  /** Replaying the same ticket transaction returns its already-created box. */
  public refillAfterTicket(expectedInstanceId: string, transactionId: string): PackSnapshot | null {
    if (!transactionId) return null;
    const pack = this.readPack();
    if (!pack) return null;
    if (pack.lastRefillTransactionId === transactionId) return pack;
    if (pack.instanceId !== expectedInstanceId || countAvailableSlots(pack) !== 0
      || pack.sequence >= Number.MAX_SAFE_INTEGER) return null;
    return this.writePack(freshPack(pack.sequence + 1, transactionId));
  }

  private writePack(next: PackSnapshot): PackSnapshot | null {
    try {
      const encoded = JSON.stringify(next);
      this.storage!.setItem(STORAGE_KEY, encoded);
      return this.storage!.getItem(STORAGE_KEY) === encoded ? next : null;
    } catch {
      return null;
    }
  }
}

export function countAvailableSlots(pack: PackSnapshot): number {
  return pack.slots.filter((slot) => slot === 'available').length;
}

export function createBrowserPackStore(): PackStore {
  try {
    return new PackStore(window.localStorage);
  } catch {
    return new PackStore(null);
  }
}
