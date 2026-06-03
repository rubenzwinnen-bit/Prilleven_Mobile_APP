/**
 * FAMILY-LAYER — helpers voor "Voor jouw gezin" in RecipeDetail
 *
 * Spiegelt de webversie (`js/utils.js` + `js/components/recipeDetail.js`):
 * per kind beoordelen of een recept geschikt is op basis van leeftijd +
 * allergenen. Puur informatief — geen medisch advies.
 *
 * Statussen (in volgorde van prioriteit):
 *   - 'rood'   : kind is allergisch voor een allergeen in het recept
 *   - 'jong'   : kind is jonger dan de (effectieve) minimumleeftijd
 *   - 'oranje' : recept bevat een allergeen dat nog niet geïntroduceerd is
 *   - 'ok'     : oud genoeg én geen waarschuwingen
 */

import { colors } from '../constants/theme';
import { ageInMonths } from '../services/children';
import type { Child } from '../services/children';
import type { Recipe } from '../types';

/* ----------------------------------------
   ALLERGENEN — normalisatie + labels
   Canonieke keys = de 9 keys uit de introductie-flow. Recept-allergenen
   kunnen nog legacy-waarden bevatten (gluten/lactose/ei) → via aliases
   naar de canonieke key zodat de family-layer correct matcht met de
   geïntroduceerde/bekende allergenen van een kind.
---------------------------------------- */
export const ALLERGEN_LABELS: Record<string, string> = {
  'kippen-ei': 'Kippenei',
  pinda: 'Pinda',
  noten: 'Noten',
  sesam: 'Sesam',
  vis: 'Vis',
  schaaldieren: 'Schaaldieren',
  soja: 'Soja',
  tarwe: 'Tarwe',
  koemelk: 'Koemelk',
};

/* "lactose" is geen allergeen → valt onder koemelk (eiwit). */
export const ALLERGEN_ALIASES: Record<string, string> = {
  gluten: 'tarwe',
  lactose: 'koemelk',
  melk: 'koemelk',
  zuivel: 'koemelk',
  ei: 'kippen-ei',
};

/** Normaliseer een (mogelijk legacy) allergeen-waarde naar de canonieke key. */
export function normalizeAllergen(a: string): string {
  if (!a) return a;
  const key = String(a).trim().toLowerCase();
  return ALLERGEN_ALIASES[key] || key;
}

/** Net label voor een (mogelijk legacy) allergeen-waarde. */
export function getAllergenLabel(a: string): string {
  const key = normalizeAllergen(a);
  return ALLERGEN_LABELS[key] || key;
}

/* ----------------------------------------
   LEEFTIJD & GESCHIKTHEID
---------------------------------------- */

/* Minimumleeftijd (in maanden) per eetmoment. Fallback wanneer een recept
   geen expliciete min_age_months heeft ingevuld. */
export const MEAL_MOMENT_MIN_AGE: Record<string, number> = {
  ochtend: 9,
  'fruit moment': 7,
  middag: 6,
  snack: 10,
  avond: 6,
};

/** Effectieve minimumleeftijd van een recept (in maanden):
 *  - recipe.minAgeMonths als die expliciet is ingevuld
 *  - anders het laagste eetmoment-minimum (vroegst bruikbaar)
 *  - anders null (geen leeftijdsbeperking). */
export function getRecipeMinAge(recipe: Recipe): number | null {
  if (recipe && recipe.minAgeMonths != null) return recipe.minAgeMonths;
  const moments = (recipe && recipe.mealMoments) || [];
  const ages = moments
    .map(m => MEAL_MOMENT_MIN_AGE[String(m).trim().toLowerCase()])
    .filter((a): a is number => typeof a === 'number');
  return ages.length ? Math.min(...ages) : null;
}

/** Compacte leeftijd voor onder de avatar: "3 mnd" / "2 jaar". */
export function childAgeLabel(months: number | null): string {
  if (months == null) return 'leeftijd onbekend';
  if (months < 24) return `${months} mnd`;
  return `${Math.floor(months / 12)} jaar`;
}

/* ----------------------------------------
   AVATAR-KLEUR & INITIALEN op basis van een seed
   Roteert tussen bestaande theme-accenten (mirror van de web --color-*).
---------------------------------------- */
const AVATAR_COLORS = [
  colors.primary,
  colors.secondaryDark,
  colors.info,
  colors.warning,
  colors.primaryDark,
  colors.secondary,
];

export function colorFromSeed(seed: string): string {
  const s = String(seed || '');
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function initialsFromName(name: string): string {
  if (!name) return '?';
  const parts = String(name).trim().split(/[\s_-]+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/* ----------------------------------------
   EVALUATIE per kind
---------------------------------------- */
export type FamilyStatus = 'rood' | 'jong' | 'oranje' | 'ok';

export interface ChildEvaluation {
  child: Child;
  months: number | null;
  status: FamilyStatus;
  icon: string;
  color: string;
  initials: string;
  ageLabel: string;
  warnTitle: string | null;
  warnText: string | null;
}

/* Emoji per status (mirror van de website). */
const STATUS_ICON: Record<FamilyStatus, string> = {
  rood: '\u{1F534}', /* 🔴 */
  jong: '\u{1F535}', /* 🔵 */
  oranje: '\u{1F7E0}', /* 🟠 */
  ok: '\u2705', /* ✅ */
};

/** Beoordeel elk kind één keer t.o.v. een recept. Resultaat wordt
 *  hergebruikt voor de avatar én de waarschuwings-box. */
export function evaluateFamily(
  recipe: Recipe,
  children: Child[]
): ChildEvaluation[] {
  const recipeAllergens = [
    ...new Set((recipe.allergens || []).map(normalizeAllergen)),
  ];
  const minAge = getRecipeMinAge(recipe);

  return children.map(child => {
    const months = child.birthdate ? ageInMonths(child.birthdate) : null;
    const known = (child.known_allergies || []).map(normalizeAllergen);
    const introduced = (child.introduced_allergens || []).map(normalizeAllergen);
    const optedOut = !!child.allergens_opted_out;

    const allergic = recipeAllergens.filter(a => known.includes(a));
    const notIntroduced = optedOut
      ? []
      : recipeAllergens.filter(a => !introduced.includes(a) && !known.includes(a));
    const tooYoung = minAge != null && months != null && months < minAge;

    let status: FamilyStatus;
    let warnTitle: string | null;
    let warnText: string | null;
    if (allergic.length) {
      status = 'rood';
      warnTitle = `${child.name} is allergisch`;
      warnText = `Dit recept bevat ${allergic
        .map(getAllergenLabel)
        .join(', ')}. Geef dit niet aan ${child.name}.`;
    } else if (tooYoung) {
      status = 'jong';
      warnTitle = `${child.name} is nog te jong`;
      warnText = `Dit recept is geschikt vanaf ${minAge} maanden.`;
    } else if (notIntroduced.length) {
      status = 'oranje';
      warnTitle = `Nog niet geïntroduceerd bij ${child.name}`;
      warnText = `Introduceer eerst apart: ${notIntroduced
        .map(getAllergenLabel)
        .join(', ')}.`;
    } else {
      status = 'ok';
      warnTitle = null;
      warnText = null;
    }

    return {
      child,
      months,
      status,
      icon: STATUS_ICON[status],
      color: colorFromSeed(child.id),
      initials: initialsFromName(child.name),
      ageLabel: childAgeLabel(months),
      warnTitle,
      warnText,
    };
  });
}
