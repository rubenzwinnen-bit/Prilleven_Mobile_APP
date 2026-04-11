/**
 * RATINGS SERVICE
 *
 * Alle operaties rond sterrenwaarderingen.
 * Leest/schrijft naar de Supabase-tabel `ratings`.
 *
 * Functies:
 *   getAllRatings()                    — gemiddelde per recept
 *   getAverageRating(recipeId)        — gemiddelde voor één recept
 *   getUserRating(recipeId, user)     — de score die deze gebruiker gaf
 *   getAllUserRatings(user)           — alle scores van één gebruiker
 *   rateRecipe(recipeId, rating, user) — score instellen/updaten
 */

import { supabase } from '../lib/supabase';
import { cacheGet, cacheSet, cacheInvalidate } from './cache';
import type { RatingSummary } from '../types';

/** Haal de gemiddelde score + aantal op, per recept. */
export async function getAllRatings(): Promise<Record<string, RatingSummary>> {
  const cached = cacheGet<Record<string, RatingSummary>>('ratings:all');
  if (cached) return cached;

  const { data, error } = await supabase
    .from('ratings')
    .select('recipe_id,rating')
    .range(0, 99999);

  if (error) throw error;

  const buckets: Record<string, number[]> = {};
  for (const row of data || []) {
    if (!buckets[row.recipe_id]) buckets[row.recipe_id] = [];
    buckets[row.recipe_id].push(row.rating);
  }

  const result: Record<string, RatingSummary> = {};
  for (const [id, ratings] of Object.entries(buckets)) {
    const sum = ratings.reduce((a, b) => a + b, 0);
    result[id] = {
      average: Math.round((sum / ratings.length) * 10) / 10,
      count: ratings.length,
    };
  }
  cacheSet('ratings:all', result);
  return result;
}

/** Gemiddelde score voor één recept. */
export async function getAverageRating(recipeId: string): Promise<RatingSummary> {
  const all = cacheGet<Record<string, RatingSummary>>('ratings:all');
  if (all) return all[recipeId] || { average: 0, count: 0 };

  const { data, error } = await supabase
    .from('ratings')
    .select('rating')
    .eq('recipe_id', recipeId);

  if (error) throw error;
  if (!data || data.length === 0) return { average: 0, count: 0 };

  const sum = data.reduce((a, r) => a + r.rating, 0);
  return {
    average: Math.round((sum / data.length) * 10) / 10,
    count: data.length,
  };
}

/** De score die een specifieke gebruiker gaf aan een recept. */
export async function getUserRating(recipeId: string, user: string): Promise<number> {
  if (!user) return 0;

  const cached = cacheGet<Record<string, number>>(`ratings:user:${user}`);
  if (cached) return cached[recipeId] || 0;

  const { data, error } = await supabase
    .from('ratings')
    .select('rating')
    .eq('recipe_id', recipeId)
    .eq('user_name', user)
    .maybeSingle();

  if (error) throw error;
  return data?.rating ?? 0;
}

/** Alle scores van één gebruiker (recipe_id → rating). */
export async function getAllUserRatings(user: string): Promise<Record<string, number>> {
  if (!user) return {};

  const key = `ratings:user:${user}`;
  const cached = cacheGet<Record<string, number>>(key);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('ratings')
    .select('recipe_id,rating')
    .eq('user_name', user)
    .range(0, 9999);

  if (error) throw error;

  const map: Record<string, number> = {};
  for (const row of data || []) {
    map[row.recipe_id] = row.rating;
  }
  cacheSet(key, map);
  return map;
}

/** Beoordeel een recept (upsert: insert of update). */
export async function rateRecipe(recipeId: string, rating: number, user: string) {
  if (!user) throw new Error('Geen gebruikersnaam ingesteld.');

  const clamped = Math.min(5, Math.max(1, Math.round(rating)));

  const { error } = await supabase
    .from('ratings')
    .upsert(
      { recipe_id: recipeId, user_name: user, rating: clamped },
      { onConflict: 'recipe_id,user_name' }
    );

  if (error) throw error;
  cacheInvalidate('ratings:');
}
