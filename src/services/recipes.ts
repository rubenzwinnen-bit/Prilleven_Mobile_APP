/**
 * RECIPES SERVICE
 *
 * Alle CRUD-operaties voor recepten.
 * Leest uit de Supabase-tabel `recipes`.
 *
 * Functies:
 *   getRecipes()            — alle recepten ophalen
 *   getRecipe(id)           — één recept op ID
 *   getRecipesByIds(ids)    — meerdere recepten op ID (batch)
 */

import { supabase } from '../lib/supabase';
import { cacheGet, cacheSet } from './cache';
import type { Recipe, Ingredient } from '../types';

/* ---- DB row → app model ---- */
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
    minAgeMonths: row.min_age_months != null ? Number(row.min_age_months) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/* Kolommen voor lijstweergaven. `ingredients` en `preparation` zitten er
   bewust NIET in: dat zijn de twee zware arrays, en geen enkel lijstscherm
   toont ze. Ze worden opgehaald zodra je één recept opvraagt. */
const LIST_COLUMNS =
  'id, name, image, meal_moments, allergens, min_age_months, ' +
  'cooking_time, portions, created_at, updated_at';

/** Haal alle recepten op (gecached), zonder ingrediënten en bereidingswijze. */
export async function getRecipes(): Promise<Recipe[]> {
  const cached = cacheGet<Recipe[]>('recipes:all');
  if (cached) return cached;

  const { data, error } = await supabase
    .from('recipes')
    .select(LIST_COLUMNS)
    .order('created_at', { ascending: false })
    .range(0, 9999);

  if (error) throw error;

  /* Deze rijen zijn onvolledig, dus ze mogen de per-recept-cache NIET vullen:
     anders zou een detailscherm of de boodschappenlijst een recept zonder
     ingrediënten uit de cache krijgen. */
  const recipes = (data || []).map(dbToRecipe);
  cacheSet('recipes:all', recipes);
  return recipes;
}

/** Haal één recept op via ID (gecached). */
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

/** Haal meerdere recepten op via een array van IDs (batch, gecached per stuk). */
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
