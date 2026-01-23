"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrSet = getOrSet;
exports.get = get;
exports.set = set;
exports.del = del;
exports.flush = flush;
exports.delPattern = delPattern;
const node_cache_1 = __importDefault(require("node-cache"));
// Cache em memória com TTL padrão de 5 minutos
const cache = new node_cache_1.default({
    stdTTL: 300, // 5 minutos
    checkperiod: 60, // Verifica a cada 60 segundos
    useClones: false, // Performance: não clona objetos
});
/**
 * Obtém valor do cache ou executa função e armazena resultado
 */
async function getOrSet(key, fn, options) {
    const cached = cache.get(key);
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
function get(key) {
    return cache.get(key);
}
/**
 * Define valor no cache
 */
function set(key, value, ttl) {
    return cache.set(key, value, ttl || 300);
}
/**
 * Remove valor do cache
 */
function del(key) {
    return cache.del(key);
}
/**
 * Limpa todo o cache
 */
function flush() {
    cache.flushAll();
}
/**
 * Remove múltiplas chaves que correspondem ao padrão
 */
function delPattern(pattern) {
    const keys = cache.keys().filter((key) => key.includes(pattern));
    return keys.reduce((count, key) => count + cache.del(key), 0);
}
