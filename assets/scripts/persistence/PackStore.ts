import type { KeyValueStorage } from './ProgressStore';

export type PackSlotState = 'available' | 'empty';

export interface PackSnapshot {
  version: 1;
  packId: 'wang-xi';
  slots: PackSlotState[];
}

const STORAGE_KEY = 'smoke.pack.wang-xi.v1';
const SLOT_COUNT = 10;

function freshPack(): PackSnapshot {
  return { version: 1, packId: 'wang-xi', slots: Array(SLOT_COUNT).fill('available') };
}

function isPackSnapshot(value: unknown): value is PackSnapshot {
  if (!value || typeof value !== 'object') return false;
  const pack = value as Partial<PackSnapshot>;
  return pack.version === 1 && pack.packId === 'wang-xi'
    && Array.isArray(pack.slots) && pack.slots.length === SLOT_COUNT
    && pack.slots.every((slot) => slot === 'available' || slot === 'empty');
}

/** Separate from lifetime statistics: arbitrary holes cannot be recovered from a count. */
export class PackStore {
  constructor(private readonly storage: KeyValueStorage | null) {}

  /** Null means unavailable or corrupt, never an implicitly refilled pack. */
  public readPack(): PackSnapshot | null {
    try {
      if (!this.storage) return null;
      const raw = this.storage.getItem(STORAGE_KEY);
      if (raw === null) return freshPack();
      const parsed: unknown = JSON.parse(raw);
      return isPackSnapshot(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  /** Direct selection confirms one available slot before the extraction animation. */
  public consumeSlot(index: number): PackSnapshot | null {
    if (!Number.isInteger(index) || index < 0 || index >= SLOT_COUNT) return null;
    try {
      const pack = this.readPack();
      if (!pack || pack.slots[index] !== 'available') return null;
      const slots = [...pack.slots];
      slots[index] = 'empty';
      const next: PackSnapshot = { version: 1, packId: 'wang-xi', slots };
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
