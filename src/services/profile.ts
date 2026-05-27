/**
 * PROFILE SERVICE
 *
 * Beheert profielinstellingen + GDPR-acties via de Vercel backend
 * (community-web.prilleven.be) — dezelfde API als de website.
 *
 * Endpoints:
 *   GET    /api/profile  → { profile: { memory_enabled }, usage, imageUsage }
 *   PUT    /api/profile  → { profile: { memory_enabled } }
 *   GET    /api/me       → JSON-bestand met alle persoonlijke data (download)
 *   DELETE /api/me       → "recht op vergetelheid" — wist alles
 *
 * Auth: Supabase JWT (Bearer-token). Identiek aan hapjesheld.ts.
 */

import { supabase } from '../lib/supabase';
import { RAG_API_URL } from './hapjesheld';

/* ----------------------------------------
   Types
---------------------------------------- */
export interface MemoryProfile {
  memory_enabled: boolean;
}

interface ProfileEnvelope {
  profile?: { memory_enabled?: boolean } | null;
}

/* ----------------------------------------
   Auth helper — haal huidige JWT op
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
   getMemoryEnabled
   GET /api/profile → memory_enabled
---------------------------------------- */
export async function getMemoryEnabled(): Promise<boolean> {
  const response = await authedFetch('/api/profile');
  const data = await jsonOrThrow<ProfileEnvelope>(response);
  return data?.profile?.memory_enabled !== false; // default true
}

/* ----------------------------------------
   setMemoryEnabled
   PUT /api/profile { memory_enabled }
---------------------------------------- */
export async function setMemoryEnabled(enabled: boolean): Promise<boolean> {
  const response = await authedFetch('/api/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ memory_enabled: enabled }),
  });
  const data = await jsonOrThrow<ProfileEnvelope>(response);
  return data?.profile?.memory_enabled !== false;
}

/* ----------------------------------------
   exportUserData
   GET /api/me → JSON-blob
   Geeft de raw JSON-string terug. Caller is verantwoordelijk
   voor wegschrijven naar disk + delen via share-sheet.
---------------------------------------- */
export async function exportUserData(): Promise<string> {
  const response = await authedFetch('/api/me');
  if (!response.ok) {
    const raw = await response.text();
    let msg = `Server gaf status ${response.status} terug.`;
    try {
      const j = JSON.parse(raw);
      if (j?.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return await response.text();
}

/* ----------------------------------------
   deleteAccount
   DELETE /api/me — onomkeerbare GDPR-actie.

   Backend wist (in volgorde):
     - chat_user_memory + chat_user_profiles
     - conversations + messages
     - usage_log
     - favorites + schedules
     - auth.users (deactiveert login)
   en anonimiseert publieke content (ratings, comments → "Anoniem").
---------------------------------------- */
export async function deleteAccount(): Promise<void> {
  const response = await authedFetch('/api/me', { method: 'DELETE' });

  const raw = await response.text();
  let data: any = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    /* niet-JSON */
  }

  // 200 = volledig succes, 207 = gedeeltelijk maar account is verwijderd
  if (response.status === 200) return;
  if (response.status === 207) {
    // partial success — gooi met de server-boodschap zodat de UI dat kan tonen
    const msg =
      (data && data.message) ||
      'Niet alle data kon worden verwijderd. Neem contact op met support.';
    throw new Error(msg);
  }

  const msg =
    (data && data.error) ||
    `Account kon niet worden verwijderd (status ${response.status}).`;
  throw new Error(msg);
}
