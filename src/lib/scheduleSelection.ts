/**
 * Receptkeuze bij het genereren van een weekschema.
 *
 * Spiegel van de keuzefuncties in de web-app
 * (`js/components/weekSchedule.js`, blok "WEEKSCHEMA GENEREREN").
 * Zonder favorietenvoorkeur blijft de bestaande uniforme random-keuze exact
 * behouden; met voorkeur krijgen favorieten vaker een plek terwijl het schema
 * gevarieerd blijft.
 *
 * De web-versie leest een module-globale `cachedFavoriteIds`; hier zit die set
 * in de state, zodat deze functies puur blijven.
 */

import { Recipe, ActiveSchedule } from '../types';
import { WEEKDAYS, SCHEDULE_SLOTS, slotToMealMoment } from '../constants/data';

/* Onder deze grens negeren we het onderscheid favoriet/niet-favoriet volledig.
   Zo worden 1-3 overige recepten niet de hele week geforceerd herhaald wanneer
   iemand bijna alle recepten van dit eetmoment als favoriet markeerde. */
export const MIN_NON_FAVORITE_POOL = 4;

export interface SelectionState {
  preferFavorites: boolean;
  favoriteCount: number;
  probability: number;
  maxPreferredSlots: number;
  recipeUsage: Map<string, number>;
  favoriteSelections: number;
  preferredSlots: number;
  favoriteIds: Set<string>;
}

interface FavoriteSettings {
  favoriteCount: number;
  probability: number;
  maxPreferredSlots: number;
}

function getFavoriteSelectionSettings(
  availableRecipes: Recipe[],
  favoriteIds: Set<string>
): FavoriteSettings {
  const favoriteCount = availableRecipes.filter(r => favoriteIds.has(r.id)).length;

  if (favoriteCount === 0) return { favoriteCount: 0, probability: 0, maxPreferredSlots: 0 };
  if (favoriteCount <= 2) return { favoriteCount, probability: 0.2, maxPreferredSlots: 2 };
  if (favoriteCount <= 5) return { favoriteCount, probability: 0.3, maxPreferredSlots: 4 };
  return { favoriteCount, probability: 0.35, maxPreferredSlots: 7 };
}

export function createSelectionState(
  availableRecipes: Recipe[],
  preferFavorites: boolean,
  favoriteIds: Set<string>
): SelectionState {
  const settings = getFavoriteSelectionSettings(availableRecipes, favoriteIds);
  return {
    preferFavorites: Boolean(preferFavorites && settings.favoriteCount > 0),
    ...settings,
    recipeUsage: new Map<string, number>(),
    favoriteSelections: 0,
    preferredSlots: 0,
    favoriteIds,
  };
}

function randomFrom<T>(pool: T[]): T | null {
  return pool[Math.floor(Math.random() * pool.length)] || null;
}

function leastUsedRandom(pool: Recipe[], recipeUsage: Map<string, number>): Recipe | null {
  if (pool.length === 0) return null;
  const lowestUsage = Math.min(...pool.map(r => recipeUsage.get(r.id) || 0));
  return randomFrom(pool.filter(r => (recipeUsage.get(r.id) || 0) === lowestUsage));
}

export function recordSelection(
  state: SelectionState,
  recipe: Recipe | null,
  usedPreference = false
): void {
  if (!recipe) return;
  state.recipeUsage.set(recipe.id, (state.recipeUsage.get(recipe.id) || 0) + 1);
  if (state.favoriteIds.has(recipe.id)) state.favoriteSelections += 1;
  if (usedPreference) state.preferredSlots += 1;
}

export function removeSelection(state: SelectionState, recipeId: string | null): void {
  if (!recipeId) return;
  const currentUsage = state.recipeUsage.get(recipeId) || 0;
  if (currentUsage > 1) state.recipeUsage.set(recipeId, currentUsage - 1);
  else state.recipeUsage.delete(recipeId);

  if (state.favoriteIds.has(recipeId)) {
    state.favoriteSelections = Math.max(0, state.favoriteSelections - 1);
    state.preferredSlots = Math.max(0, state.preferredSlots - 1);
  }
}

export interface Selection {
  recipe: Recipe | null;
  usedPreference: boolean;
}

export function selectRecipeForSlot(
  suitableRecipes: Recipe[],
  state: SelectionState,
  avoidRecipeId: string | null = null
): Selection {
  const alternatives = suitableRecipes.filter(r => r.id !== avoidRecipeId);
  const candidates = alternatives.length > 0 ? alternatives : suitableRecipes;
  if (candidates.length === 0) return { recipe: null, usedPreference: false };

  /* Zonder voorkeur blijft de bestaande uniforme random-keuze exact behouden. */
  if (!state.preferFavorites) {
    return { recipe: randomFrom(candidates), usedPreference: false };
  }

  const favorites = candidates.filter(r => state.favoriteIds.has(r.id));
  const nonFavorites = candidates.filter(r => !state.favoriteIds.has(r.id));

  if (nonFavorites.length < MIN_NON_FAVORITE_POOL) {
    return {
      recipe: leastUsedRandom(candidates, state.recipeUsage),
      usedPreference: false,
    };
  }

  const usableFavorites = favorites.filter(r => (state.recipeUsage.get(r.id) || 0) < 2);
  const canPreferFavorite =
    usableFavorites.length > 0 && state.preferredSlots < state.maxPreferredSlots;

  if (canPreferFavorite && Math.random() < state.probability) {
    return {
      recipe: leastUsedRandom(usableFavorites, state.recipeUsage),
      usedPreference: true,
    };
  }

  return {
    recipe: leastUsedRandom(nonFavorites, state.recipeUsage),
    usedPreference: false,
  };
}

/* De aangevinkte optie moet merkbaar zijn als er minstens één passend favoriet
   recept bestaat, ook wanneer alle random-kansen net missen. */
export function ensureFavoriteAppears(
  days: ActiveSchedule['days'],
  availableRecipes: Recipe[],
  state: SelectionState
): void {
  if (!state.preferFavorites || state.favoriteSelections > 0) return;

  const possibleSlots: { day: string; slotId: string; favorites: Recipe[] }[] = [];
  WEEKDAYS.forEach(day => {
    SCHEDULE_SLOTS.forEach(slot => {
      const mealMoment = slotToMealMoment(slot.id);
      const favorites = availableRecipes.filter(
        r => state.favoriteIds.has(r.id) && (r.mealMoments || []).includes(mealMoment)
      );
      if (favorites.length > 0) possibleSlots.push({ day, slotId: slot.id, favorites });
    });
  });

  const target = randomFrom(possibleSlots);
  if (!target) return;

  const previousId = days[target.day]?.[target.slotId] ?? null;
  removeSelection(state, previousId);
  const favorite = leastUsedRandom(target.favorites, state.recipeUsage);
  if (!favorite) return;
  days[target.day][target.slotId] = favorite.id;
  recordSelection(state, favorite, true);
}

export function buildSelectionStateFromSchedule(
  schedule: ActiveSchedule,
  availableRecipes: Recipe[],
  recipeMap: Map<string, Recipe>,
  favoriteIds: Set<string>
): SelectionState {
  const state = createSelectionState(
    availableRecipes,
    Boolean(schedule.preferFavorites),
    favoriteIds
  );

  WEEKDAYS.forEach(day => {
    SCHEDULE_SLOTS.forEach(slot => {
      const recipeId = schedule.days?.[day]?.[slot.id];
      const recipe = recipeId ? recipeMap.get(recipeId) || null : null;
      recordSelection(state, recipe, recipeId ? favoriteIds.has(recipeId) : false);
    });
  });

  return state;
}
