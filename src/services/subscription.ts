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

/* ----------------------------------------
   OPZEGVERZOEK
   Klanten kunnen niet zelf opzeggen in Plug&Pay — zelfbediening zit daar
   enkel in het Ultimate-pakket en Pril Leven draait op Premium. Het
   verzoek loopt dus via ons: het endpoint legt een rij vast in
   `cancellation_requests` en mailt het team. Die rij is leidend, de mail
   is een seintje.

   Endpoint (website `api/opzegverzoek.mjs`), WEL met JWT:
     GET  /api/opzegverzoek → { open_verzoek: { aangevraagd_op } | null }
     POST /api/opzegverzoek → 201 { ok, aangevraagd_op }
                              200 { ok, al_ingediend: true, aangevraagd_op }

   Het e-mailadres haalt de server uit het geverifieerde token, nooit uit
   de body — anders kan iemand een opzegging voor een ander indienen.
---------------------------------------- */

import { supabase } from '../lib/supabase';

/** Een openstaand opzegverzoek, of null als er geen loopt. */
export interface Opzegverzoek {
  aangevraagd_op: string;
}

async function authedFetch(init: RequestInit = {}): Promise<Response> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error('Sessie kon niet worden opgehaald.');
  const token = data.session?.access_token;
  if (!token) throw new Error('Je sessie is verlopen. Log opnieuw in.');
  return fetch(`${RAG_API_URL}/api/opzegverzoek`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
}

/**
 * Staat er al een opzegverzoek open? Geeft `null` terug als er geen is,
 * én bij elke fout: dit mag het profielscherm nooit blokkeren. De knop
 * blijft dan gewoon staan, en een tweede indiening is onschadelijk omdat
 * de server idempotent is.
 */
export async function getOpzegverzoek(): Promise<Opzegverzoek | null> {
  try {
    const response = await authedFetch({ method: 'GET' });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      open_verzoek?: Opzegverzoek | null;
    };
    return data?.open_verzoek ?? null;
  } catch {
    return null;
  }
}

/**
 * Dien een opzegverzoek in. Gooit met een leesbare NL-melding als het
 * mislukt — hier mág de gebruiker het weten, want anders denkt hij
 * opgezegd te hebben terwijl er niets vastligt.
 *
 * `al_ingediend` betekent dat er al een verzoek openstond; dat is geen
 * fout, de server maakt dan geen tweede rij en stuurt geen tweede mail.
 */
export async function createOpzegverzoek(): Promise<{
  aangevraagd_op: string | null;
  al_ingediend: boolean;
}> {
  const response = await authedFetch({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const raw = await response.text();
  let data: any = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    /* geen JSON — val terug op de statuscode hieronder */
  }
  if (!response.ok) {
    throw new Error(data?.error || 'Kon het opzegverzoek niet indienen.');
  }
  return {
    aangevraagd_op: data?.aangevraagd_op ?? null,
    al_ingediend: !!data?.al_ingediend,
  };
}
