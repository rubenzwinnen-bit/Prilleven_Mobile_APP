/**
 * NOTIFICATION CONTEXT — admin-post badges op de footer-tabs
 *
 * Houdt twee tellers bij die als rode badge (cijfer in rode rondje)
 * op de footer-tabs verschijnen:
 *
 *   timelineCount   → nieuwe admin-posts in de tijdlijn (community-feed)
 *   chatroomsCount  → nieuwe admin-topics over alle chatruimtes, opgeteld
 *
 * "Nieuw" = sinds het tijdstip waarop de gebruiker de betreffende tab
 * voor het laatst opende. Dat tijdstip bewaren we per gebruiker in
 * AsyncStorage (suffix met e-mail, conform projectconventie) zodat het
 * wisselen van account geen lekkage geeft.
 *
 * Er is GEEN push: we pollen elke POLL_INTERVAL_MS én bij elke keer dat
 * de app weer naar de voorgrond komt (AppState 'active').
 *
 * Bij de allereerste run voor een gebruiker (nog geen markeerpunt) zetten
 * we het markeerpunt op "nu" zodat bestaande posts niet allemaal als
 * ongelezen tellen.
 *
 * markTimelineSeen() / markChatroomsSeen() worden aangeroepen wanneer de
 * Tijdlijn- resp. Chatruimtes-tab focus krijgt (zie LandingTabs).
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
  countNewAdminChatroomPosts,
  getIsAdmin,
} from '../services';

const POLL_INTERVAL_MS = 60_000;

const SEEN_TIMELINE_PREFIX = 'notif_seen_timeline_';
const SEEN_CHATROOMS_PREFIX = 'notif_seen_chatrooms_';

interface NotificationContextValue {
  /** Aantal nieuwe admin-posts in de tijdlijn sinds laatst gezien. */
  timelineCount: number;
  /** Som van nieuwe admin-topics over alle chatruimtes sinds laatst gezien. */
  chatroomsCount: number;
  /** Markeer de tijdlijn als gezien (badge → 0). */
  markTimelineSeen: () => void;
  /** Markeer de chatruimtes als gezien (badge → 0). */
  markChatroomsSeen: () => void;
}

const NotificationContext = createContext<NotificationContextValue>({
  timelineCount: 0,
  chatroomsCount: 0,
  markTimelineSeen: () => {},
  markChatroomsSeen: () => {},
});

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useUser();

  const [timelineCount, setTimelineCount] = useState(0);
  const [chatroomsCount, setChatroomsCount] = useState(0);

  /* Markeerpunten in refs zodat de poll-loop geen stale closure heeft. */
  const seenTimelineRef = useRef<string | null>(null);
  const seenChatroomsRef = useRef<string | null>(null);

  /* Admin-status (true = alle posts tellen, niet enkel admin-posts). */
  const isAdminRef = useRef<boolean>(false);

  const timelineKey = user ? `${SEEN_TIMELINE_PREFIX}${user}` : null;
  const chatroomsKey = user ? `${SEEN_CHATROOMS_PREFIX}${user}` : null;

  /* Tel opnieuw op basis van de huidige markeerpunten. */
  const refresh = useCallback(async () => {
    if (!user) return;
    const [tl, cr] = await Promise.all([
      countNewAdminTimelinePosts(seenTimelineRef.current, isAdminRef.current),
      countNewAdminChatroomPosts(seenChatroomsRef.current, isAdminRef.current),
    ]);
    setTimelineCount(tl);
    setChatroomsCount(cr);
  }, [user]);

  /* Bij login/wissel van gebruiker: markeerpunten laden (of initialiseren
     op "nu" bij eerste run) en daarna een eerste telling doen. */
  useEffect(() => {
    let cancelled = false;

    if (!user || !timelineKey || !chatroomsKey) {
      seenTimelineRef.current = null;
      seenChatroomsRef.current = null;
      isAdminRef.current = false;
      setTimelineCount(0);
      setChatroomsCount(0);
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
      if (!cancelled) await refresh();
    })();

    return () => {
      cancelled = true;
    };
  }, [user, timelineKey, chatroomsKey, refresh]);

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

  const markChatroomsSeen = useCallback(() => {
    const nowIso = new Date().toISOString();
    seenChatroomsRef.current = nowIso;
    setChatroomsCount(0);
    if (chatroomsKey)
      AsyncStorage.setItem(chatroomsKey, nowIso).catch(() => {});
  }, [chatroomsKey]);

  return (
    <NotificationContext.Provider
      value={{
        timelineCount,
        chatroomsCount,
        markTimelineSeen,
        markChatroomsSeen,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
