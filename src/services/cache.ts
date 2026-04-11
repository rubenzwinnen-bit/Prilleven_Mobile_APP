/**
 * CACHE
 *
 * Lichte in-memory cache met een configureerbare TTL (standaard 30 s).
 * Wordt gedeeld door alle service-bestanden zodat navigatie snel
 * blijft zonder dubbele fetches.
 *
 * Gebruik:
 *   import { cacheGet, cacheSet, cacheInvalidate, clearCache } from './cache';
 *
 *   const data = cacheGet<Recipe[]>('recipes:all');
 *   cacheSet('recipes:all', data);
 *   cacheInvalidate('recipes:');     // verwijdert alle keys met prefix
 *   clearCache();                     // alles wissen
 */

const CACHE_TTL = 30_000; // 30 seconden

const _cache = new Map<string, { v: any; t: number }>();

/** Haal een waarde op. Retourneert `undefined` als verlopen of niet gevonden. */
export function cacheGet<T>(key: string): T | undefined {
  const entry = _cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.t > CACHE_TTL) {
    _cache.delete(key);
    return undefined;
  }
  return entry.v as T;
}

/** Sla een waarde op met timestamp. */
export function cacheSet(key: string, value: any): void {
  _cache.set(key, { v: value, t: Date.now() });
}

/** Verwijder alle keys met het opgegeven prefix, of alles als `prefix` leeg is. */
export function cacheInvalidate(prefix?: string): void {
  if (!prefix) {
    _cache.clear();
    return;
  }
  for (const key of [..._cache.keys()]) {
    if (key.startsWith(prefix)) _cache.delete(key);
  }
}

/** Wis de gehele cache (alias voor cacheInvalidate zonder argument). */
export function clearCache(): void {
  cacheInvalidate();
}
