/**
 * EXTERNE LINKS
 *
 * Publieke URL's die op meerdere plaatsen nodig zijn. Eén plek, zodat een
 * domeinwijziging niet half doorgevoerd raakt.
 *
 * NB: `CHECKOUT_URL` staat aan de web-zijde óók in `index.html`,
 * `script.js` en `api/aanraders.mjs`. Wijzigt hij, dan daar alle drie mee.
 */

/** Plug&Pay-checkout van de community. */
export const CHECKOUT_URL =
  'https://prillenbe.plugandpay.com/checkout/pril-leven-community';

/** Algemene website. Bewust de merksite en NIET de community-webapp: het
 *  inlogscherm daarvan heeft een "Word lid"-knop, en een link daarheen is op
 *  iOS een oproep tot kopen buiten de app (zie MAG_NAAR_CHECKOUT_LINKEN). */
export const WEBSITE_URL = 'https://prilleven.be';

export const PRIVACY_URL = 'https://community-web.prilleven.be/privacy.html';
export const TERMS_URL = 'https://community-web.prilleven.be/voorwaarden.html';

/**
 * Mag de app naar de checkout linken?
 *
 * Nee op iOS. Het lidmaatschap is een digitale dienst, en App Store-richtlijn
 * 3.1.1 verbiedt knoppen, links of andere oproepen die naar een andere
 * aankoopmethode dan in-app aankoop leiden.
 *
 * De regel die ons wél toestaat zonder in-app aankoop te werken is
 * **3.1.3(f)** — een gratis app die hoort bij een betaalde webdienst — en die
 * stelt als voorwaarde dat er GEEN oproepen in de app staan om buiten de app
 * te kopen. Dat is strenger dan alleen "geen link": ook een zin die zegt waar
 * je lid wordt, of een link naar een webpagina met een koopknop (zoals het
 * inlogscherm van de website, met zijn "Word lid"-CTA), valt eronder.
 *
 * NB: 3.1.3(b) (multiplatform services) is NIET van toepassing — die regel
 * vereist dat het abonnement óók als in-app aankoop te koop is, en dat is bij
 * ons niet zo.
 *
 * Een afkeuring op dit punt blokkeert élke volgende release, ook als die over
 * iets heel anders gaat.
 *
 * Op Android is die beperking er niet en tonen we de echte knop.
 *
 * Waar dit false is: geen link, geen domein, en ook geen verwijzing naar waar
 * je lid wordt — enkel neutraal uitleggen dat je met een bestaand account
 * inlogt.
 */
import { Platform } from 'react-native';

export const MAG_NAAR_CHECKOUT_LINKEN = Platform.OS !== 'ios';
