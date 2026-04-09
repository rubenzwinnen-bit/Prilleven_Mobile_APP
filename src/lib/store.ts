/**
 * STORE
 * CRUD-laag bovenop Supabase. Spiegelt de webversie zodat
 * dezelfde tabellen en velden gebruikt worden.
 *
 * Lichte in-memory cache (30s TTL) zodat navigatie snel
 * blijft voor 150+ gebruikers.
 */

import { supabase } from './supabase';
import type {
  Recipe,
  Comment,
  RatingSummary,
  Schedule,
  Ingredient,
} from '../types';

/* ----------------------------------------
   IN-MEMORY CACHE
---------------------------------------- */
const CACHE_TTL = 30_000;
const _cache = new Map<string, { v: any; t: number }>();

function cacheGet<T>(key: string): T | undefined {
  const entry = _cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.t > CACHE_TTL) {
    _cache.delete(key);
    return undefined;
  }
  return entry.v as T;
}

function cacheSet(key: string, value: any) {
  _cache.set(key, { v: value, t: Date.now() });
}

function cacheInvalidate(prefix?: string) {
  if (!prefix) return _cache.clear();
  for (const key of [..._cache.keys()]) {
    if (key.startsWith(prefix)) _cache.delete(key);
  }
}

export function clearCache() {
  cacheInvalidate();
}

/* ----------------------------------------
   ROW -> APP MAPPING
---------------------------------------- */
function dbToRecipe(row: any): Recipe {
  return {
    id: row.id,
    name: row.name,
    image: row.image || '',
    mealMoments: row.meal_moments || [],
    cookingTime: row.cooking_time || 0,
    portions: row.portions != null ? Number(row.portions) : 1,
    ingredients: (row.ingredients || []) as Ingredient[],
    allergens: row.allergens || [],
    preparation: row.preparation || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/* ============================================
   RECIPES
============================================ */

export async function getRecipes(): Promise<Recipe[]> {
  const cached = cacheGet<Recipe[]>('recipes:all');
  if (cached) return cached;

  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .order('created_at', { ascending: false })
    .range(0, 9999);

  if (error) throw error;

  const recipes = (data || []).map(dbToRecipe);
  cacheSet('recipes:all', recipes);
  for (const r of recipes) cacheSet(`recipe:${r.id}`, r);
  return recipes;
}

export async function getRecipe(id: string): Promise<Recipe | null> {
  const cached = cacheGet<Recipe>(`recipe:${id}`);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const recipe = dbToRecipe(data);
  cacheSet(`recipe:${id}`, recipe);
  return recipe;
}

export async function getRecipesByIds(ids: string[]): Promise<Recipe[]> {
  if (!ids || ids.length === 0) return [];

  const result: Recipe[] = [];
  const missing: string[] = [];

  for (const id of ids) {
    const cached = cacheGet<Recipe>(`recipe:${id}`);
    if (cached) result.push(cached);
    else missing.push(id);
  }

  if (missing.length === 0) return result;

  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .in('id', missing);

  if (error) throw error;

  for (const row of data || []) {
    const recipe = dbToRecipe(row);
    cacheSet(`recipe:${recipe.id}`, recipe);
    result.push(recipe);
  }

  return result;
}

/* ============================================
   RATINGS
============================================ */

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

export async function rateRecipe(recipeId: string, rating: number, user: string) {
  if (!user) throw new Error('Geen gebruikersnaam ingesteld.');

  const clamped = Math.min(5, Math.max(1, Math.round(rating)));

  // UPSERT op (recipe_id, user_name)
  const { error } = await supabase
    .from('ratings')
    .upsert(
      { recipe_id: recipeId, user_name: user, rating: clamped },
      { onConflict: 'recipe_id,user_name' }
    );

  if (error) throw error;

  cacheInvalidate('ratings:');
}

/* ============================================
   COMMENTS
============================================ */

export async function getComments(recipeId: string): Promise<Comment[]> {
  const key = `comments:${recipeId}`;
  const cached = cacheGet<Comment[]>(key);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('recipe_id', recipeId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const comments: Comment[] = (data || []).map((c: any) => ({
    id: c.id,
    userId: c.user_name,
    userName: c.user_name,
    text: c.text,
    date: c.created_at,
  }));
  cacheSet(key, comments);
  return comments;
}

export async function addComment(
  recipeId: string,
  text: string,
  user: string
): Promise<Comment | null> {
  if (!user || !text.trim()) return null;

  const { data, error } = await supabase
    .from('comments')
    .insert({ recipe_id: recipeId, user_name: user, text: text.trim() })
    .select()
    .single();

  if (error) throw error;
  cacheInvalidate(`comments:${recipeId}`);

  return {
    id: data.id,
    userId: data.user_name,
    userName: data.user_name,
    text: data.text,
    date: data.created_at,
  };
}

/* ============================================
   FAVORITES
============================================ */

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

export async function isFavorite(recipeId: string, user: string): Promise<boolean> {
  const ids = await getFavoriteRecipeIds(user);
  return ids.includes(recipeId);
}

export async function toggleFavorite(recipeId: string, user: string): Promise<boolean> {
  if (!user) throw new Error('Geen gebruikersnaam ingesteld.');

  // Probeer eerst te DELETEN; we vragen de verwijderde rij terug om te weten of er iets bestond.
  const { data: deleted, error: delErr } = await supabase
    .from('favorites')
    .delete()
    .eq('user_name', user)
    .eq('recipe_id', recipeId)
    .select();

  if (delErr) throw delErr;
  cacheInvalidate(`favorites:${user}`);

  if (deleted && deleted.length > 0) {
    return false; // bestond -> nu verwijderd
  }

  // Bestond niet -> insert
  const { error: insErr } = await supabase
    .from('favorites')
    .insert({ user_name: user, recipe_id: recipeId });

  if (insErr) {
    // 409/conflict betekent dat hij ondertussen toch bestaat
    if (insErr.code === '23505') return true;
    throw insErr;
  }

  return true;
}

export async function getFavoriteRecipes(user: string): Promise<Recipe[]> {
  const ids = await getFavoriteRecipeIds(user);
  if (ids.length === 0) return [];
  return getRecipesByIds(ids);
}

/* ============================================
   SCHEDULES
============================================ */

export async function getSavedSchedules(user: string): Promise<Schedule[]> {
  if (!user) return [];

  const key = `schedules:${user}`;
  const cached = cacheGet<Schedule[]>(key);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('user_name', user)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const schedules: Schedule[] = (data || []).map((s: any) => ({
    id: s.id,
    name: s.name,
    days: s.days || {},
    excludedAllergens: s.excluded_allergens || [],
    createdAt: s.created_at,
  }));
  cacheSet(key, schedules);
  for (const s of schedules) cacheSet(`schedule:${s.id}`, s);
  return schedules;
}

export async function getSchedule(id: string): Promise<Schedule | null> {
  const cached = cacheGet<Schedule>(`schedule:${id}`);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const schedule: Schedule = {
    id: data.id,
    name: data.name,
    days: data.days || {},
    excludedAllergens: data.excluded_allergens || [],
    createdAt: data.created_at,
  };
  cacheSet(`schedule:${id}`, schedule);
  return schedule;
}

export async function saveSchedule(
  user: string,
  schedule: { name: string; days: any; excludedAllergens: string[] }
): Promise<Schedule | null> {
  if (!user) throw new Error('Geen gebruikersnaam ingesteld.');

  const { data, error } = await supabase
    .from('schedules')
    .insert({
      user_name: user,
      name: schedule.name,
      days: schedule.days || {},
      excluded_allergens: schedule.excludedAllergens || [],
    })
    .select()
    .single();

  if (error) throw error;
  cacheInvalidate(`schedules:${user}`);

  return {
    id: data.id,
    name: data.name,
    days: data.days,
    excludedAllergens: data.excluded_allergens,
    createdAt: data.created_at,
  };
}

export async function deleteSchedule(id: string) {
  const { error } = await supabase.from('schedules').delete().eq('id', id);
  if (error) throw error;
  cacheInvalidate('schedules:');
  cacheInvalidate(`schedule:${id}`);
}
