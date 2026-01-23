import NodeCache from "node-cache";

// Cache em memória com TTL padrão de 5 minutos
const cache = new NodeCache({
  stdTTL: 300, // 5 minutos
  checkperiod: 60, // Verifica a cada 60 segundos
  useClones: false, // Performance: não clona objetos
});

export interface CacheOptions {
  ttl?: number; // Time to live em segundos
}

/**
 * Obtém valor do cache ou executa função e armazena resultado
 */
export async function getOrSet<T>(
  key: string,
  fn: () => Promise<T>,
  options?: CacheOptions
): Promise<T> {
  const cached = cache.get<T>(key);
  if (cached !== undefined) {
    return cached;
  }

  const value = await fn();
  cache.set(key, value, options?.ttl || 300);
  return value;
}

/**
 * Obtém valor do cache
 */
export function get<T>(key: string): T | undefined {
  return cache.get<T>(key);
}

/**
 * Define valor no cache
 */
export function set<T>(key: string, value: T, ttl?: number): boolean {
  return cache.set(key, value, ttl || 300);
}

/**
 * Remove valor do cache
 */
export function del(key: string): number {
  return cache.del(key);
}

/**
 * Limpa todo o cache
 */
export function flush(): void {
  cache.flushAll();
}

/**
 * Remove múltiplas chaves que correspondem ao padrão
 */
export function delPattern(pattern: string): number {
  const keys = cache.keys().filter((key) => key.includes(pattern));
  return keys.reduce((count, key) => count + cache.del(key), 0);
}
