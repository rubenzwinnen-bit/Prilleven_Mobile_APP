/**
 * NOTIFICATIONS SERVICE — admin-post tellers
 *
 * Berekent het aantal NIEUWE admin-posts sinds een "laatst gezien"-tijdstip,
 * gescheiden in twee tellers (mirror van de twee footer-tab-badges):
 *
 *   Tijdlijn    → admin-posts in de community-feed (source_type 'community')
 *   Chatruimtes → admin-activiteit (topics + replies) per chatruimte EN
 *                 per topic, opgeteld over alle rooms
 *
 * Er is GEEN push-mechanisme; de NotificationContext pollt deze functies.
 * Beide functies zijn defensief: bij een fout geven ze 0 terug zodat de
 * polling-loop nooit crasht.
 *
 * "Admin-post" = een post/topic met `author_is_admin === true`.
 * "Nieuw" = `created_at` strikt na het meegegeven `since`-tijdstip.
 *
 * `includeAllAuthors` (admin-modus): wanneer true tellen ALLE nieuwe posts/
 * topics mee, niet enkel die van admins. Gewone gebruikers zien dus enkel
 * admin-aankondigingen; admins zien alle nieuwe community-activiteit.
 */

import { listPosts } from './community';
import { listRooms, getRoom, getTopic } from './chatRooms';

/* Hoeveel posts/topics we per area ophalen om te tellen. Ruim genoeg:
   admins plaatsen niet bij bosjes en de feed is cursor-gesorteerd op
   created_at (nieuwste eerst). */
const SCAN_LIMIT = 50;

/* Vervaltermijn op de badges: items ouder dan deze termijn tellen nooit als
   "nieuw", ook niet wanneer de gebruiker de tab/het topic nooit opende. Zo
   lopen de badges niet eindeloos op. 6 weken. */
const BADGE_MAX_AGE_MS = 6 * 7 * 24 * 60 * 60 * 1000;

/** Past de vervaltermijn toe: geeft het LAATSTE van `since` en "nu − 6 weken"
 *  terug. Hierdoor zakt het referentiepunt nooit verder terug dan 6 weken,
 *  dus oudere ongelezen items vervallen vanzelf. */
function withExpiry(since: string | null): string {
  const cutoff = new Date(Date.now() - BADGE_MAX_AGE_MS).toISOString();
  if (!since) return cutoff;
  return new Date(since).getTime() > new Date(cutoff).getTime()
    ? since
    : cutoff;
}

/** True als `createdAt` strikt na `since` ligt. Bij geen `since`: false
 *  (eerste run telt niets — alle bestaande posts gelden als "gezien"). */
function isNewerThan(createdAt: string, since: string | null): boolean {
  if (!since) return false;
  const created = new Date(createdAt).getTime();
  const ref = new Date(since).getTime();
  if (Number.isNaN(created) || Number.isNaN(ref)) return false;
  return created > ref;
}

/* ----------------------------------------
   countNewAdminTimelinePosts
   Aantal nieuwe items in de tijdlijn sinds `since`, opgeteld:
     - admin-posts in de community-feed (source_type 'community')
     - ALLE nieuwe gevolgde chatruimte-topics (source_type 'chatroom') —
       deze staan al in de feed omdat de gebruiker de room/het topic volgt,
       dus tellen ze altijd mee, ongeacht auteur.
---------------------------------------- */
export async function countNewAdminTimelinePosts(
  since: string | null,
  includeAllAuthors = false
): Promise<number> {
  try {
    const ref = withExpiry(since);
    const posts = await listPosts({ limit: SCAN_LIMIT });
    return posts.filter((p) => {
      if (!isNewerThan(p.created_at, ref)) return false;
      if (p.source_type === 'chatroom') return true;
      return includeAllAuthors || p.author_is_admin;
    }).length;
  } catch {
    return 0;
  }
}

/* ----------------------------------------
   countNewAdminChatroomActivity
   Per chatruimte de nieuwe (admin-)activiteit tellen: zowel nieuwe TOPICS
   als nieuwe REPLIES binnen bestaande topics. Replies tellen we enkel in
   topics waarvan `last_reply_at` na het effectieve "since"-tijdstip ligt
   (zo blijft het aantal getTopic-calls beperkt tot recent-actieve topics).

   Geeft drie aggregaties terug:
     - total      → som over alles (footer-badge)
     - perRoom    → keyed op room.id (badges in de roomlijst — locatie 3)
     - perTopic   → keyed op topic.id (badges in ChatRoomScreen — locatie 4)

   Per-topic markeerpunten (`topicReads`): wanneer de gebruiker een topic
   opent, slaan we per topic een "gezien"-tijdstip op. Het effectieve
   referentiepunt voor een topic is het LAATSTE van het globale `since`
   (chatruimtes-baseline) en het per-topic markeerpunt. Zo verdwijnt een
   topic-badge zodra je dát topic opent, en krimpt de room-/footer-badge
   navenant, terwijl ongelezen topics zichtbaar blijven.
---------------------------------------- */
export interface ChatroomActivity {
  total: number;
  perRoom: Record<string, number>;
  perTopic: Record<string, number>;
}

/** Effectief referentiepunt voor één topic: het laatste van de globale
 *  baseline `since` en het per-topic markeerpunt (indien recenter). */
function effectiveSince(
  topicId: string,
  since: string | null,
  topicReads: Record<string, string>
): string | null {
  const read = topicReads[topicId];
  if (!read) return since;
  if (!since) return read;
  return new Date(read).getTime() > new Date(since).getTime() ? read : since;
}

async function scanChatroomActivity(
  since: string | null,
  includeAllAuthors: boolean,
  topicReads: Record<string, string>
): Promise<ChatroomActivity> {
  const perRoom: Record<string, number> = {};
  const perTopic: Record<string, number> = {};
  /* Vervaltermijn op de baseline; per-topic markeerpunten kunnen het
     referentiepunt enkel nog recenter maken (zie effectiveSince). */
  const baseSince = withExpiry(since);
  try {
    const rooms = await listRooms();
    await Promise.all(
      rooms.map(async (room) => {
        try {
          const { topics } = await getRoom(room.slug);
          /* Per topic: bepaal eigen referentiepunt en of replies gescand
             moeten worden. We tellen het nieuwe topic zelf + nieuwe replies. */
          const topicScans = topics.map((t) => {
            const effSince = effectiveSince(t.id, baseSince, topicReads);
            const isNewTopic =
              (includeAllAuthors || t.author_is_admin) &&
              isNewerThan(t.created_at, effSince);
            const scanReplies =
              !!t.last_reply_at && isNewerThan(t.last_reply_at, effSince);
            return { id: t.id, effSince, isNewTopic, scanReplies };
          });

          await Promise.all(
            topicScans.map(async (s) => {
              let count = s.isNewTopic ? 1 : 0;
              if (s.scanReplies) {
                try {
                  const { replies } = await getTopic(s.id);
                  count += replies.filter(
                    (r) =>
                      (includeAllAuthors || r.author_is_admin) &&
                      isNewerThan(r.created_at, s.effSince)
                  ).length;
                } catch {
                  /* topic-fout telt als 0 extra replies */
                }
              }
              perTopic[s.id] = count;
            })
          );

          perRoom[room.id] = topicScans.reduce(
            (sum, s) => sum + (perTopic[s.id] ?? 0),
            0
          );
        } catch {
          perRoom[room.id] = 0;
        }
      })
    );
  } catch {
    return { total: 0, perRoom: {}, perTopic: {} };
  }
  const total = Object.values(perRoom).reduce((sum, n) => sum + n, 0);
  return { total, perRoom, perTopic };
}

export async function countNewAdminChatroomActivity(
  since: string | null,
  includeAllAuthors = false,
  topicReads: Record<string, string> = {}
): Promise<ChatroomActivity> {
  return scanChatroomActivity(since, includeAllAuthors, topicReads);
}
