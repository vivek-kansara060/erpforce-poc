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

/**
 * Demo clock. The seed data was written as if today were DEMO_BASE. When a collection is seeded, every date in it moves forward by the
 * days since then, so on any demo day expiries, holds, visits and reminders sit exactly as far from today as they were written.
 * Year-end dates (31 Dec, the Open PO default) are left as they are.
 */
const DEMO_BASE = '2026-09-30';
const DAY = 86_400_000;
const today = new Date();
const SHIFT_DAYS = Math.round((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - Date.parse(`${DEMO_BASE}T00:00:00Z`)) / DAY);
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?=$|[T ])/;
function shiftDate(s: string): string {
  const m = ISO_DATE.exec(s);
  if (!m || `${m[2]}-${m[3]}` === '12-31') return s;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) + SHIFT_DAYS * DAY);
  return d.toISOString().slice(0, 10) + s.slice(10);
}
function shiftDates<T>(v: T): T {
  if (typeof v === 'string') return shiftDate(v) as T;
  if (Array.isArray(v)) return v.map(shiftDates) as T;
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shiftDates(x)])) as T;
  return v;
}

export function seedCollection<T>(name: string, seed: T[]) {
  if (!collections.has(name)) collections.set(name, SHIFT_DAYS ? shiftDates(seed) : seed);
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
