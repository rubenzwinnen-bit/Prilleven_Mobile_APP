/**
 * CHILDREN SERVICE
 *
 * Beheert kinderen van een gezin via dezelfde Vercel-API als de website.
 * Eén tabel `children` met soft-delete (`archived_at`); `introduced_allergens`
 * is server-side computed op basis van geregistreerde HapjesHeld-doses.
 *
 * Endpoints:
 *   GET    /api/children → { children: Child[] }   (niet-gearchiveerd)
 *   POST   /api/children → { child: Child }        (201)
 *   PATCH  /api/children → { child: Child }        (body: { id, ...fields })
 *   DELETE /api/children → { ok: true }            (body: { id }; soft delete)
 *
 * Auth: Supabase JWT (Bearer-token), identiek aan profile.ts /
 * communityProfile.ts.
 */

import { supabase } from '../lib/supabase';
import { RAG_API_URL } from './hapjesheld';

/* ----------------------------------------
   Types
---------------------------------------- */
export type TexturePreference = 'puree' | 'stukjes' | 'combi';

export interface Child {
  id: string;
  user_id: string;
  name: string;
  birthdate: string; // YYYY-MM-DD
  texture_preference: TexturePreference | null;
  has_eczema: boolean;
  known_allergies: string[];
  previous_reactions: string | null;
  notes: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  introduced_allergens: string[]; // server-side computed
}

/** Velden die client mag insturen bij POST/PATCH. */
export interface ChildInput {
  name?: string;
  birthdate?: string;
  texture_preference?: TexturePreference | null;
  has_eczema?: boolean;
  known_allergies?: string[];
  previous_reactions?: string | null;
  notes?: string | null;
}

interface ChildrenListEnvelope {
  children: Child[];
}

interface ChildEnvelope {
  child: Child;
}

/** Geboortedatum-regex (identiek aan server). */
export const BIRTHDATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** Hoofdallergenen (9 keys + label + emoji) — gespiegeld van
 *  `js/content/eersteHapjes-allergen-flow.js` op de website. Stabiele
 *  keys gebruiken we zowel in `known_allergies` als in de toekomstige
 *  allergenen-tracker. */
export const KNOWN_ALLERGEN_OPTIONS: Array<{
  key: string;
  label: string;
  icon: string;
}> = [
  { key: 'kippen-ei', label: 'Kippenei', icon: '🥚' },
  { key: 'pinda', label: 'Pinda', icon: '🥜' },
  { key: 'noten', label: 'Noten', icon: '🌰' },
  { key: 'sesam', label: 'Sesam', icon: '🌻' },
  { key: 'vis', label: 'Vis', icon: '🐟' },
  { key: 'schaaldieren', label: 'Schaaldieren', icon: '🦐' },
  { key: 'soja', label: 'Soja', icon: '🌱' },
  { key: 'tarwe', label: 'Tarwe', icon: '🌾' },
  { key: 'koemelk', label: 'Koemelk', icon: '🥛' },
];

export const TEXTURE_OPTIONS: Array<{
  key: TexturePreference;
  label: string;
}> = [
  { key: 'puree', label: 'Puree' },
  { key: 'stukjes', label: 'Stukjes' },
  { key: 'combi', label: 'Combinatie' },
];

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

/* ----------------------------------------
   getChildren
   GET /api/children — niet-gearchiveerde kinderen, oudste eerst.
---------------------------------------- */
export async function getChildren(): Promise<Child[]> {
  const response = await authedFetch('/api/children');
  const data = await jsonOrThrow<ChildrenListEnvelope>(response);
  return data?.children ?? [];
}

/* ----------------------------------------
   createChild
   POST /api/children — name + birthdate verplicht.
---------------------------------------- */
export async function createChild(input: ChildInput): Promise<Child> {
  const response = await authedFetch('/api/children', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await jsonOrThrow<ChildEnvelope>(response);
  if (!data?.child) throw new Error('Kind kon niet worden aangemaakt.');
  return data.child;
}

/* ----------------------------------------
   updateChild
   PATCH /api/children { id, ...patch }
---------------------------------------- */
export async function updateChild(
  id: string,
  patch: ChildInput
): Promise<Child> {
  const response = await authedFetch('/api/children', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ...patch }),
  });
  const data = await jsonOrThrow<ChildEnvelope>(response);
  if (!data?.child) throw new Error('Kind kon niet worden bijgewerkt.');
  return data.child;
}

/* ----------------------------------------
   archiveChild
   DELETE /api/children { id }  — soft delete (zet archived_at).
---------------------------------------- */
export async function archiveChild(id: string): Promise<void> {
  const response = await authedFetch('/api/children', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
  await jsonOrThrow<{ ok: true }>(response);
}

/* ----------------------------------------
   Helpers — leeftijd-berekening voor UI
---------------------------------------- */

/** Geboortedatum (YYYY-MM-DD) → leeftijd in maanden (afgerond naar
 *  beneden). Houdt rekening met de exacte dag van de maand. */
export function ageInMonths(birthdate: string, now: Date = new Date()): number {
  if (!BIRTHDATE_REGEX.test(birthdate)) return 0;
  const [y, m, d] = birthdate.split('-').map(Number);
  if (!y || !m || !d) return 0;
  let months =
    (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m);
  if (now.getDate() < d) months -= 1;
  return Math.max(0, months);
}

/** Geeft een leesbare leeftijd terug:
 *    "3 maanden", "11 maanden", "1 jaar 2 maanden", "4 jaar". */
export function formatAge(birthdate: string, now: Date = new Date()): string {
  const total = ageInMonths(birthdate, now);
  if (total < 1) return 'pasgeboren';
  if (total < 24) return `${total} ${total === 1 ? 'maand' : 'maanden'}`;
  const years = Math.floor(total / 12);
  const rest = total % 12;
  if (rest === 0) return `${years} ${years === 1 ? 'jaar' : 'jaar'}`;
  return `${years} ${years === 1 ? 'jaar' : 'jaar'} ${rest} ${
    rest === 1 ? 'maand' : 'maanden'
  }`;
}
