/**
 * PUSH → NAVIGATIE
 *
 * Wat gebeurt er als de gebruiker op een push-notificatie tikt?
 *
 *   timeline_post / timeline_reply   → Landing, tab Tijdlijn
 *   chatroom_topic / chatroom_reply  → Landing, tab Chatruimtes → dat topic
 *   geen of onbekende payload        → Landing, tab Tijdlijn
 *
 * De laatste regel is de vangnet-route: alle pushes gaan vandaag over
 * community-activiteit, dus de tijdlijn is het meest zinvolle vertrekpunt
 * wanneer de server (nog) geen `data` meestuurt.
 *
 * Twee ingangen, want een tik kan op twee momenten binnenkomen:
 *   - app draait (voor- of achtergrond) → addPushResponseListener
 *   - app was dicht en wordt erdoor geopend → getInitialPushResponse
 *
 * `handledIds` voorkomt dat dezelfde notificatie twee keer navigeert:
 * getLastNotificationResponseAsync() blijft na een koude start hetzelfde
 * antwoord teruggeven, ook na een her-render.
 */

import { useEffect, useRef } from 'react';
import {
  createNavigationContainerRef,
  CommonActions,
} from '@react-navigation/native';
import {
  addPushResponseListener,
  getInitialPushResponse,
  type PushData,
  type PushResponse,
} from '../services';
import { useNotifications } from '../context/NotificationContext';
import type { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/** Navigeer naar de plek waar de notificatie over gaat. Stil falen wanneer
 *  de navigatieboom nog niet klaar is (bv. tik tijdens het uitloggen). */
function navigateFromPush(data: PushData) {
  if (!navigationRef.isReady()) return;

  const isChatroom =
    data.kind === 'chatroom_topic' || data.kind === 'chatroom_reply';

  if (isChatroom && data.topicId) {
    navigationRef.dispatch(
      CommonActions.navigate('Landing', {
        screen: 'Chatruimtes',
        params: {
          screen: 'ChatTopic',
          /* initial: false houdt RoomList onder ChatTopic in de stack, zodat
             de terugknop naar het chatruimtes-overzicht gaat in plaats van de
             tab te verlaten. Zelfde reden als in TimelineScreen. */
          initial: false,
          params: { topicId: data.topicId, roomTitle: data.roomTitle },
        },
      })
    );
    return;
  }

  /* Chatroom-push zonder topicId → op zijn minst de roomlijst tonen. */
  if (isChatroom) {
    navigationRef.dispatch(
      CommonActions.navigate('Landing', { screen: 'Chatruimtes' })
    );
    return;
  }

  navigationRef.dispatch(
    CommonActions.navigate('Landing', { screen: 'Tijdlijn' })
  );
}

/**
 * Hangt de listeners op. Rendert niets — hoort binnen de
 * NavigationContainer zodat `navigationRef` gegarandeerd bestaat, en binnen
 * de NotificationProvider zodat de badges na een tik meteen hertellen.
 */
export function PushRouter() {
  const { refresh } = useNotifications();
  const handledIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    const handle = ({ data, id }: PushResponse) => {
      if (handledIds.current.has(id)) return;
      handledIds.current.add(id);
      navigateFromPush(data);
      /* De server zette de badge al; hertellen zodat de in-app tellers en
         het app-icoon meteen kloppen na het openen. */
      refresh();
    };

    /* Koude start: de app werd door deze notificatie geopend. */
    getInitialPushResponse().then(response => {
      if (!cancelled && response) handle(response);
    });

    const unsubscribe = addPushResponseListener(handle);

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [refresh]);

  return null;
}
