/**
 * useSubscriptionGate
 *
 * Bewaakt of het lidmaatschap nog actief is, zolang er iemand ingelogd is.
 * Tot nu controleerde de app dat NERGENS: `allowed_users` werd alleen bij
 * registratie geraadpleegd, dus een lid met een verlopen abonnement hield in
 * de app onbeperkt toegang. De website doet dit al bij elke login plus een
 * poll van 60 seconden; dit is daar de spiegel van.
 *
 * Optimistische start, net als de website (`verifySubscriptionInBackground`):
 * we blokkeren de eerste render NIET. De app verschijnt meteen en pas als de
 * server expliciet `active: false` zegt schuift het verlopen-scherm ervoor.
 * Zo betaalt niemand bij elke start een netwerkronde met een spinner, en
 * blijft een trage of hikkende server onschadelijk.
 *
 * `getSubscriptionStatus` is fail-open: bij een netwerkfout krijg je
 * `active: true` terug. Alleen een echt serverantwoord sluit de deur.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { getSubscriptionStatus, type SubscriptionStatus } from '../services';

const POLL_INTERVAL_MS = 60_000;

export interface SubscriptionGate {
  /** De laatst bekende status, of null zolang er nog niets gecheckt is. */
  status: SubscriptionStatus | null;
  /** True zodra de server expliciet zegt dat er geen toegang is. */
  geblokkeerd: boolean;
  /** Nu opnieuw navragen — gebruikt door de "Check opnieuw"-knop. */
  recheck: () => Promise<void>;
}

export function useSubscriptionGate(user: string): SubscriptionGate {
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const userRef = useRef(user);
  userRef.current = user;

  const check = useCallback(async () => {
    const email = userRef.current;
    if (!email) return;
    const verse = await getSubscriptionStatus(email);
    /* Tijdens de call kan iemand uitgelogd of gewisseld zijn; dan hoort dit
       antwoord bij een ander account en gooien we het weg. */
    if (userRef.current !== email) return;
    setStatus(verse);
  }, []);

  /* Eerste controle + poll zolang de app in de voorgrond staat. */
  useEffect(() => {
    if (!user) {
      setStatus(null);
      return;
    }

    check();
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') check();
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [user, check]);

  /* Terug naar de voorgrond: meteen navragen. Een opzegging die tijdens het
     wegleggen van de telefoon inging, moet niet nog een minuut wachten. */
  useEffect(() => {
    if (!user) return;
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active') check();
    });
    return () => sub.remove();
  }, [user, check]);

  return {
    status,
    geblokkeerd: status !== null && status.active === false,
    recheck: check,
  };
}
