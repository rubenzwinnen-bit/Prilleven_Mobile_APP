/**
 * NOTIFICATIONS SERVICE — admin-post tellers
 *
 * Berekent het aantal NIEUWE admin-posts sinds een "laatst gezien"-tijdstip,
 * gescheiden in twee tellers (mirror van de twee footer-tab-badges):
 *
 *   Tijdlijn    → admin-posts in de community-feed (source_type 'community')
 *   Chatruimtes → admin-topics per chatruimte, opgeteld over alle rooms
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
import { listRooms, getRoom } from './chatRooms';

/* Hoeveel posts/topics we per area ophalen om te tellen. Ruim genoeg:
   admins plaatsen niet bij bosjes en de feed is cursor-gesorteerd op
   created_at (nieuwste eerst). */
const SCAN_LIMIT = 50;

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
   Aantal nieuwe admin-posts in de tijdlijn (community-feed) sinds `since`.
---------------------------------------- */
export async function countNewAdminTimelinePosts(
  since: string | null,
  includeAllAuthors = false
): Promise<number> {
  try {
    const posts = await listPosts({ limit: SCAN_LIMIT });
    return posts.filter(
      (p) =>
        (includeAllAuthors || p.author_is_admin) &&
        p.source_type === 'community' &&
        isNewerThan(p.created_at, since)
    ).length;
  } catch {
    return 0;
  }
}

/* ----------------------------------------
   countNewAdminChatroomPosts
   Per chatruimte de nieuwe admin-topics tellen en optellen over alle rooms.
---------------------------------------- */
export async function countNewAdminChatroomPosts(
  since: string | null,
  includeAllAuthors = false
): Promise<number> {
  try {
    const rooms = await listRooms();
    const perRoom = await Promise.all(
      rooms.map(async (room) => {
        try {
          const { topics } = await getRoom(room.slug);
          return topics.filter(
            (t) =>
              (includeAllAuthors || t.author_is_admin) &&
              isNewerThan(t.created_at, since)
          ).length;
        } catch {
          return 0;
        }
      })
    );
    return perRoom.reduce((sum, n) => sum + n, 0);
  } catch {
    return 0;
  }
}
