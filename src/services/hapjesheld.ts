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

import { fetch as expoFetch } from 'expo/fetch';
import { supabase } from '../lib/supabase';

const DEFAULT_API_URL = 'https://community-web.prilleven.be';

export const RAG_API_URL =
  process.env.EXPO_PUBLIC_RAG_API_URL || DEFAULT_API_URL;

/* Receptlinks in antwoorden van HapjesHeld wijzen naar het recept in het weekschema
   op de website. Spiegel van RECIPE_URL_PREFIX in api/chat.mjs — staat daar vast op
   dit domein, ook als RAG_API_URL overschreven is. */
const RECIPE_URL_PREFIX = 'https://community-web.prilleven.be/#/recipe/';

/** Recept-id uit een receptlink van HapjesHeld, of null voor elke andere link. */
export function recipeIdFromUrl(url: string): string | null {
  if (!url.startsWith(RECIPE_URL_PREFIX)) return null;
  const id = decodeURIComponent(url.slice(RECIPE_URL_PREFIX.length));
  return id || null;
}

/* ----------------------------------------
   Types
---------------------------------------- */
export interface ChatRequest {
  question: string;
  conversation_id?: string | null;
  image_b64?: string;
  image_mime?: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
}

/** Maandelijks AI-budgetverbruik (€-cap), voor de barometer-UI. */
export interface MonthlyUsage {
  spentCents: number;
  capCents: number;
  percent: number;
}

/** Dagelijks foto-vragen verbruik, voor de teller naast de camera-knop. */
export interface DailyImageUsage {
  used: number;
  limit: number;
  remaining: number;
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
  /** Maandbarometer-update na deze chat-call. */
  usage?: MonthlyUsage;
  /** Dagelijkse image-teller, ook bij text-only chats meegestuurd. */
  imageUsage?: DailyImageUsage;
}

export interface ChatError {
  error: string;
  reason?: string;
  status: number;
}

/** Antwoord van GET /api/profile — gebruikt door de chat-UI bij mount. */
export interface ProfileResponse {
  profile: unknown;
  usage?: MonthlyUsage;
  imageUsage?: DailyImageUsage;
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
   getProfile
   GET /api/profile → { profile, usage, imageUsage }

   Gebruikt door de chat-UI bij mount om de maandbarometer en
   image-counter direct te kunnen tonen, vóór de eerste chat.
---------------------------------------- */
export async function getProfile(): Promise<ProfileResponse> {
  const response = await authedFetch('/api/profile');
  return parseOrThrow<ProfileResponse>(response);
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
   renameConversation
   PATCH /api/conversations/[id] { title } → { id, title }
   De server kapt af op 80 tekens en weigert een lege titel. Een eigen titel
   blijft staan: de server zet enkel een automatische titel als er nog geen is.
---------------------------------------- */
export const CONVERSATION_TITLE_MAX = 80;

export async function renameConversation(
  id: string,
  title: string
): Promise<string> {
  const response = await authedFetch(
    `/api/conversations/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    }
  );
  const data = await parseOrThrow<{ id: string; title: string }>(response);
  return data.title;
}

/* ----------------------------------------
   sendChatMessage
   POST /api/chat met stream: true

   De server stuurt het antwoord als text/event-stream: `delta` { text } per
   stukje, dan `done` met dezelfde velden als het JSON-antwoord, of `error`.
   Cache-hits, de fallback en fouten vóór het antwoord (bv. 429) blijven gewone
   JSON — daarom kijken we naar de Content-Type. `onText` krijgt telkens de tot
   dan toe geschreven tekst. Het definitieve antwoord is `answer` uit `done`: de
   server haalt daar ongeldige receptlinks nog uit.

   expo/fetch i.p.v. de gewone fetch, want die van React Native kan een
   response-body niet stukje per stukje lezen.
---------------------------------------- */
export async function sendChatMessage(
  req: ChatRequest,
  onText?: (text: string) => void
): Promise<ChatResponse> {
  const token = await getAuthToken();

  const response = await expoFetch(`${RAG_API_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ ...req, stream: true }),
  });

  const contentType = response.headers.get('content-type') || '';
  if (response.ok && contentType.includes('text/event-stream') && response.body) {
    return readChatStream(response.body, onText);
  }

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

/* Leest events uit een text/event-stream: elke aanroep geeft het volgende
   { event, payload }, of null als de stream gesloten is. Spiegel van sseReader
   in js/chat.js op de website. */
type ChatEvent = {
  event: string;
  payload: { text?: string; error?: string };
};

function sseReader(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  return async function nextEvent(): Promise<ChatEvent | null> {
    while (true) {
      const sep = buffer.indexOf('\n\n');
      if (sep !== -1) {
        const raw = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const event = /^event: (.*)$/m.exec(raw)?.[1];
        const dataLine = /^data: (.*)$/m.exec(raw)?.[1];
        if (event && dataLine) return { event, payload: JSON.parse(dataLine) };
        continue;
      }
      const { value, done } = await reader.read();
      if (done) return null;
      buffer += decoder.decode(value, { stream: true });
    }
  };
}

async function readChatStream(
  body: ReadableStream<Uint8Array>,
  onText?: (text: string) => void
): Promise<ChatResponse> {
  const nextEvent = sseReader(body);
  let text = '';
  let failure = 'Het antwoord werd onderbroken. Probeer het opnieuw.';

  let ev: ChatEvent | null;
  while ((ev = await nextEvent())) {
    const { event, payload } = ev;
    if (event === 'delta') {
      text += payload.text ?? '';
      onText?.(text);
    } else if (event === 'done') {
      return payload as unknown as ChatResponse;
    } else if (event === 'error') {
      failure = payload.error || failure;
      break;
    }
  }

  const error = new Error(failure) as Error & ChatError;
  error.status = 500;
  error.error = failure;
  throw error;
}

/* ----------------------------------------
   Feedback per antwoord — /api/chat-feedback
   👍 = 1, 👎 = -1, 0 = ongedaan maken. Een reden kan enkel bij 👎 (max 500,
   de server kapt af). Vervangt "Dit helpt mij" van de website.
---------------------------------------- */
export type FeedbackRating = 1 | -1 | 0;

export interface ChatFeedback {
  rating: 1 | -1;
  reden: string | null;
}

/** Feedback per message_id voor één gesprek. Stil leeg bij een fout. */
export async function getChatFeedback(
  conversationId: string
): Promise<Record<string, ChatFeedback>> {
  try {
    const response = await authedFetch(
      `/api/chat-feedback?conversation_id=${encodeURIComponent(conversationId)}`
    );
    const data = await parseOrThrow<{ feedback: Record<string, ChatFeedback> }>(response);
    return data.feedback || {};
  } catch {
    return {};
  }
}

export async function sendChatFeedback(
  messageId: string,
  rating: FeedbackRating,
  reden: string | null = null
): Promise<void> {
  const response =
    rating === 0
      ? await authedFetch(
          `/api/chat-feedback?message_id=${encodeURIComponent(messageId)}`,
          { method: 'DELETE' }
        )
      : await authedFetch('/api/chat-feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message_id: messageId, rating, reden }),
        });
  if (!response.ok) throw new Error('Feedback opslaan mislukt.');
}
