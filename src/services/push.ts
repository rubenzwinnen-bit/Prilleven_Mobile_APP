/**
 * PUSH SERVICE — Expo push-notificaties + app-icoon-badge
 *
 * Verantwoordelijk voor:
 *   1. Toestemming vragen + de Expo-push-token ophalen (na login).
 *   2. Die token registreren bij de backend (gekoppeld aan de user_id)
 *      zodat de server pushes kan sturen wanneer de app dicht is.
 *   3. De token deregistreren bij uitloggen.
 *   4. Het rode cijfer op het app-icoon zetten/wissen
 *      (`setAppBadge` / `clearAppBadge`).
 *
 * De badge op het app-icoon is een ABSOLUUT getal: de server bepaalt het
 * bij een push (APNs/FCM zetten het direct). Zolang de app open is
 * spiegelt `NotificationContext` het totaal (tijdlijn + chatruimtes) ook
 * lokaal via `setAppBadge`.
 *
 * Endpoints (Vercel-API, community-web.prilleven.be — zie website
 * api/push.mjs):
 *   POST   /api/community/push/register   { token, platform }  → token opslaan
 *   DELETE /api/community/push/register   { token }             → token wissen
 *
 * Auth: Supabase JWT (Bearer-token), identiek aan de andere services.
 *
 * NB: remote push werkt NIET in Expo Go (iOS) — enkel in een echte
 * dev-/preview-/production-build. `expo-device` filtert simulators/
 * emulators eruit (die kunnen geen push-token krijgen).
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { supabase } from '../lib/supabase';
import { RAG_API_URL } from './hapjesheld';

/* ----------------------------------------
   Foreground-gedrag — hoe een push getoond wordt terwijl de app OPEN is.
   Wordt geconfigureerd zodra deze service geïmporteerd wordt (via de
   services-barrel → NotificationContext). Zonder handler zou een push die
   binnenkomt terwijl de app in de voorgrond staat niet als banner verschijnen.
---------------------------------------- */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/* ----------------------------------------
   Auth-helpers (kopie van het service-patroon)
---------------------------------------- */
async function getAuthToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error('Sessie kon niet worden opgehaald.');
  const token = data.session?.access_token;
  if (!token) throw new Error('Niet ingelogd.');
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

/* ----------------------------------------
   projectId — nodig om een Expo-push-token te krijgen in EAS-builds
---------------------------------------- */
function getProjectId(): string | null {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    null
  );
}

/* ----------------------------------------
   Android-kanaal — verplicht voor notificaties op Android 8+
---------------------------------------- */
async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Algemeen',
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: '#C98966',
  });
}

/* ----------------------------------------
   registerPushToken
   Vraagt toestemming, haalt de Expo-push-token op en stuurt die naar
   de backend. Geeft de token terug, of null als het niet lukte
   (geen echt toestel, toestemming geweigerd, geen projectId, …).
   Defensief: gooit nooit — push mag de app-flow nooit blokkeren.
---------------------------------------- */
export async function registerPushToken(): Promise<string | null> {
  try {
    if (!Device.isDevice) return null; // simulator/emulator → geen push-token

    await ensureAndroidChannel();

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return null;

    const projectId = getProjectId();
    if (!projectId) return null;

    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    if (!token) return null;

    await authedFetch('/api/community/push/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, platform: Platform.OS }),
    });

    return token;
  } catch {
    return null;
  }
}

/* ----------------------------------------
   deregisterPushToken
   Wist de token server-side (bij uitloggen). Moet VOOR signOut worden
   aangeroepen zodat de JWT nog geldig is. Defensief: gooit nooit.
---------------------------------------- */
export async function deregisterPushToken(): Promise<void> {
  try {
    if (!Device.isDevice) return;
    const projectId = getProjectId();
    if (!projectId) return;
    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    if (!token) return;
    await authedFetch('/api/community/push/register', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
  } catch {
    /* stil falen — uitloggen mag hier niet op stuklopen */
  }
}

/* ----------------------------------------
   Badge-state syncen naar de server
   De server houdt een spiegel bij van de "laatst gezien"-tijdstippen
   (timeline_seen_at, chatrooms_seen_at, topic_reads) zodat hij bij een
   push (app dicht) het absolute app-icoon-getal per ontvanger kan
   berekenen. De app pusht een deel-patch telkens een markeerpunt wijzigt.
   Defensief: gooit nooit — mag de UI-flow nooit blokkeren.
---------------------------------------- */
export interface BadgeStatePatch {
  timeline_seen_at?: string;
  chatrooms_seen_at?: string;
  topic_reads?: Record<string, string>;
}

export async function syncBadgeState(patch: BadgeStatePatch): Promise<void> {
  try {
    await authedFetch('/api/community/badge-state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
  } catch {
    /* niet kritisch — de in-app badge blijft lokaal correct */
  }
}

/* ----------------------------------------
   Badge-helpers — het rode cijfer op het app-icoon
---------------------------------------- */
export async function setAppBadge(count: number): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(Math.max(0, count));
  } catch {
    /* niet kritisch */
  }
}

export async function clearAppBadge(): Promise<void> {
  await setAppBadge(0);
}

/* ----------------------------------------
   TIKKEN OP EEN NOTIFICATIE
   De server stuurt bij elke push een `data`-payload mee die zegt WAAR de
   notificatie over gaat (zie website api/_lib/push.mjs). De app leest die
   hier uit; het navigeren zelf gebeurt in src/navigation/pushRouting.tsx —
   een service hoort niets van de navigatieboom te weten.

   Ontbreekt de payload (oudere server, of een push van vóór deze versie),
   dan geven we een leeg object terug en beslist de router zelf waar hij
   heen gaat. Nooit gooien: een tik mag de app niet doen crashen.
---------------------------------------- */
export type PushKind =
  | 'timeline_post'
  | 'timeline_reply'
  | 'chatroom_topic'
  | 'chatroom_reply';

export interface PushData {
  kind?: PushKind;
  postId?: string;
  topicId?: string;
  roomSlug?: string;
  roomTitle?: string;
}

/** Eén getikte notificatie: de payload + het id om dubbel afhandelen te vermijden. */
export interface PushResponse {
  data: PushData;
  id: string;
}

function readResponse(
  response: Notifications.NotificationResponse | null
): PushResponse | null {
  if (!response) return null;
  const raw = response.notification.request.content.data;
  const data =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as PushData)
      : {};
  return { data, id: response.notification.request.identifier };
}

/** Abonneer op tikken terwijl de app draait (voorgrond of achtergrond).
 *  Geeft een opzeg-functie terug. */
export function addPushResponseListener(
  handler: (response: PushResponse) => void
): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener(event => {
    const parsed = readResponse(event);
    if (parsed) handler(parsed);
  });
  return () => sub.remove();
}

/** De notificatie waarmee de app werd geopend (koude start). Null als de
 *  app op een andere manier startte. */
export async function getInitialPushResponse(): Promise<PushResponse | null> {
  try {
    return readResponse(await Notifications.getLastNotificationResponseAsync());
  } catch {
    return null;
  }
}
