/**
 * LEARNINGS SERVICE — read-only viewer
 *
 * Toont de "Learnings"-bibliotheek (documenten, blogs en video's) die admins
 * via de website beheren. De mobiele app is read-only: bekijken + favoriet
 * togglen. Aanmaken/bewerken/verwijderen gebeurt uitsluitend op de website
 * (admin-only POST/PATCH/DELETE-routes).
 *
 * Endpoints (op community-web.prilleven.be, JWT-Bearer-auth):
 *   GET  /api/learnings              → { learnings: Learning[] }   (?kind=, ?favorites=1)
 *   GET  /api/learnings/:id          → { learning: LearningDetail } (incl. signed_url voor pdf/video)
 *   POST /api/learnings/:id/favorite → { is_favorite: boolean }     (toggle)
 *
 * Drie soorten content (`kind`):
 *   blog  → HTML-artikel in `body_html`
 *   pdf   → PDF-bestand, server geeft tijdelijke `signed_url` (10 min TTL)
 *   video → video-bestand, server geeft tijdelijke `signed_url` (4 u TTL)
 *
 * Notities/clips/bookmarks van de website laten we (voorlopig) buiten de
 * mobiele app — enkel bekijken.
 *
 * Auth: Supabase JWT (Bearer-token), identiek aan andere services.
 */

import { supabase } from '../lib/supabase';
import { RAG_API_URL } from './hapjesheld';

/* ----------------------------------------
   Types
---------------------------------------- */
export type LearningKind = 'pdf' | 'blog' | 'video';

/** Lijst-item zoals teruggegeven door GET /api/learnings. */
export interface Learning {
  id: string;
  kind: LearningKind;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  /** Video-duur in seconden; null voor blog/pdf. */
  duration_sec: number | null;
  tags: string[];
  created_at: string;
  /** Of deze gebruiker dit item als favoriet heeft gemarkeerd. */
  is_favorite: boolean;
}

/** Detail zoals teruggegeven door GET /api/learnings/:id. */
export interface LearningDetail extends Learning {
  /** HTML-inhoud voor blogs; null voor pdf/video. */
  body_html: string | null;
  /** Tijdelijke signed URL voor pdf/video; null voor blogs. */
  signed_url: string | null;
}

interface LearningsEnvelope {
  learnings: Learning[];
}

interface LearningEnvelope {
  learning: LearningDetail;
}

interface FavoriteEnvelope {
  is_favorite: boolean;
}

/* ----------------------------------------
   Auth + fetch helpers (consistent met andere services)
---------------------------------------- */
async function getAuthToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error('Sessie kon niet worden opgehaald.');
  const token = data.session?.access_token;
  if (!token) {
    throw new Error('Niet ingelogd — log opnieuw in om dit te bekijken.');
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
   getLearnings
   GET /api/learnings — bibliotheek, optioneel gefilterd.
---------------------------------------- */
export async function getLearnings(opts?: {
  kind?: LearningKind;
  favoritesOnly?: boolean;
}): Promise<Learning[]> {
  const params = new URLSearchParams();
  if (opts?.kind) params.set('kind', opts.kind);
  if (opts?.favoritesOnly) params.set('favorites', '1');
  const qs = params.toString();
  const response = await authedFetch(`/api/learnings${qs ? `?${qs}` : ''}`);
  const data = await jsonOrThrow<LearningsEnvelope>(response);
  return Array.isArray(data?.learnings) ? data.learnings : [];
}

/* ----------------------------------------
   getLearning
   GET /api/learnings/:id — detail incl. signed_url / body_html.
---------------------------------------- */
export async function getLearning(id: string): Promise<LearningDetail> {
  const response = await authedFetch(`/api/learnings/${encodeURIComponent(id)}`);
  const data = await jsonOrThrow<LearningEnvelope>(response);
  return data.learning;
}

/* ----------------------------------------
   toggleLearningFavorite
   POST /api/learnings/:id/favorite — togglet en geeft de nieuwe staat terug.
---------------------------------------- */
export async function toggleLearningFavorite(
  id: string
): Promise<boolean> {
  const response = await authedFetch(
    `/api/learnings/${encodeURIComponent(id)}/favorite`,
    { method: 'POST' }
  );
  const data = await jsonOrThrow<FavoriteEnvelope>(response);
  return !!data?.is_favorite;
}

/* ----------------------------------------
   Helpers
---------------------------------------- */

/** Emoji-icoon per type, identiek aan de website-bibliotheek. */
export function learningKindIcon(kind: LearningKind): string {
  if (kind === 'pdf') return '📄';
  if (kind === 'video') return '🎬';
  return '📝';
}

/** Korte NL-typelabel ('Document' / 'Blog' / 'Video'). */
export function learningKindLabel(kind: LearningKind): string {
  if (kind === 'pdf') return 'Document';
  if (kind === 'video') return 'Video';
  return 'Blog';
}

/** Formatteert een video-duur (seconden) als "m:ss"; lege string indien null. */
export function formatDuration(seconds: number | null): string {
  if (seconds == null || seconds <= 0) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
