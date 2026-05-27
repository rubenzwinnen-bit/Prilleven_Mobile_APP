/**
 * EERSTE HAPJES — ALLERGENEN-INTRODUCTIE SERVICE
 *
 * Beheert de allergeen-introductie per kind. Spiegelt de logica van de
 * website (`js/content/eersteHapjes-allergen-flow.js`,
 * `js/eersteHapjesStateApi.js`) en gebruikt dezelfde Vercel-API.
 *
 * MVP v2.5.0 dekt:
 *   - State (GET/PATCH /api/eerste-hapjes/state)
 *   - Doses (GET/POST/PATCH/DELETE /api/eerste-hapjes/doses[/:id])
 *   - Lokale helpers: buildAllergenContext, getAllergenStatus
 *
 * Symptomen + pause-flow komen in een volgende versie.
 *
 * Auth: Supabase JWT (Bearer-token), identiek aan andere services.
 */

import { supabase } from '../lib/supabase';
import { RAG_API_URL } from './hapjesheld';

/* ----------------------------------------
   Constants — gespiegeld van de website
---------------------------------------- */

/** Minimum aantal dagen tussen twee doses (eender welk allergeen). */
export const ALLERGEN_COOLDOWN_DAYS = 2;

/** Aantal doses dat nodig is om een allergeen als "veilig" te markeren. */
export const ALLERGEN_TARGET_DOSES = 3;

/** Een hoofd-allergeen uit de introductieflow. */
export interface AllergenFlowItem {
  key: string;
  label: string;
  icon: string;
  /** Volgorde waarin we ze in de UI tonen (1-9). */
  order: number;
  /** Pas introduceren vanaf deze leeftijd in maanden. */
  introFromMonths: number;
  /** Bij voorkeur introduceren vóór deze leeftijd in maanden. */
  introBeforeMonths: number;
  /** Korte suggestie van een voedingsmiddel waarmee je kan starten. */
  suggestion: string;
}

/** De 9 hoofdallergenen — vaste volgorde uit de website. */
export const ALLERGEN_FLOW: AllergenFlowItem[] = [
  {
    key: 'kippen-ei',
    label: 'Kippenei',
    icon: '🥚',
    order: 1,
    introFromMonths: 4,
    introBeforeMonths: 12,
    suggestion: 'Goed gebakken of gekookt eitje',
  },
  {
    key: 'pinda',
    label: 'Pinda',
    icon: '🥜',
    order: 2,
    introFromMonths: 4,
    introBeforeMonths: 12,
    suggestion: 'Een lepeltje verdunde 100 % pindakaas',
  },
  {
    key: 'noten',
    label: 'Noten',
    icon: '🌰',
    order: 3,
    introFromMonths: 4,
    introBeforeMonths: 12,
    suggestion: 'Een lepeltje verdunde notenpasta',
  },
  {
    key: 'sesam',
    label: 'Sesam',
    icon: '🌻',
    order: 4,
    introFromMonths: 4,
    introBeforeMonths: 12,
    suggestion: 'Een lepeltje verdunde tahin',
  },
  {
    key: 'vis',
    label: 'Vis',
    icon: '🐟',
    order: 5,
    introFromMonths: 4,
    introBeforeMonths: 12,
    suggestion: 'Goed gegaarde, graatvrije witvis',
  },
  {
    key: 'schaaldieren',
    label: 'Schaaldieren',
    icon: '🦐',
    order: 6,
    introFromMonths: 4,
    introBeforeMonths: 12,
    suggestion: 'Goed gegaarde, fijngeprakte garnaaltjes',
  },
  {
    key: 'soja',
    label: 'Soja',
    icon: '🌱',
    order: 7,
    introFromMonths: 4,
    introBeforeMonths: 12,
    suggestion: 'Tofu of een lepeltje sojayoghurt',
  },
  {
    key: 'tarwe',
    label: 'Tarwe',
    icon: '🌾',
    order: 8,
    introFromMonths: 4,
    introBeforeMonths: 12,
    suggestion: 'Volkoren pasta of een stukje zuurdesem',
  },
  {
    key: 'koemelk',
    label: 'Koemelk',
    icon: '🥛',
    order: 9,
    introFromMonths: 4,
    introBeforeMonths: 12,
    suggestion: 'Volle yoghurt of een klein klontje boter',
  },
];

/** Reactie-niveaus op een dose. */
export type ReactionLevel = 'geen' | 'mild' | 'ernstig';

export interface ReactionLevelInfo {
  key: ReactionLevel;
  label: string;
  description: string;
  /** Telt deze reactie mee als geslaagde dose? */
  counts: boolean;
  /** Pauzeert deze reactie de flow? */
  pauses: boolean;
  /** Triggert deze reactie een escalatie (arts/SOS)? */
  escalate: boolean;
}

export const REACTION_LEVELS: Record<ReactionLevel, ReactionLevelInfo> = {
  geen: {
    key: 'geen',
    label: 'Geen reactie',
    description: 'Geen klachten — telt mee als geslaagde dose.',
    counts: true,
    pauses: false,
    escalate: false,
  },
  mild: {
    key: 'mild',
    label: 'Milde reactie',
    description: 'Vraag of huid-irritatie — flow pauzeert.',
    counts: false,
    pauses: true,
    escalate: false,
  },
  ernstig: {
    key: 'ernstig',
    label: 'Ernstige reactie',
    description: 'Zwelling/ademhaling — contacteer een arts.',
    counts: false,
    pauses: true,
    escalate: true,
  },
};

/** Status van een allergeen voor een kind. */
export type AllergenStatus =
  | 'veilig'
  | 'allergisch'
  | 'paused'
  | 'in-progress'
  | 'wacht'
  | 'locked-age';

/* ----------------------------------------
   Types — server response shapes
---------------------------------------- */

export interface AllergenStateData {
  paused: boolean;
  paused_reason?: string | null;
  paused_allergen?: string | null;
  paused_type?: 'twijfel' | 'ernstig' | null;
  paused_step?: number;
  arts_toezicht?: boolean;
  known_allergies: string[];
  excluded_keys: string[];
  started: boolean;
  setup_done: boolean;
  pre_introduced: string[];
}

export interface EhState {
  id: string;
  user_id: string;
  child_id: string;
  readiness_check: {
    signals: string[];
    completed_at: string | null;
  };
  current_phase: number;
  phase_started_at: string | null;
  dietary: 'omnivoor' | 'pesco' | 'vegetarisch' | 'vegan';
  allergen_state: AllergenStateData;
  current_week_seed: string | null;
  meals_per_day: number;
  variation_level: 'gevarieerd' | 'simpel';
  created_at: string;
  updated_at: string;
}

export interface EhDose {
  id: string;
  user_id: string;
  child_id: string;
  allergen_key: string;
  dose_number: 1 | 2 | 3;
  intro_date: string | null; // YYYY-MM-DD
  reaction: ReactionLevel;
  notes: string | null;
  meal_log_id: string | null;
  linked_symptom_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface EhDoseInput {
  child_id: string;
  allergen_key: string;
  dose_number: 1 | 2 | 3;
  reaction: ReactionLevel;
  intro_date?: string;
  notes?: string | null;
}

interface StateEnvelope {
  state: EhState;
}

interface DosesEnvelope {
  doses: EhDose[];
}

interface DoseEnvelope {
  dose: EhDose;
}

/* ----------------------------------------
   Auth + fetch helpers (consistent met andere services)
---------------------------------------- */
async function getAuthToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error('Sessie kon niet worden opgehaald.');
  const token = data.session?.access_token;
  if (!token) {
    throw new Error('Niet ingelogd — log opnieuw in om dit te wijzigen.');
  }
  return token;
}

async function authedFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const token = await getAuthToken();
  return fetch(`${RAG_API_URL}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
}

async function jsonOrThrow<T>(response: Response): Promise<T> {
  const raw = await response.text();
  let data: any = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    /* niet-JSON response */
  }
  if (!response.ok) {
    const message =
      (data && data.error) ||
      `Server gaf status ${response.status} terug. Probeer het later opnieuw.`;
    throw new Error(message);
  }
  return data as T;
}

async function okOrThrow(response: Response): Promise<void> {
  if (response.ok || response.status === 204) return;
  let message = `Server gaf status ${response.status} terug. Probeer het later opnieuw.`;
  try {
    const raw = await response.text();
    if (raw) {
      const data = JSON.parse(raw);
      if (data?.error) message = data.error;
    }
  } catch {
    /* niet-JSON */
  }
  throw new Error(message);
}

/* ----------------------------------------
   State API
   GET /api/eerste-hapjes/state?child_id=...
   PATCH /api/eerste-hapjes/state  body: { child_id, ...patch }
---------------------------------------- */
export async function getEhState(childId: string): Promise<EhState> {
  const response = await authedFetch(
    `/api/eerste-hapjes/state?child_id=${encodeURIComponent(childId)}`
  );
  const data = await jsonOrThrow<StateEnvelope>(response);
  if (!data?.state) throw new Error('Allergeen-status kon niet worden geladen.');
  return data.state;
}

export async function patchEhState(
  childId: string,
  patch: Partial<{
    readiness_check: EhState['readiness_check'];
    current_phase: number;
    phase_started_at: string | null;
    dietary: EhState['dietary'];
    allergen_state: Partial<AllergenStateData>;
    current_week_seed: string | null;
    meals_per_day: number;
    variation_level: EhState['variation_level'];
  }>
): Promise<EhState> {
  const response = await authedFetch('/api/eerste-hapjes/state', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ child_id: childId, ...patch }),
  });
  const data = await jsonOrThrow<StateEnvelope>(response);
  if (!data?.state) throw new Error('Allergeen-status kon niet worden bijgewerkt.');
  return data.state;
}

/* ----------------------------------------
   Doses API
   GET /api/eerste-hapjes/doses?child_id=...[&allergen_key=...]
   POST /api/eerste-hapjes/doses  body: EhDoseInput
   PATCH /api/eerste-hapjes/doses/:id  body: partial fields
   DELETE /api/eerste-hapjes/doses/:id
---------------------------------------- */
export async function getEhDoses(
  childId: string,
  allergenKey?: string
): Promise<EhDose[]> {
  const qs = new URLSearchParams({ child_id: childId });
  if (allergenKey) qs.set('allergen_key', allergenKey);
  const response = await authedFetch(`/api/eerste-hapjes/doses?${qs.toString()}`);
  const data = await jsonOrThrow<DosesEnvelope>(response);
  return Array.isArray(data?.doses) ? data.doses : [];
}

export async function createEhDose(input: EhDoseInput): Promise<EhDose> {
  const response = await authedFetch('/api/eerste-hapjes/doses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await jsonOrThrow<DoseEnvelope>(response);
  if (!data?.dose) throw new Error('Dose kon niet worden opgeslagen.');
  return data.dose;
}

export async function updateEhDose(
  id: string,
  patch: Partial<Pick<EhDose, 'intro_date' | 'notes' | 'reaction'>>
): Promise<EhDose> {
  const response = await authedFetch(
    `/api/eerste-hapjes/doses/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }
  );
  const data = await jsonOrThrow<DoseEnvelope>(response);
  if (!data?.dose) throw new Error('Dose kon niet worden bijgewerkt.');
  return data.dose;
}

export async function deleteEhDose(id: string): Promise<void> {
  const response = await authedFetch(
    `/api/eerste-hapjes/doses/${encodeURIComponent(id)}`,
    { method: 'DELETE' }
  );
  await okOrThrow(response);
}

/* ----------------------------------------
   Helpers — afgeleide allergeen-context
---------------------------------------- */

export interface AllergenContext {
  ageMonths: number;
  /** Allergenen met 3 of meer geslaagde (reaction === 'geen') doses. */
  completed: string[];
  /** Allergenen met 1-2 geslaagde doses → { key: count }. */
  inProgress: Record<string, number>;
  /** Allergenen waarvoor een gekende allergie geregistreerd is. */
  knownAllergies: string[];
  /** Is de globale allergeen-flow gepauzeerd? */
  paused: boolean;
  /** Aantal dagen sinds laatste dose; 999 als nog geen dose. */
  daysSinceLastDose: number;
}

/** Bouw een afgeleide context op basis van doses + state. Spiegelt
 *  `buildAllergenContext()` uit `js/eersteHapjesStateApi.js`. */
export function buildAllergenContext(
  doses: EhDose[],
  state: EhState | null,
  ageMonths: number
): AllergenContext {
  const successByKey: Record<string, number> = {};
  let lastDate: string | null = null;

  for (const d of doses) {
    if (d.reaction === 'geen') {
      successByKey[d.allergen_key] = (successByKey[d.allergen_key] || 0) + 1;
    }
    if (d.intro_date && (!lastDate || d.intro_date > lastDate)) {
      lastDate = d.intro_date;
    }
  }

  const completed: string[] = [];
  const inProgress: Record<string, number> = {};
  for (const [key, count] of Object.entries(successByKey)) {
    if (count >= ALLERGEN_TARGET_DOSES) completed.push(key);
    else inProgress[key] = count;
  }

  let daysSinceLastDose = 999;
  if (lastDate) {
    const last = new Date(`${lastDate}T00:00:00Z`);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    daysSinceLastDose = Math.floor(
      (today.getTime() - last.getTime()) / 86_400_000
    );
  }

  return {
    ageMonths,
    completed,
    inProgress,
    knownAllergies: state?.allergen_state?.known_allergies ?? [],
    paused: !!state?.allergen_state?.paused,
    daysSinceLastDose,
  };
}

/** Leid de status van een allergeen af uit de context. Spiegelt
 *  `getAllergenStatus()` uit `js/content/eersteHapjes-allergen-flow.js`. */
export function getAllergenStatus(
  key: string,
  ctx: AllergenContext
): AllergenStatus {
  if (ctx.knownAllergies.includes(key)) return 'allergisch';
  if (ctx.completed.includes(key)) return 'veilig';
  if (ctx.paused) return 'paused';
  const flow = ALLERGEN_FLOW.find(a => a.key === key);
  if (!flow) return 'wacht';
  if (ctx.ageMonths < flow.introFromMonths) return 'locked-age';
  if ((ctx.inProgress[key] || 0) > 0) return 'in-progress';
  return 'wacht';
}

/** Aantal geslaagde doses (`reaction === 'geen'`) voor een allergeen. */
export function successfulDoseCount(
  doses: EhDose[],
  allergenKey: string
): number {
  return doses.filter(
    d => d.allergen_key === allergenKey && d.reaction === 'geen'
  ).length;
}

/** Eerstvolgende vrije dose_number (1-3) voor een allergeen, op basis van
 *  de reeds geregistreerde doses voor dat allergeen. Geeft `null` als alle
 *  drie posities bezet zijn. */
export function nextDoseNumber(
  doses: EhDose[],
  allergenKey: string
): 1 | 2 | 3 | null {
  const taken = new Set(
    doses.filter(d => d.allergen_key === allergenKey).map(d => d.dose_number)
  );
  for (const n of [1, 2, 3] as const) {
    if (!taken.has(n)) return n;
  }
  return null;
}

/** Vandaag in YYYY-MM-DD (lokale tijdzone). */
export function todayIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
