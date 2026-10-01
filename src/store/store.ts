import { useCallback, useSyncExternalStore } from 'react';

/**
 * Tiny in-memory collection store. All POC data is local mock data; nothing is persisted
 * beyond the browser tab (refresh restores the seed data).
 */
type Listener = () => void;
const collections = new Map<string, any[]>();
const listeners = new Map<string, Set<Listener>>();
const counters = new Map<string, number>();

function emit(name: string) {
  listeners.get(name)?.forEach((l) => l());
}

export function seedCollection<T>(name: string, seed: T[]) {
  if (!collections.has(name)) collections.set(name, seed);
}

export function getCollection<T = any>(name: string): T[] {
  return (collections.get(name) as T[]) ?? [];
}

export function setCollection<T>(name: string, rows: T[]) {
  collections.set(name, rows);
  emit(name);
}

/** Generates numbers like QT-26-00012. Counters start after the highest seeded number. */
export function nextNumber(prefix: string, seedStart = 0): string {
  const n = (counters.get(prefix) ?? seedStart) + 1;
  counters.set(prefix, n);
  return `${prefix}-26-${String(n).padStart(5, '0')}`;
}

export interface Collection<T extends { id: string }> {
  rows: T[];
  get: (id?: string) => T | undefined;
  add: (row: T) => void;
  update: (id: string, patch: Partial<T>) => void;
  remove: (id: string) => void;
  replace: (rows: T[]) => void;
}

/**
 * useCollection('salesOrders', seedRows) - shared across modules by name.
 * The seed is only applied by the first caller; later callers just read.
 */
export function useCollection<T extends { id: string }>(name: string, seed?: T[]): Collection<T> {
  if (seed) seedCollection(name, seed);
  const subscribe = useCallback(
    (cb: Listener) => {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name)!.add(cb);
      return () => listeners.get(name)!.delete(cb);
    },
    [name],
  );
  const rows = useSyncExternalStore(subscribe, () => getCollection<T>(name));
  return {
    rows,
    get: (id) => rows.find((r) => r.id === id),
    add: (row) => setCollection(name, [row, ...getCollection<T>(name)]),
    update: (id, patch) => setCollection(name, getCollection<T>(name).map((r) => (r.id === id ? { ...r, ...patch } : r))),
    remove: (id) => setCollection(name, getCollection<T>(name).filter((r) => r.id !== id)),
    replace: (next) => setCollection(name, next),
  };
}
