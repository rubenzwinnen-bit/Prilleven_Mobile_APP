/**
 * COMMUNITY SERVICE — tijdlijn (MVP)
 *
 * Spiegelt de website-API op community-web.prilleven.be. Zelfde Vercel-
 * functions als de webversie (api/community.mjs) — geen aparte server.
 *
 * MVP-scope: feed lezen + posts liken + replies lezen/plaatsen +
 * (admin-only) tekst-post plaatsen. Foto's, polls, reply-likes,
 * edit/delete, rapporteren en notificaties volgen in latere iteraties.
 *
 * Endpoints:
 *   GET  /api/community/posts?category=&before=&limit=  → feed (cursor-based)
 *   POST /api/community/posts                            → post maken
 *   POST /api/community/posts/:id/like                   → like toggle
 *   GET  /api/community/posts/:id/replies                → replies lijst
 *   POST /api/community/posts/:id/replies                → reply maken
 *   GET  /api/subscription-status?email=                 → is_admin check
 *
 * Auth: Bearer <supabase access_token>, identiek aan hapjesheld.ts.
 *
 * Paginatie is CURSOR-based via `before` (= created_at ISO-string van de
 * laatste niet-gepinde post), niet offset/page.
 *
 * Let op: `avatar_url` en `image_url` zijn signed URLs met 1u TTL — niet
 * lang cachen; bij stale beeld de feed opnieuw laden.
 */

import { supabase } from '../lib/supabase';
import { RAG_API_URL } from './hapjesheld';

/* ----------------------------------------
   Categorieën (mirror website)
---------------------------------------- */
export interface CategoryInfo {
  key: string;
  label: string;
  emoji: string;
}

export const POST_CATEGORIES: CategoryInfo[] = [
  { key: 'algemeen', label: 'Algemeen', emoji: '💬' },
  { key: 'vraag', label: 'Vraag', emoji: '❓' },
  { key: 'tip', label: 'Tip', emoji: '💡' },
  { key: 'mijlpaal', label: 'Mijlpaal', emoji: '⭐' },
  { key: 'voeding', label: 'Voeding', emoji: '🥕' },
  { key: 'slapen', label: 'Slapen', emoji: '😴' },
];

export function categoryInfo(key: string | null | undefined): CategoryInfo {
  return (
    POST_CATEGORIES.find((c) => c.key === key) ?? POST_CATEGORIES[0]
  );
}

/* ----------------------------------------
   Types — letterlijke veldnamen uit api/_lib/community.mjs
---------------------------------------- */
export interface CommunityPost {
  id: string;
  user_id: string;
  body: string;
  category: string;
  image_path: string | null;
  is_pinned: boolean;
  edited_at: string | null;
  created_at: string;
  nickname: string | null;
  likes_count: number;
  replies_count: number;
  has_poll: boolean;
  source_type: 'community' | 'chatroom';
  liked_by_me: boolean;
  image_url: string | null; // signed, 1u TTL
  avatar_url: string | null; // signed, 1u TTL
  poll: unknown | null; // MVP: niet gerenderd
  author_is_admin: boolean;
}

export interface CommunityReply {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  edited_at: string | null;
  created_at: string;
  nickname: string | null;
  avatar_url: string | null; // signed
  likes_count: number;
  liked_by_me: boolean;
  author_is_admin: boolean;
}

interface PostsEnvelope {
  posts: CommunityPost[];
}
interface PostEnvelope {
  post: CommunityPost;
}
interface RepliesEnvelope {
  replies: CommunityReply[];
}
interface ReplyEnvelope {
  reply: CommunityReply;
}
interface LikeEnvelope {
  liked: boolean;
  count: number;
}

/* Validatie-grenzen, spiegelt de server zodat we niet onnodig 422 ophalen. */
export const POST_BODY_MAX = 4000;
export const REPLY_BODY_MAX = 2000;

/* ----------------------------------------
   Auth + fetch helpers (kopie van communityProfile.ts)
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
   listPosts
   GET /api/community/posts?before=&limit=&category=

   Cursor-paginatie: `before` = created_at ISO-string van de laatste
   geladen (niet-gepinde) community-post.
---------------------------------------- */
export async function listPosts(opts: {
  before?: string;
  limit?: number;
  category?: string;
} = {}): Promise<CommunityPost[]> {
  const params = new URLSearchParams();
  if (opts.before) params.set('before', opts.before);
  if (opts.limit) params.set('limit', String(opts.limit));
  if (opts.category) params.set('category', opts.category);
  const qs = params.toString();
  const response = await authedFetch(
    `/api/community/posts${qs ? `?${qs}` : ''}`
  );
  const data = await jsonOrThrow<PostsEnvelope>(response);
  return data?.posts ?? [];
}

/* ----------------------------------------
   createPost (admin-only in de UI, server staat eigen insert toe)
   POST /api/community/posts { body, category, image_path, poll }
   412 wanneer er nog geen nickname is ingesteld.
---------------------------------------- */
export async function createPost(input: {
  body: string;
  category?: string;
}): Promise<CommunityPost> {
  const response = await authedFetch('/api/community/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      body: input.body,
      category: input.category ?? 'algemeen',
      image_path: null,
      poll: null,
    }),
  });
  const data = await jsonOrThrow<PostEnvelope>(response);
  if (!data?.post) throw new Error('Post kon niet worden geplaatst.');
  return data.post;
}

/* ----------------------------------------
   togglePostLike
   POST /api/community/posts/:id/like → { liked, count }
---------------------------------------- */
export async function togglePostLike(
  postId: string
): Promise<{ liked: boolean; count: number }> {
  const response = await authedFetch(
    `/api/community/posts/${encodeURIComponent(postId)}/like`,
    { method: 'POST' }
  );
  const data = await jsonOrThrow<LikeEnvelope>(response);
  return { liked: !!data?.liked, count: data?.count ?? 0 };
}

/* ----------------------------------------
   listReplies
   GET /api/community/posts/:id/replies → chronologisch (oudste boven)
---------------------------------------- */
export async function listReplies(
  postId: string
): Promise<CommunityReply[]> {
  const response = await authedFetch(
    `/api/community/posts/${encodeURIComponent(postId)}/replies`
  );
  const data = await jsonOrThrow<RepliesEnvelope>(response);
  return data?.replies ?? [];
}

/* ----------------------------------------
   createReply
   POST /api/community/posts/:id/replies { body }
   412 zonder nickname.
---------------------------------------- */
export async function createReply(
  postId: string,
  body: string
): Promise<CommunityReply> {
  const response = await authedFetch(
    `/api/community/posts/${encodeURIComponent(postId)}/replies`,
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
   editPost
   PATCH /api/community/posts/:id { body } → { post }
   Server doet eigenaar-check (403 als niet van jou). Geen edit-window.
---------------------------------------- */
export async function editPost(
  postId: string,
  body: string
): Promise<CommunityPost> {
  const response = await authedFetch(
    `/api/community/posts/${encodeURIComponent(postId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    }
  );
  const data = await jsonOrThrow<PostEnvelope>(response);
  if (!data?.post) throw new Error('Bericht kon niet worden bijgewerkt.');
  return data.post;
}

/* ----------------------------------------
   deletePost
   DELETE /api/community/posts/:id → { ok: true }
---------------------------------------- */
export async function deletePost(postId: string): Promise<void> {
  const response = await authedFetch(
    `/api/community/posts/${encodeURIComponent(postId)}`,
    { method: 'DELETE' }
  );
  await jsonOrThrow<{ ok: boolean }>(response);
}

/* ----------------------------------------
   editReply
   PATCH /api/community/replies/:id { body } → { reply }
---------------------------------------- */
export async function editReply(
  replyId: string,
  body: string
): Promise<CommunityReply> {
  const response = await authedFetch(
    `/api/community/replies/${encodeURIComponent(replyId)}`,
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
   DELETE /api/community/replies/:id → { ok: true }
---------------------------------------- */
export async function deleteReply(replyId: string): Promise<void> {
  const response = await authedFetch(
    `/api/community/replies/${encodeURIComponent(replyId)}`,
    { method: 'DELETE' }
  );
  await jsonOrThrow<{ ok: boolean }>(response);
}

/* ----------------------------------------
   getIsAdmin
   GET /api/subscription-status?email= → { is_admin }
   Bepaalt of de admin-only composer getoond wordt. Stille false bij fout.
---------------------------------------- */
export async function getIsAdmin(email: string | null): Promise<boolean> {
  if (!email) return false;
  try {
    const response = await authedFetch(
      `/api/subscription-status?email=${encodeURIComponent(
        email.trim().toLowerCase()
      )}`
    );
    const data = await jsonOrThrow<{ is_admin?: boolean }>(response);
    return !!data?.is_admin;
  } catch {
    return false;
  }
}
