/**
 * COMMUNITY PROFILE SERVICE
 *
 * Beheert het publieke community-profiel: nickname + avatar.
 * Identieke API als de website (community-web.prilleven.be).
 *
 * Endpoints:
 *   GET  /api/community/profile            → huidig profiel + signed avatar_url
 *   PUT  /api/community/profile            → nickname / avatar_path wijzigen
 *   POST /api/community/profile/avatar-url → signed upload-URL (5 min TTL)
 *
 * Avatar-upload-flow:
 *   1. getAvatarUploadUrl()       → { path, uploadUrl }
 *   2. uploadAvatarToStorage(...) → PUT blob naar signed URL
 *   3. updateCommunityProfile({ avatar_path: path })
 *
 * Nickname-regex: ^[A-Za-z0-9_\- ]{2,30}$
 */

import { supabase } from '../lib/supabase';
import { RAG_API_URL } from './hapjesheld';

/* ----------------------------------------
   Types
---------------------------------------- */
export interface CommunityProfile {
  user_id: string;
  nickname: string;
  avatar_path: string | null;
  avatar_url: string | null; // signed URL, 1u TTL (alleen in response, niet in DB)
  created_at: string;
  updated_at: string;
}

interface ProfileEnvelope {
  profile: CommunityProfile | null;
}

interface AvatarUrlEnvelope {
  path: string;
  uploadUrl: string;
  token?: string;
}

/** Spiegelt website-validatie zodat we niet onnodig een 422 ophalen. */
export const NICKNAME_REGEX = /^[A-Za-z0-9_\- ]{2,30}$/;

/* ----------------------------------------
   Auth helper — JWT via Supabase
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
   getCommunityProfile
   GET /api/community/profile
   Returnt null wanneer er nog géén profiel bestaat (eerste keer).
---------------------------------------- */
export async function getCommunityProfile(): Promise<CommunityProfile | null> {
  const response = await authedFetch('/api/community/profile');
  const data = await jsonOrThrow<ProfileEnvelope>(response);
  return data?.profile ?? null;
}

/* ----------------------------------------
   updateCommunityProfile
   PUT /api/community/profile { nickname?, avatar_path? }

   - Bij eerste creatie is `nickname` verplicht.
   - `avatar_path: null` verwijdert de avatar uit de profile-rij
     (file in storage blijft staan — wordt later opgeruimd door
     account-delete).
   - Velden die je niet meegeeft blijven ongewijzigd.
---------------------------------------- */
export async function updateCommunityProfile(updates: {
  nickname?: string;
  avatar_path?: string | null;
}): Promise<CommunityProfile> {
  const response = await authedFetch('/api/community/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  const data = await jsonOrThrow<ProfileEnvelope>(response);
  if (!data?.profile) {
    throw new Error('Profiel kon niet worden bijgewerkt.');
  }
  return data.profile;
}

/* ----------------------------------------
   getAvatarUploadUrl
   POST /api/community/profile/avatar-url
   Server kiest het pad ({user_id}/avatars/{random}.jpg) en
   maakt een signed upload-URL aan (5 min TTL).
---------------------------------------- */
export async function getAvatarUploadUrl(): Promise<{
  path: string;
  uploadUrl: string;
}> {
  const response = await authedFetch('/api/community/profile/avatar-url', {
    method: 'POST',
  });
  const data = await jsonOrThrow<AvatarUrlEnvelope>(response);
  if (!data?.uploadUrl || !data?.path) {
    throw new Error('Kon geen upload-link aanmaken.');
  }
  return { path: data.path, uploadUrl: data.uploadUrl };
}

/* ----------------------------------------
   uploadAvatarToStorage
   PUT direct naar de signed Supabase-Storage-URL.

   `localUri` is een file://-pad van expo-image-picker /
   expo-image-manipulator.
---------------------------------------- */
export async function uploadAvatarToStorage(
  localUri: string,
  uploadUrl: string,
  mimeType: string = 'image/jpeg'
): Promise<void> {
  // fetch() werkt op file:// URIs op iOS en Android in RN.
  const fileResponse = await fetch(localUri);
  const blob = await fileResponse.blob();

  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': mimeType,
      'x-upsert': 'true',
    },
    body: blob,
  });

  if (!uploadResponse.ok) {
    const raw = await uploadResponse.text().catch(() => '');
    throw new Error(
      raw || `Upload mislukt (status ${uploadResponse.status}).`
    );
  }
}
