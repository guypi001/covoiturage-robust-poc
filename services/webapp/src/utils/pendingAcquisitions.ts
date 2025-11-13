import type { AccountType } from '../api';

export type PendingAcquisition = {
  id: string;
  rideId: string;
  driverId: string;
  driverType: AccountType;
  driverLabel: string;
  originCity: string;
  destinationCity: string;
  departureAt: string;
  pricePerSeat?: number;
  lastMessagePreview?: string;
  createdAt: string;
};

const STORAGE_KEY = 'kari_pending_acquisitions_v1';

type StorageShape = Record<string, PendingAcquisition[]>;

function safeParse(value: string | null): StorageShape {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object') {
      return parsed as StorageShape;
    }
  } catch {
    return {};
  }
  return {};
}

function readStorage(): StorageShape {
  if (typeof window === 'undefined') return {};
  try {
    return safeParse(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return {};
  }
}

function writeStorage(data: StorageShape) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore quota errors
  }
}

function emitChange(ownerId: string) {
  if (typeof window === 'undefined' || !ownerId) return;
  try {
    window.dispatchEvent(new CustomEvent('kari:pendingAcquisitions', { detail: { ownerId } }));
  } catch {
    // ignore
  }
}

export function getPendingAcquisitions(ownerId: string): PendingAcquisition[] {
  if (!ownerId) return [];
  const data = readStorage();
  return data[ownerId] ?? [];
}

type UpsertPayload = Omit<PendingAcquisition, 'id' | 'createdAt'> & {
  id?: string;
  createdAt?: string;
};

export function upsertPendingAcquisition(ownerId: string, payload: UpsertPayload) {
  if (!ownerId) return;
  const data = readStorage();
  const existing = data[ownerId] ?? [];
  const id = payload.id ?? `${payload.rideId}:${payload.driverId}`;
  const createdAt = payload.createdAt ?? new Date().toISOString();
  const nextItem: PendingAcquisition = {
    id,
    createdAt,
    ...payload,
  } as PendingAcquisition;
  const filtered = existing.filter((item) => item.id !== id);
  data[ownerId] = [nextItem, ...filtered].slice(0, 25);
  writeStorage(data);
  emitChange(ownerId);
}

export function removePendingAcquisition(ownerId: string, id: string) {
  if (!ownerId) return;
  const data = readStorage();
  const existing = data[ownerId];
  if (!existing) return;
  data[ownerId] = existing.filter((item) => item.id !== id);
  writeStorage(data);
  emitChange(ownerId);
}

export function clearPendingByRideIds(ownerId: string, rideIds: string[]) {
  if (!ownerId || !rideIds.length) return;
  const data = readStorage();
  const existing = data[ownerId];
  if (!existing) return;
  const rideSet = new Set(rideIds);
  const filtered = existing.filter((item) => !rideSet.has(item.rideId));
  if (filtered.length === existing.length) return;
  data[ownerId] = filtered;
  writeStorage(data);
  emitChange(ownerId);
}
