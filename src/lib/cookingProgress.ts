/**
 * COOKING PROGRESS — Cooked it + Pril Ritme
 *
 * Spiegel van het kookgedeelte in `js/store.js` op de website
 * (`markScheduleMealCooked`, `getCookingWeekProgress`,
 * `getCookingRhythmHistory`, de mijlpalen).
 *
 * OPSLAG IS LOKAAL, net als op de website — daar `localStorage`, hier
 * AsyncStorage. Er is dus GEEN synchronisatie tussen web en app, en ook niet
 * tussen twee toestellen: kook je iets af op je telefoon, dan ziet de website
 * dat niet. Dat is dezelfde afspraak als bij "Mijn leertraject"
 * (`lib/learningProgress.ts`) en wacht op fase 3 van het gamificatieplan, een
 * Supabase-tabel met RLS. Bouw er dus geen serverlogica bovenop.
 *
 * De web-versie leest een module-globale gebruiker; hier komt die als
 * argument mee, zodat deze functies puur blijven en het wisselen van account
 * geen lekkage geeft.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const COOKED_MEALS_KEY_PREFIX = 'prilleven_cooked_meals_';

/** Aantal kookdagen dat één volle Pril Ritme-week vormt. */
export const COOKING_RHYTHM_TARGET = 3;

export interface CookedMeal {
  scheduleId: string;
  day: string;
  slot: string;
  recipeId: string;
  /** Maandag van de week waarin gekookt werd, als jjjj-mm-dd. */
  weekStart: string;
  /** Kalenderdag van afronden, als jjjj-mm-dd. */
  completedDate: string;
  completedAt: string;
}

export interface MealRef {
  scheduleId: string;
  day: string;
  slot: string;
  recipeId: string;
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  current: number;
  target: number;
  isReached: boolean;
}

export interface MilestoneProgress {
  totalCookedMeals: number;
  uniqueRecipes: number;
  completedRhythmWeeks: number;
  milestones: Milestone[];
}

export interface RhythmWeek {
  weekStart: string;
  days: number;
  target: number;
  isCurrent: boolean;
  isComplete: boolean;
}

export interface RhythmHistory {
  weeks: RhythmWeek[];
  completedWeeks: number;
  totalWeeks: number;
}

function storageKey(user: string | null): string {
  return `${COOKED_MEALS_KEY_PREFIX}${user || 'anoniem'}`;
}

/* ----------------------------------------
   Datumhelpers — lokale getters, geen UTC, zodat een gerecht dat je 's avonds
   afvinkt niet op de volgende dag belandt.
---------------------------------------- */
function localDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function weekStartDate(date: Date = new Date()): Date {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysSinceMonday = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - daysSinceMonday);
  return monday;
}

function currentWeekStart(date: Date = new Date()): string {
  return localDateKey(weekStartDate(date));
}

/* ----------------------------------------
   Opslag
---------------------------------------- */
export async function readCookedMeals(user: string | null): Promise<CookedMeal[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(user));
    const meals = raw ? JSON.parse(raw) : [];
    return Array.isArray(meals) ? meals : [];
  } catch {
    return [];
  }
}

async function saveCookedMeals(user: string | null, meals: CookedMeal[]): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey(user), JSON.stringify(meals));
  } catch {
    /* Stil: het afvinken mag nooit een scherm blokkeren. */
  }
}

/* ----------------------------------------
   Afleidingen (puur — werken op een reeds geladen lijst)
---------------------------------------- */
function completedDatesByWeek(meals: CookedMeal[]): Map<string, Set<string>> {
  const byWeek = new Map<string, Set<string>>();
  meals.forEach(meal => {
    if (!meal.weekStart || !meal.completedDate) return;
    if (!byWeek.has(meal.weekStart)) byWeek.set(meal.weekStart, new Set());
    byWeek.get(meal.weekStart)!.add(meal.completedDate);
  });
  return byWeek;
}

/** Sleutel voor een plaats in het schema, om snel op te zoeken bij het renderen. */
export function mealKey(day: string, slot: string, recipeId: string): string {
  return `${day}|${slot}|${recipeId}`;
}

/** Alle afgevinkte plaatsen van dit schema in de LOPENDE week. */
export function cookedKeysForSchedule(
  meals: CookedMeal[],
  scheduleId: string
): Set<string> {
  const week = currentWeekStart();
  const keys = new Set<string>();
  meals.forEach(meal => {
    if (meal.weekStart === week && meal.scheduleId === scheduleId) {
      keys.add(mealKey(meal.day, meal.slot, meal.recipeId));
    }
  });
  return keys;
}

/** Weekvoortgang op basis van unieke kookdagen, niet het aantal gerechten. */
export function getCookingWeekProgress(meals: CookedMeal[]) {
  const week = currentWeekStart();
  const dates = [
    ...new Set(
      meals
        .filter(m => m.weekStart === week)
        .map(m => m.completedDate)
        .filter(Boolean)
    ),
  ];
  return {
    days: dates.length,
    target: COOKING_RHYTHM_TARGET,
    completedDates: dates,
    isComplete: dates.length >= COOKING_RHYTHM_TARGET,
  };
}

/** Ritmehistoriek van de lopende en voorgaande kalenderweken. */
export function getCookingRhythmHistory(
  meals: CookedMeal[],
  weekCount = 4
): RhythmHistory {
  const safeWeekCount = Math.min(8, Math.max(1, Math.trunc(weekCount) || 4));
  const byWeek = completedDatesByWeek(meals);
  const currentMonday = weekStartDate();

  const weeks: RhythmWeek[] = Array.from({ length: safeWeekCount }, (_, index) => {
    const monday = new Date(currentMonday);
    monday.setDate(monday.getDate() - index * 7);
    const weekStart = localDateKey(monday);
    const days = byWeek.get(weekStart)?.size || 0;
    return {
      weekStart,
      days,
      target: COOKING_RHYTHM_TARGET,
      isCurrent: index === 0,
      isComplete: days >= COOKING_RHYTHM_TARGET,
    };
  });

  return {
    weeks,
    completedWeeks: weeks.filter(w => w.isComplete).length,
    totalWeeks: weeks.length,
  };
}

export function getMilestoneProgress(meals: CookedMeal[]): MilestoneProgress {
  const uniqueRecipeIds = new Set(
    meals.map(m => m.recipeId).filter(id => id != null)
  );
  const byWeek = completedDatesByWeek(meals);
  const completedRhythmWeeks = [...byWeek.values()].filter(
    dates => dates.size >= COOKING_RHYTHM_TARGET
  ).length;
  const currentWeekDays = byWeek.get(currentWeekStart())?.size || 0;

  const milestones: Milestone[] = [
    {
      id: 'first-cooked',
      title: 'Je eerste Cooked it',
      description: 'Je kookverhaal is begonnen.',
      current: Math.min(meals.length, 1),
      target: 1,
      isReached: meals.length >= 1,
    },
    {
      id: 'first-rhythm',
      title: 'Je eerste volle Pril Ritme-week',
      description: 'Drie betekenisvolle kookdagen in één week.',
      current:
        completedRhythmWeeks > 0
          ? COOKING_RHYTHM_TARGET
          : Math.min(currentWeekDays, COOKING_RHYTHM_TARGET),
      target: COOKING_RHYTHM_TARGET,
      isReached: completedRhythmWeeks > 0,
    },
    {
      id: 'five-recipes',
      title: 'Vijf verschillende gerechten',
      description: 'Je bracht al vijf verschillende gerechten op tafel.',
      current: Math.min(uniqueRecipeIds.size, 5),
      target: 5,
      isReached: uniqueRecipeIds.size >= 5,
    },
  ];

  return {
    totalCookedMeals: meals.length,
    uniqueRecipes: uniqueRecipeIds.size,
    completedRhythmWeeks,
    milestones,
  };
}

/* ----------------------------------------
   Mutaties
---------------------------------------- */
export interface MarkResult {
  added: boolean;
  meals: CookedMeal[];
  progress: MilestoneProgress;
  /** Mijlpalen die dóór deze afronding bereikt zijn — waard om te vieren. */
  newlyReached: Milestone[];
}

/** Markeer één gerecht als gemaakt. Meerdere gerechten op dezelfde dag
 *  tellen voor het weekritme samen als één kookdag. */
export async function markMealCooked(
  user: string | null,
  ref: MealRef
): Promise<MarkResult> {
  const meals = await readCookedMeals(user);
  const weekStart = currentWeekStart();
  const progressBefore = getMilestoneProgress(meals);

  const already = meals.some(
    m =>
      m.weekStart === weekStart &&
      m.scheduleId === ref.scheduleId &&
      m.day === ref.day &&
      m.slot === ref.slot &&
      m.recipeId === ref.recipeId
  );
  if (already) {
    return { added: false, meals, progress: progressBefore, newlyReached: [] };
  }

  const next = [
    ...meals,
    {
      ...ref,
      weekStart,
      completedDate: localDateKey(),
      completedAt: new Date().toISOString(),
    },
  ];
  await saveCookedMeals(user, next);

  const progress = getMilestoneProgress(next);
  const reachedBefore = new Set(
    progressBefore.milestones.filter(m => m.isReached).map(m => m.id)
  );
  return {
    added: true,
    meals: next,
    progress,
    newlyReached: progress.milestones.filter(
      m => m.isReached && !reachedBefore.has(m.id)
    ),
  };
}

/** Maak de afronding van één gerecht in de lopende week ongedaan. */
export async function unmarkMealCooked(
  user: string | null,
  ref: MealRef
): Promise<CookedMeal[]> {
  const weekStart = currentWeekStart();
  const meals = await readCookedMeals(user);
  const next = meals.filter(
    m =>
      !(
        m.weekStart === weekStart &&
        m.scheduleId === ref.scheduleId &&
        m.day === ref.day &&
        m.slot === ref.slot &&
        m.recipeId === ref.recipeId
      )
  );
  await saveCookedMeals(user, next);
  return next;
}
