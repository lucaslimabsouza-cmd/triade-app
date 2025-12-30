// src/cache/memoryCache.ts

export type CacheEntry<T> = {
  value: T;
  ts: number; // timestamp do cache (ms)
};

const store = new Map<string, CacheEntry<any>>();
const inflight = new Map<string, Promise<any>>();

export function cacheGet<T>(key: string): T | null {
  const hit = store.get(key);
  return hit ? (hit.value as T) : null;
}

export function cacheGetEntry<T>(key: string): CacheEntry<T> | null {
  const hit = store.get(key);
  return hit ? (hit as CacheEntry<T>) : null;
}

export function cacheHas(key: string, opts?: { ttlMs?: number }): boolean {
  const hit = store.get(key);
  if (!hit) return false;

  const ttlMs = opts?.ttlMs;
  if (!ttlMs) return true;

  const fresh = Date.now() - hit.ts <= ttlMs;
  return fresh;
}

export function cacheSet<T>(key: string, value: T) {
  store.set(key, { value, ts: Date.now() });
}

export function cacheClear(key?: string) {
  if (!key) {
    store.clear();
    inflight.clear();
    return;
  }
  store.delete(key);
  inflight.delete(key);
}

/**
 * Remove todas as chaves que começam com um prefixo.
 * Ex: invalidateByPrefix("operation-financial:")
 */
export function invalidateByPrefix(prefix: string) {
  if (!prefix) return;

  for (const k of store.keys()) {
    if (k.startsWith(prefix)) store.delete(k);
  }
  for (const k of inflight.keys()) {
    if (k.startsWith(prefix)) inflight.delete(k);
  }
}

/**
 * Pega do cache se existir; senão faz fetch, salva e retorna.
 * - Evita chamadas duplicadas com inflight.
 * - TTL opcional
 * - force: ignora cache e refaz fetch
 */
export async function getOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  opts?: { ttlMs?: number; force?: boolean }
): Promise<T> {
  const force = opts?.force ?? false;
  const ttlMs = opts?.ttlMs;

  if (!force) {
    const hit = store.get(key);
    if (hit) {
      if (!ttlMs) return hit.value as T;

      const fresh = Date.now() - hit.ts <= ttlMs;
      if (fresh) return hit.value as T;
    }
  }

  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;

  const p = (async () => {
    try {
      const value = await fetcher();
      cacheSet(key, value);
      return value;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, p);
  return p;
}
