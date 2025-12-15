// Backend/services/cacheService.js

/**
 * Cache bem simples em memória.
 * - key: string
 * - value: qualquer coisa serializável
 * - ttlSeconds: tempo de vida em segundos
 *
 * Obs: é resetado quando o processo Node reinicia.
 */

const cacheStore = {};

/**
 * Salva um valor no cache com expiração.
 */
function setCache(key, value, ttlSeconds = 900) {
  if (!key) return;

  const expiresAt = Date.now() + ttlSeconds * 1000;

  cacheStore[key] = {
    value,
    expiresAt,
  };

  // Log opcional
  console.log(`🧊 [CACHE SET] key="${key}" ttl=${ttlSeconds}s`);
}

/**
 * Lê um valor do cache.
 * - Se expirou, apaga e retorna null.
 */
function getCache(key) {
  if (!key) return null;

  const entry = cacheStore[key];
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    // expirou
    delete cacheStore[key];
    console.log(`🧊 [CACHE EXPIRED] key="${key}"`);
    return null;
  }

  // Log opcional (pode comentar se encher o saco)
  console.log(`🧊 [CACHE HIT] key="${key}"`);
  return entry.value;
}

/**
 * Limpa uma chave específica do cache.
 */
function clearCache(key) {
  if (!key) return;
  delete cacheStore[key];
  console.log(`🧊 [CACHE CLEAR] key="${key}"`);
}

/**
 * Limpa TODO o cache.
 */
function clearAllCache() {
  Object.keys(cacheStore).forEach((k) => delete cacheStore[k]);
  console.log("🧊 [CACHE CLEAR ALL]");
}

module.exports = {
  setCache,
  getCache,
  clearCache,
  clearAllCache,
};
