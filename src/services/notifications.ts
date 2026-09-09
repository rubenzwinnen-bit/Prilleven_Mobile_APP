/**
 * NOTIFICATIONS SERVICE — badge-tellers
 *
 * Beide tellers komen SERVER-SIDE uit één verzoek:
 * `GET /api/community/app-badges?since=<iso>` → `{ timeline, chatrooms }`.
 *
 *   Tijdlijn    → nieuwe posts ÉN replies in de community-feed + nieuwe
 *                 gevolgde chatruimte-topics.
 *   Chatruimtes → nieuwe topics + replies over alle ruimtes, uitgesplitst
 *                 per ruimte (`perRoom`, keyed op room_id) en per topic
 *                 (`perTopic`, keyed op topic_id).
 *
 * De server bepaalt zelf of de gebruiker admin is (admin telt alle nieuwe
 * activiteit, een gewone gebruiker enkel admin-geschreven items), past de
 * 6-weken-vervaltermijn toe en laat geblokkeerde auteurs weg.
 *
 * De per-topic markeerpunten leest de server ZELF uit `user_badge_state`,
 * dezelfde bron als de push-badge. De app spiegelt die via `syncBadgeState`
 * bij elke `markTimelineSeen` / `markTopicSeen`. Ze worden hier dus niet
 * meegestuurd.
 *
 * Tot v3.2.0 telde de app de chatruimtes zelf: per ronde `listRooms()` plus
 * een `getRoom()` per ruimte plus een `getTopic()` per recent actief topic —
 * vijf tot twintig verzoeken per telling, elke minuut. Dat is vervangen door
 * dit ene verzoek.
 *
 * Defensief: bij een fout nullen, zodat de poll-lus nooit crasht.
 */

import { getAppBadges } from './community';

export interface ChatroomActivity {
  total: number;
  /** Keyed op room.id — badges in de roomlijst. */
  perRoom: Record<string, number>;
  /** Keyed op topic.id — badges per topic-kaart in een room. */
  perTopic: Record<string, number>;
}

export interface AppBadgeCounts {
  timeline: number;
  chatrooms: ChatroomActivity;
}

const LEEG: AppBadgeCounts = {
  timeline: 0,
  chatrooms: { total: 0, perRoom: {}, perTopic: {} },
};

/**
 * Haalt beide tellers op in één verzoek.
 * `since` is de tijdlijn-baseline; zonder baseline telt de server 0.
 */
export async function fetchAppBadgeCounts(
  since: string | null
): Promise<AppBadgeCounts> {
  try {
    const { timeline, chatrooms } = await getAppBadges(since);
    return { timeline, chatrooms };
  } catch {
    return LEEG;
  }
}
