/**
 * HAPJESHELD API CLIENT
 *
 * Praat met de Vercel backend op de productie-URL — dezelfde API die de
 * website gebruikt. Geen aparte backend nodig.
 *
 * Auth: Supabase JWT (Bearer token) — user-identiteit + abonnement-check
 * gebeurt server-side. Rate-limits + foto-limieten ook server-side.
 *
 * Override mogelijk via EXPO_PUBLIC_RAG_API_URL env var (handig voor
 * staging/preview deployments).
 */

import { supabase } from '../lib/supabase';

const DEFAULT_API_URL = 'https://community-web.prilleven.be';

export const RAG_API_URL =
  process.env.EXPO_PUBLIC_RAG_API_URL || DEFAULT_API_URL;

/* ----------------------------------------
   Types
---------------------------------------- */
export interface ChatRequest {
  question: string;
  conversation_id?: string | null;
  image_b64?: string;
  image_mime?: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
}

export interface ChatResponse {
  answer: string;
  sources?: string[];
  cached?: boolean;
  topScore?: number;
  model?: string;
  modelReason?: string;
  conversation_id: string;
  assistant_message_id?: string;
}

export interface ChatError {
  error: string;
  reason?: string;
  status: number;
}

/* Conversatie-lijst items (sidebar / history view) */
export interface ConversationSummary {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

/* Individueel bericht zoals opgeslagen in de DB */
export interface StoredMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  had_image?: boolean;
  model?: string | null;
  retrieved_ids?: string[] | null;
}

export interface ConversationDetail {
  conversation: ConversationSummary;
  messages: StoredMessage[];
}

/* ----------------------------------------
   Auth helper — haal huidige JWT op
---------------------------------------- */
async function getAuthToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error('Sessie kon niet worden opgehaald.');
  const token = data.session?.access_token;
  if (!token) {
    throw new Error('Niet ingelogd — log opnieuw in om HapjesHeld te gebruiken.');
  }
  return token;
}

/* ----------------------------------------
   Generieke authed fetch helper
---------------------------------------- */
async function authedFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const token = await getAuthToken();
  const headers = {
    ...(init.headers || {}),
    Authorization: `Bearer ${token}`,
  };
  return fetch(`${RAG_API_URL}${path}`, { ...init, headers });
}

async function parseOrThrow<T>(response: Response): Promise<T> {
  const raw = await response.text();
  let data: unknown = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    /* non-JSON response */
  }
  if (!response.ok) {
    const err = (data as Partial<ChatError>) || {};
    const message =
      err.error ||
      `Server gaf status ${response.status} terug. Probeer het later opnieuw.`;
    const error = new Error(message) as Error & ChatError;
    error.status = response.status;
    error.error = message;
    if (err.reason) error.reason = err.reason;
    throw error;
  }
  return data as T;
}

/* ----------------------------------------
   listConversations
   GET /api/conversations → { conversations: [...] }
---------------------------------------- */
export async function listConversations(): Promise<ConversationSummary[]> {
  const response = await authedFetch('/api/conversations');
  const data = await parseOrThrow<{ conversations: ConversationSummary[] }>(
    response
  );
  return data?.conversations ?? [];
}

/* ----------------------------------------
   getConversation
   GET /api/conversations/[id] → { conversation, messages }
---------------------------------------- */
export async function getConversation(
  id: string
): Promise<ConversationDetail> {
  const response = await authedFetch(
    `/api/conversations/${encodeURIComponent(id)}`
  );
  return parseOrThrow<ConversationDetail>(response);
}

/* ----------------------------------------
   deleteConversation
   DELETE /api/conversations/[id]
---------------------------------------- */
export async function deleteConversation(id: string): Promise<void> {
  const response = await authedFetch(
    `/api/conversations/${encodeURIComponent(id)}`,
    { method: 'DELETE' }
  );
  if (!response.ok) {
    await parseOrThrow(response); // zal throwen met message
  }
}

/* ----------------------------------------
   sendChatMessage
   POST /api/chat
---------------------------------------- */
export async function sendChatMessage(
  req: ChatRequest
): Promise<ChatResponse> {
  const token = await getAuthToken();

  const response = await fetch(`${RAG_API_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(req),
  });

  const raw = await response.text();
  let data: unknown = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    // niet-JSON response
  }

  if (!response.ok) {
    const err = (data as Partial<ChatError>) || {};
    const message =
      err.error ||
      `Server gaf status ${response.status} terug. Probeer het later opnieuw.`;
    const error = new Error(message) as Error & ChatError;
    error.status = response.status;
    error.error = message;
    if (err.reason) error.reason = err.reason;
    throw error;
  }

  return data as ChatResponse;
}
