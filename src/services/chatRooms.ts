/**
 * CHATRUIMTES SERVICE
 *
 * Spiegelt de website-API op community-web.prilleven.be (api/chat-rooms.mjs).
 * Zelfde Vercel-functions als de webversie — geen aparte server.
 *
 * Hiërarchie: rooms → topics → replies. 4 vaste rooms (zie ROOMS).
 * Iedere ingelogde gebruiker met een nickname mag topics + replies maken;
 * eigen content is binnen 15 min bewerkbaar (RLS) en altijd verwijderbaar.
 * Admins kunnen alles verwijderen.
 *
 * Endpoints:
 *   GET    /api/chat-rooms                         → { rooms } (+ is_followed)
 *   GET    /api/chat-rooms/unread                  → { rooms, topics } (ongelezen-tellingen)
 *   GET    /api/chat-rooms/:slug                   → { room, topics } (+ is_followed)
 *   PATCH  /api/chat-rooms/:slug                   → { room } (admin: titel/omschrijving/welkomsbericht)
 *   POST   /api/chat-rooms/:slug/follow            → { ok: true } (room volgen)
 *   DELETE /api/chat-rooms/:slug/follow            → { ok: true } (room ontvolgen)
 *   POST   /api/chat-rooms/:slug/read              → { ok: true } (badges resetten)
 *   GET    /api/chat-rooms/topics/:id              → { topic, replies } (+ is_followed)
 *   POST   /api/chat-rooms/:slug/topics            → { topic } (201)
 *   PATCH  /api/chat-rooms/topics/:id              → { topic }
 *   DELETE /api/chat-rooms/topics/:id              → { ok: true }
 *   POST   /api/chat-rooms/topics/:id/pin          → { id, is_pinned } (admin)
 *   POST   /api/chat-rooms/topics/:id/follow       → { ok: true } (topic volgen)
 *   DELETE /api/chat-rooms/topics/:id/follow       → { ok: true } (topic ontvolgen)
 *   POST   /api/chat-rooms/topics/:id/read         → { ok: true } (topic-badge resetten)
 *   POST   /api/chat-rooms/topics/:id/replies      → { reply } (201)
 *   PATCH  /api/chat-rooms/replies/:id             → { reply }
 *   DELETE /api/chat-rooms/replies/:id             → { ok: true }
 *
 * Auth: Bearer <supabase access_token>, identiek aan community.ts.
 *
 * Foutcodes (server geeft NL-message in `error`):
 *   412 → nog geen nickname ingesteld (door naar Profiel)
 *   422 → validatie of moderatie geweigerd
 *   403 → niet jouw topic/reactie
 *   404 → niet gevonden
 *
 * Let op: `avatar_url` is een signed URL met 1u TTL — niet lang cachen.
 */

import { supabase } from '../lib/supabase';
import { RAG_API_URL } from './hapjesheld';

/* ----------------------------------------
   Vaste rooms (mirror website)
---------------------------------------- */
export const ROOMS: { slug: string; title: string; emoji: string }[] = [
  { slug: 'melk-voeding', title: 'Melk & voeding', emoji: '🍼' },
  { slug: 'eerste-hapjes', title: 'Eerste hapjes', emoji: '🥄' },
  {
    slug: 'allergieen-overgevoeligheden',
    title: 'Allergieën & overgevoeligheden',
    emoji: '🌾',
  },
  { slug: 'feedback', title: 'Feedback', emoji: '💬' },
];

const ROOM_EMOJI: Record<string, string> = ROOMS.reduce(
  (acc, r) => {
    acc[r.slug] = r.emoji;
    return acc;
  },
  {} as Record<string, string>
);

export function roomEmoji(slug: string | null | undefined): string {
  return (slug && ROOM_EMOJI[slug]) || '💬';
}

/* ----------------------------------------
   Validatie-grenzen (mirror server)
---------------------------------------- */
export const TOPIC_TITLE_MAX = 120;
export const TOPIC_BODY_MAX = 4000;
export const REPLY_BODY_MAX = 2000;

/* Admin-welkomsbericht: 1-4000 tekens (mirror server room.edit). */
export const ADMIN_INTRO_MAX = 4000;

/* Bewerk-venster: server staat owner-edit toe binnen 15 min (RLS). */
export const EDIT_WINDOW_MS = 15 * 60 * 1000;

/* ----------------------------------------
   Types — letterlijke veldnamen uit api/chat-rooms.mjs
---------------------------------------- */
export interface AdminIntro {
  message: string;
  updated_at: string;
  user_id: string;
  nickname: string | null;
  avatar_path: string | null;
  avatar_url: string | null; // signed, 1u TTL
  author_is_admin: boolean;
}

export interface ChatRoom {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  sort_order: number;
  is_active?: boolean;
  is_followed?: boolean;
}

export interface ChatRoomDetail extends ChatRoom {
  admin_intro: AdminIntro | null;
}

export interface ChatTopic {
  id: string;
  room_id: string;
  user_id: string;
  title: string;
  body: string;
  is_pinned: boolean;
  edited_at: string | null;
  created_at: string;
  nickname: string | null;
  avatar_path: string | null;
  avatar_url: string | null; // signed, 1u TTL
  replies_count: number;
  last_reply_at: string | null;
  author_is_admin: boolean;
  is_followed?: boolean;
}

export interface ChatReply {
  id: string;
  topic_id: string;
  user_id: string;
  body: string;
  edited_at: string | null;
  created_at: string;
  nickname: string | null;
  avatar_path: string | null;
  avatar_url: string | null; // signed, 1u TTL
  author_is_admin: boolean;
}

interface RoomsEnvelope {
  rooms: ChatRoom[];
}
interface RoomEnvelope {
  room: ChatRoomDetail;
  topics: ChatTopic[];
}
interface TopicEnvelope {
  topic: ChatTopic;
  replies?: ChatReply[];
}
interface ReplyEnvelope {
  reply: ChatReply;
}

/**
 * Ongelezen-tellingen voor gevolgde rooms/topics.
 *   rooms  → { [room_id]: aantal nieuwe topics sinds last_read_at/followed_at }
 *   topics → { [topic_id]: aantal nieuwe replies sinds last_read_at/followed_at }
 * Enkel rooms/topics mét unread > 0 staan in de map.
 */
export interface UnreadCounts {
  rooms: Record<string, number>;
  topics: Record<string, number>;
}

/* ----------------------------------------
   Auth + fetch helpers (kopie van community.ts)
---------------------------------------- */
async function getAuthToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error('Sessie kon niet worden opgehaald.');
  const token = data.session?.access_token;
  if (!token) {
    throw new Error('Niet ingelogd — log opnieuw in.');
  }
  return token;
}

/**
 * Huidige auth-user-id. Nodig voor eigenaarschap-checks (eigen topic/
 * reactie tonen edit/delete-knoppen). UserContext bewaart enkel de e-mail,
 * niet de UUID — daarom hier los ophalen uit de sessie.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
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
  if (response.ok) return;
  const raw = await response.text();
  let data: any = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    /* niet-JSON response */
  }
  const message =
    (data && data.error) ||
    `Server gaf status ${response.status} terug. Probeer het later opnieuw.`;
  throw new Error(message);
}

/* ----------------------------------------
   listRooms
   GET /api/chat-rooms → { rooms } (gesorteerd op sort_order)
---------------------------------------- */
export async function listRooms(): Promise<ChatRoom[]> {
  const response = await authedFetch('/api/chat-rooms');
  const data = await jsonOrThrow<RoomsEnvelope>(response);
  return data?.rooms ?? [];
}

/* ----------------------------------------
   getRoom
   GET /api/chat-rooms/:slug → { room, topics }
---------------------------------------- */
export async function getRoom(
  slug: string
): Promise<{ room: ChatRoomDetail; topics: ChatTopic[] }> {
  const response = await authedFetch(
    `/api/chat-rooms/${encodeURIComponent(slug)}`
  );
  const data = await jsonOrThrow<RoomEnvelope>(response);
  return { room: data.room, topics: data?.topics ?? [] };
}

/* ----------------------------------------
   getTopic
   GET /api/chat-rooms/topics/:id → { topic, replies }
---------------------------------------- */
export async function getTopic(
  topicId: string
): Promise<{ topic: ChatTopic; replies: ChatReply[] }> {
  const response = await authedFetch(
    `/api/chat-rooms/topics/${encodeURIComponent(topicId)}`
  );
  const data = await jsonOrThrow<TopicEnvelope>(response);
  return { topic: data.topic, replies: data?.replies ?? [] };
}

/* ----------------------------------------
   createTopic
   POST /api/chat-rooms/:slug/topics { title, body } → { topic } (201)
   412 zonder nickname, 422 bij validatie/moderatie.
---------------------------------------- */
export async function createTopic(
  slug: string,
  input: { title: string; body: string }
): Promise<ChatTopic> {
  const response = await authedFetch(
    `/api/chat-rooms/${encodeURIComponent(slug)}/topics`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: input.title, body: input.body }),
    }
  );
  const data = await jsonOrThrow<TopicEnvelope>(response);
  if (!data?.topic) throw new Error('Topic kon niet worden geplaatst.');
  return data.topic;
}

/* ----------------------------------------
   updateTopic
   PATCH /api/chat-rooms/topics/:id { title?, body? } → { topic }
   403 "Niet jouw topic." buiten het bewerk-venster of niet-eigenaar.
---------------------------------------- */
export async function updateTopic(
  topicId: string,
  patch: { title?: string; body?: string }
): Promise<ChatTopic> {
  const response = await authedFetch(
    `/api/chat-rooms/topics/${encodeURIComponent(topicId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }
  );
  const data = await jsonOrThrow<TopicEnvelope>(response);
  if (!data?.topic) throw new Error('Topic kon niet worden bijgewerkt.');
  return data.topic;
}

/* ----------------------------------------
   deleteTopic
   DELETE /api/chat-rooms/topics/:id → { ok: true }
---------------------------------------- */
export async function deleteTopic(topicId: string): Promise<void> {
  const response = await authedFetch(
    `/api/chat-rooms/topics/${encodeURIComponent(topicId)}`,
    { method: 'DELETE' }
  );
  await okOrThrow(response);
}

/* ----------------------------------------
   createReply
   POST /api/chat-rooms/topics/:id/replies { body } → { reply } (201)
   412 zonder nickname.
---------------------------------------- */
export async function createReply(
  topicId: string,
  body: string
): Promise<ChatReply> {
  const response = await authedFetch(
    `/api/chat-rooms/topics/${encodeURIComponent(topicId)}/replies`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    }
  );
  const data = await jsonOrThrow<ReplyEnvelope>(response);
  if (!data?.reply) throw new Error('Reactie kon niet worden geplaatst.');
  return data.reply;
}

/* ----------------------------------------
   updateReply
   PATCH /api/chat-rooms/replies/:id { body } → { reply }
---------------------------------------- */
export async function updateReply(
  replyId: string,
  body: string
): Promise<ChatReply> {
  const response = await authedFetch(
    `/api/chat-rooms/replies/${encodeURIComponent(replyId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    }
  );
  const data = await jsonOrThrow<ReplyEnvelope>(response);
  if (!data?.reply) throw new Error('Reactie kon niet worden bijgewerkt.');
  return data.reply;
}

/* ----------------------------------------
   deleteReply
   DELETE /api/chat-rooms/replies/:id → { ok: true }
---------------------------------------- */
export async function deleteReply(replyId: string): Promise<void> {
  const response = await authedFetch(
    `/api/chat-rooms/replies/${encodeURIComponent(replyId)}`,
    { method: 'DELETE' }
  );
  await okOrThrow(response);
}

/* ----------------------------------------
   getUnread
   GET /api/chat-rooms/unread → { rooms, topics }
   Ongelezen-tellingen per gevolgde room/topic. Defensief: bij fout
   lege maps zodat de roomlijst nooit crasht.
---------------------------------------- */
export async function getUnread(): Promise<UnreadCounts> {
  try {
    const response = await authedFetch('/api/chat-rooms/unread');
    const data = await jsonOrThrow<UnreadCounts>(response);
    return { rooms: data?.rooms ?? {}, topics: data?.topics ?? {} };
  } catch {
    return { rooms: {}, topics: {} };
  }
}

/* ----------------------------------------
   followRoom
   POST /api/chat-rooms/:slug/follow → { ok: true }
---------------------------------------- */
export async function followRoom(slug: string): Promise<void> {
  const response = await authedFetch(
    `/api/chat-rooms/${encodeURIComponent(slug)}/follow`,
    { method: 'POST' }
  );
  await okOrThrow(response);
}

/* ----------------------------------------
   unfollowRoom
   DELETE /api/chat-rooms/:slug/follow → { ok: true }
---------------------------------------- */
export async function unfollowRoom(slug: string): Promise<void> {
  const response = await authedFetch(
    `/api/chat-rooms/${encodeURIComponent(slug)}/follow`,
    { method: 'DELETE' }
  );
  await okOrThrow(response);
}

/* ----------------------------------------
   markRoomRead
   POST /api/chat-rooms/:slug/read → { ok: true }
   Werkt last_read_at bij zodat de ongelezen-badge reset. Stil falen:
   een mislukte read-markering mag het openen van de room niet blokkeren.
---------------------------------------- */
export async function markRoomRead(slug: string): Promise<void> {
  try {
    const response = await authedFetch(
      `/api/chat-rooms/${encodeURIComponent(slug)}/read`,
      { method: 'POST' }
    );
    await okOrThrow(response);
  } catch {
    /* niet-kritisch */
  }
}

/* ----------------------------------------
   followTopic / unfollowTopic
   POST/DELETE /api/chat-rooms/topics/:id/follow → { ok: true }

   Een gevolgd topic verschijnt op de tijdlijn (source_type 'chatroom'),
   ook als de bijbehorende room niet gevolgd wordt — de server mengt
   gevolgde rooms én losse gevolgde topics in de feed.
---------------------------------------- */
export async function followTopic(topicId: string): Promise<void> {
  const response = await authedFetch(
    `/api/chat-rooms/topics/${encodeURIComponent(topicId)}/follow`,
    { method: 'POST' }
  );
  await okOrThrow(response);
}

export async function unfollowTopic(topicId: string): Promise<void> {
  const response = await authedFetch(
    `/api/chat-rooms/topics/${encodeURIComponent(topicId)}/follow`,
    { method: 'DELETE' }
  );
  await okOrThrow(response);
}

/* ----------------------------------------
   markTopicRead
   POST /api/chat-rooms/topics/:id/read → { ok: true }
   Werkt last_read_at van het gevolgde topic bij. Stil falen.
---------------------------------------- */
export async function markTopicRead(topicId: string): Promise<void> {
  try {
    const response = await authedFetch(
      `/api/chat-rooms/topics/${encodeURIComponent(topicId)}/read`,
      { method: 'POST' }
    );
    await okOrThrow(response);
  } catch {
    /* niet-kritisch */
  }
}

/* ----------------------------------------
   pinTopic (admin)
   POST /api/chat-rooms/topics/:id/pin { pin? } → { id, is_pinned }
   Zonder `pin` togglet de server de huidige staat. 403 voor niet-admins.
---------------------------------------- */
export async function pinTopic(
  topicId: string,
  pin?: boolean
): Promise<{ id: string; is_pinned: boolean }> {
  const response = await authedFetch(
    `/api/chat-rooms/topics/${encodeURIComponent(topicId)}/pin`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(typeof pin === 'boolean' ? { pin } : {}),
    }
  );
  const data = await jsonOrThrow<{ id: string; is_pinned: boolean }>(response);
  return { id: data.id, is_pinned: !!data.is_pinned };
}

/* ----------------------------------------
   updateRoom (admin)
   PATCH /api/chat-rooms/:slug { admin_intro_message?, title?, description? }
   → { room }

   admin_intro_message:
     - string (1-4000)        → welkomsbericht zetten/bijwerken
     - null OF lege string     → welkomsbericht verwijderen
   422 "Geen wijzigingen." als de body leeg is. 403 voor niet-admins.
---------------------------------------- */
export async function updateRoom(
  slug: string,
  patch: {
    admin_intro_message?: string | null;
    title?: string;
    description?: string;
  }
): Promise<ChatRoomDetail> {
  const response = await authedFetch(
    `/api/chat-rooms/${encodeURIComponent(slug)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }
  );
  const data = await jsonOrThrow<{ room: ChatRoomDetail }>(response);
  if (!data?.room) throw new Error('Chatruimte kon niet worden bijgewerkt.');
  return data.room;
}

/* ----------------------------------------
   reportChatTarget (App Store Guideline 1.2)
   POST /api/chat-rooms/report { target_type, target_id, reason? }
   target_type: 'topic' | 'reply'. Server slaat op in chat_reports en
   toont het in de admin-queue. 201 = ontvangen.
---------------------------------------- */
export async function reportChatTarget(
  targetType: 'topic' | 'reply',
  targetId: string,
  reason?: string
): Promise<void> {
  const response = await authedFetch('/api/chat-rooms/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      target_type: targetType,
      target_id: targetId,
      reason: reason ?? null,
    }),
  });
  await okOrThrow(response);
}

/* ----------------------------------------
   Helpers
---------------------------------------- */
/** Is dit topic/reactie nog bewerkbaar door de eigenaar (binnen 15 min)? */
export function isWithinEditWindow(createdAt: string): boolean {
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return false;
  return Date.now() - created < EDIT_WINDOW_MS;
}
