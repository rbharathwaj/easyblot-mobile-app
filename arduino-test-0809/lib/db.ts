/**
 * Minimal persistence layer.
 *
 * Everything is async on purpose. Today it reads and writes localStorage;
 * swapping in IndexedDB or `fetch('/api/...')` means rewriting only this file,
 * because no caller assumes the data is available synchronously.
 */

const NS = 'easyblot:v1:';
const isBrowser = () => typeof window !== 'undefined';

export async function get<T>(key: string, fallback: T): Promise<T> {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(NS + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    // Corrupt or unreadable (private mode, quota) — fail soft rather than
    // taking the whole app down over a cache read.
    return fallback;
  }
}

export async function set<T>(key: string, value: T): Promise<void> {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(NS + key, JSON.stringify(value));
  } catch (err) {
    console.warn('[easyblot] could not persist', key, err);
  }
}

export async function remove(key: string): Promise<void> {
  if (!isBrowser()) return;
  window.localStorage.removeItem(NS + key);
}

/** Wipes every EasyBlot key — used by "Reset local data" in Settings. */
export async function clearAll(): Promise<void> {
  if (!isBrowser()) return;
  const doomed: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k && k.startsWith(NS)) doomed.push(k);
  }
  doomed.forEach((k) => window.localStorage.removeItem(k));
}

export const KEYS = {
  users: 'users',
  session: 'session',
  forum: 'forum',
  userData: (id: string) => `data:${id}`,
};
