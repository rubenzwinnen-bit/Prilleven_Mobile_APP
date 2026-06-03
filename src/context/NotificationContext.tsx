/**
 * NOTIFICATION CONTEXT — admin-post badges op de footer-tabs
 *
 * Houdt twee tellers bij die als rode badge (cijfer in rode rondje)
 * op de footer-tabs verschijnen:
 *
 *   timelineCount   → nieuwe admin-posts in de tijdlijn (community-feed)
 *   chatroomsCount  → nieuwe admin-activiteit over alle chatruimtes, opgeteld
 *
 * De chatruimtes-teller is opgebouwd uit drie niveaus die uit één telling
 * komen (countNewAdminChatroomActivity → { total, perRoom, perTopic }):
 *   - chatroomsCount        footer-badge (som over alles)
 *   - chatroomRoomCounts    per chatruimte (roomlijst)
 *   - chatroomTopicCounts   per topic (topiclijst binnen een room)
 *
 * "Nieuw" = sinds het markeerpunt. Voor de tijdlijn is dat één globaal
 * markeerpunt; voor chatruimtes geldt per topic het LAATSTE van het globale
 * chatruimtes-markeerpunt en het per-topic "gezien"-tijdstip. Die tijdstippen
 * bewaren we per gebruiker in AsyncStorage (suffix met e-mail, conform
 * projectconventie) zodat het wisselen van account geen lekkage geeft.
 *
 * Vervaltermijn: items ouder dan BADGE_MAX_AGE_MS (6 weken) tellen nooit als
 * nieuw, ook niet als de gebruiker de tab/het topic nooit opende — zo lopen de
 * badges niet eindeloop op. Die ondergrens zit in services/notifications.ts.
 *
 * Er is GEEN push: we pollen elke POLL_INTERVAL_MS én bij elke keer dat
 * de app weer naar de voorgrond komt (AppState 'active').
 *
 * Bij de allereerste run voor een gebruiker (nog geen markeerpunt) zetten
 * we het markeerpunt op "nu" zodat bestaande posts niet allemaal als
 * ongelezen tellen.
 *
 * Wissen van de badges:
 *   - markTimelineSeen()  bij focus op de Tijdlijn-tab (de feed is dan zichtbaar).
 *   - markTopicSeen(id)   wanneer de gebruiker een specifiek TOPIC opent
 *     (ChatTopicScreen). Zo wist enkel die topic-badge en krimpen de room-/
 *     footer-tellers navenant — het openen van een room wist niet meer alles,
 *     zodat de onderverdeling per topic zichtbaar blijft.
 *
 * refresh() forceert een nieuwe telling; de chatruimte-schermen roepen het
 * bij focus aan zodat de tellers meteen kloppen i.p.v. tot de volgende poll.
 *
 * Admin-modus: voor admins tellen ALLE nieuwe posts/topics mee (niet enkel
 * admin-aankondigingen) zodat zij alle community-activiteit zien. We bepalen
 * de admin-status één keer per gebruiker via getIsAdmin().
 */

import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUser } from './UserContext';
import {
  countNewAdminTimelinePosts,
  countNewAdminChatroomActivity,
  getIsAdmin,
} from '../services';

const POLL_INTERVAL_MS = 60_000;

const SEEN_TIMELINE_PREFIX = 'notif_seen_timeline_';
const SEEN_CHATROOMS_PREFIX = 'notif_seen_chatrooms_';
const TOPIC_READS_PREFIX = 'notif_topic_reads_';

interface NotificationContextValue {
  /** Aantal nieuwe admin-posts in de tijdlijn sinds laatst gezien. */
  timelineCount: number;
  /** Som van nieuwe admin-activiteit over alle chatruimtes sinds laatst gezien. */
  chatroomsCount: number;
  /** Nieuwe admin-activiteit per chatruimte (keyed op room.id) voor de
   *  badges in de roomlijst (locatie 3). */
  chatroomRoomCounts: Record<string, number>;
  /** Nieuwe admin-activiteit per topic (keyed op topic.id) voor de badges
   *  in de topiclijst van een room (locatie 4). */
  chatroomTopicCounts: Record<string, number>;
  /** Markeer de tijdlijn als gezien (badge → 0). */
  markTimelineSeen: () => void;
  /** Markeer één topic als gezien (topic-badge → 0; room-/footer-badge
   *  krimpt navenant). */
  markTopicSeen: (topicId: string) => void;
  /** Forceer een nieuwe telling (bv. bij focus op een chatruimte-scherm). */
  refresh: () => void;
}

const NotificationContext = createContext<NotificationContextValue>({
  timelineCount: 0,
  chatroomsCount: 0,
  chatroomRoomCounts: {},
  chatroomTopicCounts: {},
  markTimelineSeen: () => {},
  markTopicSeen: () => {},
  refresh: () => {},
});

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useUser();

  const [timelineCount, setTimelineCount] = useState(0);
  const [chatroomsCount, setChatroomsCount] = useState(0);
  const [chatroomRoomCounts, setChatroomRoomCounts] = useState<
    Record<string, number>
  >({});
  const [chatroomTopicCounts, setChatroomTopicCounts] = useState<
    Record<string, number>
  >({});

  /* Markeerpunten in refs zodat de poll-loop geen stale closure heeft. */
  const seenTimelineRef = useRef<string | null>(null);
  const seenChatroomsRef = useRef<string | null>(null);

  /* Per-topic markeerpunten (topic.id → ISO "gezien"-tijdstip). */
  const topicReadsRef = useRef<Record<string, string>>({});

  /* Admin-status (true = alle posts tellen, niet enkel admin-posts). */
  const isAdminRef = useRef<boolean>(false);

  const timelineKey = user ? `${SEEN_TIMELINE_PREFIX}${user}` : null;
  const chatroomsKey = user ? `${SEEN_CHATROOMS_PREFIX}${user}` : null;
  const topicReadsKey = user ? `${TOPIC_READS_PREFIX}${user}` : null;

  /* Tel opnieuw op basis van de huidige markeerpunten. */
  const refresh = useCallback(async () => {
    if (!user) return;
    const [tl, chatroom] = await Promise.all([
      countNewAdminTimelinePosts(seenTimelineRef.current, isAdminRef.current),
      countNewAdminChatroomActivity(
        seenChatroomsRef.current,
        isAdminRef.current,
        topicReadsRef.current
      ),
    ]);
    setTimelineCount(tl);
    setChatroomsCount(chatroom.total);
    setChatroomRoomCounts(chatroom.perRoom);
    setChatroomTopicCounts(chatroom.perTopic);
  }, [user]);

  /* Bij login/wissel van gebruiker: markeerpunten laden (of initialiseren
     op "nu" bij eerste run) en daarna een eerste telling doen. */
  useEffect(() => {
    let cancelled = false;

    if (!user || !timelineKey || !chatroomsKey) {
      seenTimelineRef.current = null;
      seenChatroomsRef.current = null;
      topicReadsRef.current = {};
      isAdminRef.current = false;
      setTimelineCount(0);
      setChatroomsCount(0);
      setChatroomRoomCounts({});
      setChatroomTopicCounts({});
      return;
    }

    (async () => {
      /* Admin-status bepalen vóór de eerste telling. */
      try {
        isAdminRef.current = await getIsAdmin(user);
      } catch {
        isAdminRef.current = false;
      }
      if (cancelled) return;

      const nowIso = new Date().toISOString();
      try {
        let tl = await AsyncStorage.getItem(timelineKey);
        let cr = await AsyncStorage.getItem(chatroomsKey);
        if (tl === null) {
          tl = nowIso;
          await AsyncStorage.setItem(timelineKey, nowIso);
        }
        if (cr === null) {
          cr = nowIso;
          await AsyncStorage.setItem(chatroomsKey, nowIso);
        }
        if (cancelled) return;
        seenTimelineRef.current = tl;
        seenChatroomsRef.current = cr;
      } catch {
        seenTimelineRef.current = nowIso;
        seenChatroomsRef.current = nowIso;
      }

      /* Per-topic markeerpunten laden (defensief; ontbreekt → lege map). */
      try {
        const raw = topicReadsKey
          ? await AsyncStorage.getItem(topicReadsKey)
          : null;
        topicReadsRef.current = raw ? JSON.parse(raw) : {};
      } catch {
        topicReadsRef.current = {};
      }

      if (!cancelled) await refresh();
    })();

    return () => {
      cancelled = true;
    };
  }, [user, timelineKey, chatroomsKey, topicReadsKey, refresh]);

  /* Polling + refresh bij terugkeer naar de voorgrond. */
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      refresh();
    }, POLL_INTERVAL_MS);

    const onAppStateChange = (state: AppStateStatus) => {
      if (state === 'active') refresh();
    };
    const sub = AppState.addEventListener('change', onAppStateChange);

    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [user, refresh]);

  const markTimelineSeen = useCallback(() => {
    const nowIso = new Date().toISOString();
    seenTimelineRef.current = nowIso;
    setTimelineCount(0);
    if (timelineKey) AsyncStorage.setItem(timelineKey, nowIso).catch(() => {});
  }, [timelineKey]);

  const markTopicSeen = useCallback(
    (topicId: string) => {
      const nowIso = new Date().toISOString();
      topicReadsRef.current = { ...topicReadsRef.current, [topicId]: nowIso };
      /* Optimistisch: deze topic-badge meteen op 0; room-/footer-tellers
         worden door de daaropvolgende refresh() opnieuw berekend. */
      setChatroomTopicCounts((prev) => ({ ...prev, [topicId]: 0 }));
      if (topicReadsKey)
        AsyncStorage.setItem(
          topicReadsKey,
          JSON.stringify(topicReadsRef.current)
        ).catch(() => {});
      refresh();
    },
    [topicReadsKey, refresh]
  );

  return (
    <NotificationContext.Provider
      value={{
        timelineCount,
        chatroomsCount,
        chatroomRoomCounts,
        chatroomTopicCounts,
        markTimelineSeen,
        markTopicSeen,
        refresh,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
