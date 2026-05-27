/**
 * FAMILY SERVICE
 *
 * Beheert het gezins-dieet (een subset uit een vaste allow-list van 9
 * dieet-types). Wordt opgeslagen als `text[]` op `community_profiles.
 * family_diet`. Server-side worden waarden gedeprupliceerd, gelowercased,
 * gewhitelist en op max 9 items afgekapt.
 *
 * Endpoints:
 *   GET /api/family → { family_diet: string[] }
 *   PUT /api/family { family_diet: string[] } → { family_diet: string[] }
 *
 * Vereist een bestaand community-profile (anders geeft de server 409).
 *
 * Auth: Supabase JWT (Bearer token).
 */

import { supabase } from '../lib/supabase';
import { RAG_API_URL } from './hapjesheld';

/** 9 dieet-keys identiek aan `api/family.mjs` ALLOWED_DIET. Server is
 *  bron-van-waarheid; deze constante is alleen voor UI-rendering. */
export const DIET_OPTIONS: Array<{ key: string; label: string }> = [
  { key: 'vegetarisch', label: 'Vegetarisch' },
  { key: 'veganistisch', label: 'Veganistisch' },
  { key: 'glutenvrij', label: 'Glutenvrij' },
  { key: 'lactosevrij', label: 'Lactosevrij' },
  { key: 'pescotarisch', label: 'Pescotarisch' },
  { key: 'halal', label: 'Halal' },
  { key: 'kosher', label: 'Kosher' },
  { key: 'geen-varken', label: 'Geen varken' },
  { key: 'geen-rund', label: 'Geen rund' },
];

export const MAX_DIET_ITEMS = 9;

interface FamilyDietEnvelope {
  family_diet: string[];
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

/* ----------------------------------------
   getFamilyDiet
   GET /api/family — returns array van geselecteerde dieet-keys.
---------------------------------------- */
export async function getFamilyDiet(): Promise<string[]> {
  const response = await authedFetch('/api/family');
  const data = await jsonOrThrow<FamilyDietEnvelope>(response);
  return Array.isArray(data?.family_diet) ? data.family_diet : [];
}

/* ----------------------------------------
   setFamilyDiet
   PUT /api/family { family_diet: string[] }
   Server sanitizet, dedupliceert en kapt op MAX_DIET_ITEMS.
---------------------------------------- */
export async function setFamilyDiet(diet: string[]): Promise<string[]> {
  const response = await authedFetch('/api/family', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ family_diet: diet }),
  });
  const data = await jsonOrThrow<FamilyDietEnvelope>(response);
  return Array.isArray(data?.family_diet) ? data.family_diet : [];
}
