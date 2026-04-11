/**
 * FAVORITES SERVICE
 *
 * Alles rond favoriete recepten per gebruiker.
 * Leest/schrijft naar de Supabase-tabel `favorites`.
 *
 * Functies:
 *   getFavoriteRecipeIds(user)    — lijst van recept-IDs
 *   isFavorite(recipeId, user)    — is dit recept een favoriet?
 *   toggleFavorite(recipeId, user) — favoriet aan/uit zetten
 *   getFavoriteRecipes(user)      — volledige recept-objecten
 */

import { supabase } from '../lib/supabase';
import { cacheGet, cacheSet, cacheInvalidate } from './cache';
import { getRecipesByIds } from './recipes';
import type { Recipe } from '../types';

/** Alle recept-IDs die de gebruiker als favoriet heeft (gecached). */
export async function getFavoriteRecipeIds(user: string): Promise<string[]> {
  if (!user) return [];

  const key = `favorites:${user}`;
  const cached = cacheGet<string[]>(key);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('favorites')
    .select('recipe_id')
    .eq('user_name', user)
    .range(0, 9999);

  if (error) throw error;

  const ids = (data || []).map((f: any) => f.recipe_id);
  cacheSet(key, ids);
  return ids;
}

/** Check of een recept een favoriet is van de gebruiker. */
export async function isFavorite(recipeId: string, user: string): Promise<boolean> {
  const ids = await getFavoriteRecipeIds(user);
  return ids.includes(recipeId);
}

/** Toggle: voeg toe als favoriet, of verwijder als hij al bestaat. Retourneert `true` als het nu een favoriet is. */
export async function toggleFavorite(recipeId: string, user: string): Promise<boolean> {
  if (!user) throw new Error('Geen gebruikersnaam ingesteld.');

  // Probeer eerst te DELETEN; we vragen de verwijderde rij terug
  // om te weten of er iets bestond.
  const { data: deleted, error: delErr } = await supabase
    .from('favorites')
    .delete()
    .eq('user_name', user)
    .eq('recipe_id', recipeId)
    .select();

  if (delErr) throw delErr;
  cacheInvalidate(`favorites:${user}`);

  if (deleted && deleted.length > 0) {
    return false; // bestond → nu verwijderd
  }

  // Bestond niet → insert
  const { error: insErr } = await supabase
    .from('favorites')
    .insert({ user_name: user, recipe_id: recipeId });

  if (insErr) {
    // 409/conflict: race condition, hij bestaat al
    if (insErr.code === '23505') return true;
    throw insErr;
  }

  return true;
}

/** Haal volledige recept-objecten op van alle favorieten. */
export async function getFavoriteRecipes(user: string): Promise<Recipe[]> {
  const ids = await getFavoriteRecipeIds(user);
  if (ids.length === 0) return [];
  return getRecipesByIds(ids);
}
