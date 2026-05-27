/**
 * MEMORY SERVICE
 *
 * Beheert de HapjesHeld-geheugen-items van de gebruiker (de feiten die
 * HapjesHeld zelf onthoudt uit eerdere gesprekken). De `memory_enabled`-
 * toggle staat los van deze lijst (zie `profile.ts`); deze service kan
 * altijd worden gebruikt om bestaande geheugen-items te bekijken en te
 * verwijderen, ook als de toggle uit staat.
 *
 * Endpoints:
 *   GET    /api/memory               → { memories: Memory[] }
 *   DELETE /api/memory?id=<uuid>     → 204 (single delete)
 *   DELETE /api/memory               → 204 (delete all)
 *
 * Auth: Supabase JWT (Bearer-token), identiek aan andere services.
 */

import { supabase } from '../lib/supabase';
import { RAG_API_URL } from './hapjesheld';

/* ----------------------------------------
   Types
---------------------------------------- */
export interface Memory {
  id: string;
  content: string;
  /** 1–5; hogere waarde = belangrijker. Server-side bepaald. */
  importance: number;
  /** ISO-datum waarop dit feit voor het eerst werd opgeslagen. */
  created_at: string;
  /** ISO-datum waarop het feit voor het laatst werd gebruikt in een
   *  HapjesHeld-antwoord; `null` als nog niet gebruikt. */
  last_used_at: string | null;
}

interface MemoriesEnvelope {
  memories: Memory[];
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

/** Variant voor DELETE-endpoints die 204 No Content teruggeven. */
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
   getMemories
   GET /api/memory — alle geheugen-items van de gebruiker.
---------------------------------------- */
export async function getMemories(): Promise<Memory[]> {
  const response = await authedFetch('/api/memory');
  const data = await jsonOrThrow<MemoriesEnvelope>(response);
  return Array.isArray(data?.memories) ? data.memories : [];
}

/* ----------------------------------------
   deleteMemory
   DELETE /api/memory?id=<uuid> — één geheugen-item.
---------------------------------------- */
export async function deleteMemory(id: string): Promise<void> {
  const response = await authedFetch(
    `/api/memory?id=${encodeURIComponent(id)}`,
    { method: 'DELETE' }
  );
  await okOrThrow(response);
}

/* ----------------------------------------
   deleteAllMemories
   DELETE /api/memory — wist alle geheugen-items.
---------------------------------------- */
export async function deleteAllMemories(): Promise<void> {
  const response = await authedFetch('/api/memory', { method: 'DELETE' });
  await okOrThrow(response);
}

/* ----------------------------------------
   Helpers — relatieve tijdstring
---------------------------------------- */

/** Korte relatieve tijdstring identiek aan website (`js/chat.js::relTime`):
 *  "net" / "5 min" / "3 u" / "12 d" / "3 mrt 2025". */
export function relTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return 'net';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} u`;
  if (seconds < 86400 * 30) return `${Math.floor(seconds / 86400)} d`;
  return d.toLocaleDateString('nl-BE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
