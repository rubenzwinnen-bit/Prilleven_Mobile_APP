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

export const PRIVACY_URL = 'https://community-web.prilleven.be/privacy.html';
export const TERMS_URL = 'https://community-web.prilleven.be/voorwaarden.html';

/**
 * Mag de app naar de checkout linken?
 *
 * Nee op iOS. Het lidmaatschap is een digitale dienst, en App Store-richtlijn
 * 3.1.1 verbiedt knoppen of links naar een andere aankoopmethode dan in-app
 * aankoop. Richtlijn 3.1.3(b) staat wél toe dat de app content ontsluit die
 * elders is gekocht — dus inloggen en gebruiken mag, alleen de koopknop niet.
 * Een afkeuring op dit punt blokkeert élke volgende release.
 *
 * Op Android is die beperking er niet en tonen we de echte knop.
 *
 * Waar dit false is, verwijzen we in platte tekst naar "de webversie" —
 * zonder domein en zonder tap-actie.
 */
import { Platform } from 'react-native';

export const MAG_NAAR_CHECKOUT_LINKEN = Platform.OS !== 'ios';
