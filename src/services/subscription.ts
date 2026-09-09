/**
 * SUBSCRIPTION SERVICE
 *
 * Controleert of het lidmaatschap van een gebruiker nog actief is.
 * Spiegel van `fetchSubscriptionStatus` + `subscriptionAccessMessage`
 * in de website (`js/supabase.js`).
 *
 * Endpoint:
 *   GET /api/subscription-status?email=…  → { active, reason, end_date, is_admin }
 *
 * Bewust ZONDER Authorization-header: het endpoint is publiek (de website
 * pingt het elke 2 minuten vóór de sessie rond is). Dat is hier een
 * voordeel — de toegangscheck blijft werken terwijl een JWT net ververst
 * wordt, en kan dus nooit iemand buitensluiten door een tokenprobleem.
 *
 * FAIL-OPEN. Bij een netwerkfout, timeout of onleesbaar antwoord geven we
 * `active: true` terug. Dat is een bewuste keuze, identiek aan de website:
 * een hikkende server mag nooit een betalend lid buitensluiten. Alleen een
 * écht serverantwoord met `active: false` sluit de deur.
 */

import { RAG_API_URL } from './hapjesheld';

/** Waarom iemand geen toegang heeft. `null` = wel toegang. */
export type AccessReason = 'not_registered' | 'cancelled' | 'expired' | null;

export interface SubscriptionStatus {
  active: boolean;
  reason: AccessReason;
  /** ISO-datum tot wanneer de toegang loopt, of null. */
  end_date: string | null;
  is_admin: boolean;
}

/** Wat we teruggeven als we het niet kunnen weten — zie fail-open hierboven. */
const ONBEKEND: SubscriptionStatus = {
  active: true,
  reason: null,
  end_date: null,
  is_admin: false,
};

const TIMEOUT_MS = 10_000;

/**
 * Haal de toegangsstatus op. Gooit nooit: bij twijfel krijgt de gebruiker
 * toegang en beslist een volgende poging opnieuw.
 */
export async function getSubscriptionStatus(
  email: string | null
): Promise<SubscriptionStatus> {
  if (!email) return ONBEKEND;

  /* Eigen timeout: zonder deze blijft de gate hangen op een trage
     verbinding en ziet de gebruiker een oneindige spinner. */
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(
      `${RAG_API_URL}/api/subscription-status?email=${encodeURIComponent(
        email.trim().toLowerCase()
      )}`,
      { signal: controller.signal }
    );
    if (!response.ok) return ONBEKEND;

    const data = (await response.json()) as Partial<SubscriptionStatus>;
    /* Alleen een expliciete `false` sluit af. Ontbreekt het veld, dan weten
       we het niet en gaat de deur open. */
    if (data?.active === false) {
      return {
        active: false,
        reason: (data.reason ?? null) as AccessReason,
        end_date: data.end_date ?? null,
        is_admin: !!data.is_admin,
      };
    }
    return {
      active: true,
      reason: null,
      end_date: data?.end_date ?? null,
      is_admin: !!data?.is_admin,
    };
  } catch {
    return ONBEKEND;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * De uitlegzin bij een geblokkeerde toegang. Spiegel van
 * `subscriptionAccessMessage()` op de website, met één verschil: de website
 * zegt "verleng je lidmaatschap op prilleven.be", maar daar staat geen
 * verlengpagina — de checkout loopt via Plug&Pay en de community op
 * community-web.prilleven.be. We noemen hier dus geen domein.
 */
export function accessMessage(status: SubscriptionStatus | null): string {
  if (!status) return 'Je hebt momenteel geen toegang.';
  if (status.reason === 'not_registered') {
    return 'Dit account is niet geregistreerd. Neem contact op als dit een vergissing is.';
  }
  if (status.reason === 'cancelled' || status.reason === 'expired') {
    return 'Je lidmaatschap is verlopen. Zodra je verlengt krijg je meteen weer toegang tot alles.';
  }
  return 'Je hebt momenteel geen toegang tot de app.';
}

/** "12 september 2026", of '' als de datum onbekend of onleesbaar is. */
export function formatEndDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('nl-BE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
