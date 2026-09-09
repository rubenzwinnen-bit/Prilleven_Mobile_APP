# PLAN-MOBILE-3.2 — Web-pariteit ronde 4

Werkdocument voor de mobiele app. Bron: `~/Desktop/Prilleven/Project_weekschema_Productie`
(web v4.0.32). Elke sessie leest dit eerst; afgewerkte blokken krijgen ✅.

Acht werkblokken. Blok 8 (inlogzone) is er tijdens het opzoekwerk bijgekomen.

---

## 1. Push-notificaties op het app-icoon

**Web (klaar en gecommit):** `api/_lib/push.mjs` (Expo Push API, ontvangerbepaling,
chunks van 100), `api/_lib/badges.mjs` (`computeTotalBadge`), routes
`POST/DELETE /api/community/push/register` + `PUT /api/community/badge-state` in de
`community.mjs` catch-all, migratie `2026-07-08-push-notifications.sql`
(`push_tokens`, `user_badge_state`).

**App (staat al in de working tree, ongecommit):** `src/services/push.ts` (nieuw) +
wijzigingen in `NotificationContext`, `UserContext`, `app.json` (`aps-environment`,
expo-notifications plugin), `package.json` (`expo-notifications`, `expo-device`,
`expo-constants` — geïnstalleerd).

### Nog te doen
| # | Taak | Status |
|---|---|---|
| 1.1 | Tap-afhandeling: tik op een push → Tijdlijn of het juiste ChatTopic. | ✅ 2026-09-02 |
| 1.2 | Android-notificatiekleur in `app.json` (nu `#C98966`) → merkgroen na blok 5. | ⬜ wacht op blok 5 |
| 1.3 | EAS-credentials: APNs-key (Apple) + FCM v1 service-account (Google). | ⬜ jij |
| 1.4 | `eas build --profile preview` op een écht toestel — push werkt NIET in Expo Go. | ⬜ jij |
| 1.5 | Test: app dicht / achtergrond / voorgrond; tik navigeert; badge klopt na openen tijdlijn; badge weg na uitloggen. | ⬜ **uitgesteld tot het einde** — beslist 2026-09-09 |
| 1.6 | Versie-bump naar 3.2.0 + committen (beide projecten). | ⬜ na 1.5 |

### 1.1 — wat er gebouwd is (2026-09-02)

**App:**
- `src/services/push.ts` +`PushKind` / `PushData` / `PushResponse`,
  `addPushResponseListener(cb)` (tik terwijl de app draait) en
  `getInitialPushResponse()` (koude start, `getLastNotificationResponseAsync`).
  De service navigeert bewust niet zelf.
- `src/navigation/pushRouting.tsx` (nieuw): `navigationRef` +
  `<PushRouter />`. Routes: `timeline_*` → Landing/Tijdlijn ·
  `chatroom_*` met `topicId` → Landing/Chatruimtes/ChatTopic ·
  `chatroom_*` zonder topicId → Landing/Chatruimtes ·
  geen of onbekende payload → Landing/Tijdlijn. Een `handledIds`-set voorkomt
  dubbel navigeren, want `getLastNotificationResponseAsync()` blijft na een
  koude start hetzelfde antwoord geven. Na elke tik volgt `refresh()` zodat
  tellers en app-icoon meteen kloppen.
- `App.tsx`: `<NavigationContainer ref={navigationRef}>` + `<PushRouter />`.
- Barrel + CLAUDE.md bijgewerkt. `npx tsc --noEmit` schoon.

**Website** (nodig, want de server stuurde alleen title/body/badge):
- `api/_lib/push.mjs::notifyNewActivity` bouwt nu
  `data: { kind, topicId?, postId?, roomSlug?, roomTitle? }` en hangt dat aan
  elk Expo-bericht. Lege velden worden weggelaten.
- `api/chat-rooms.mjs` (topic.create) geeft `topicId` + `roomSlug` + `roomTitle` mee.
- `api/community.mjs` geeft `postId` mee bij post- en reply-create. De app doet
  daar vandaag niets mee (er is geen post-detailscherm) — het staat er zodat een
  latere deeplink naar één post geen tweede deploy vraagt.
- `api/CLAUDE.md` bijgewerkt. `node --check` op de drie bestanden OK.
- ✅ **Gedeployed naar productie op 2026-09-02** — commits `6463c82` (code) en `a5fb38a` (docs), deployment `dpl_H1FA…`, READY op community-web.prilleven.be. Rooktest: root 200, `/api/subscription-status` geeft correcte JSON, `/api/chat-rooms` geeft 401 (auth actief), `/aanraders` 200 — de twee gewijzigde API-bestanden laden dus zonder runtime-fout.
- ⬜ De payload zelf is pas te zien in een echte push, dus die verificatie hangt aan 1.4/1.5.

---

## 2. Functie "Aanraders"

**Web:** `api/aanraders.mjs` (1611 regels — publieke HTML + admin-CRUD + sitemap),
`aanraders.css`, `aanraders-filters.js`, `js/components/aanraders.js`
(fragment-injectie via `?fragment=1`). Spec: `PLAN-AFFILIATE.md`.
Tabellen `affiliate_categories` / `affiliate_products` / `affiliate_downloads`.

**Sleutelgegeven:** RLS = `select using (zichtbaar = true)` voor **anon**. De app kan
die drie tabellen rechtstreeks via de Supabase anon-key lezen — het
`services/recipes.ts`-patroon. **Geen website-werk nodig.**

### Twee aanpakken
- **A — native (voorkeur).** `services/aanraders.ts` + `AanradersScreen` (overzicht,
  favorieten van Anneleen, categorieën, downloads) → `AanraderCategorieScreen` →
  `AanraderProductScreen`. Affiliate-links via `Linking.openURL`, kortingscode via
  Clipboard. `relatie_type`-label verplicht zichtbaar op kaart én detail.
- **B — WebView** op `https://community-web.prilleven.be/aanraders`. Sneller, maar:
  geen native gevoel, én de standalone-pagina bevat in `layout()` een
  "Lid worden van de community"-knop naar de Plug&Pay-checkout (regel 1011) — die
  komt in het fragment niet voor, maar bij een WebView op de publieke pagina wél.
  Zie blok 8 waarom dat op iOS een probleem is.

Plus: 5de landing-tegel "Aanraders" (`fotos/aanraders.png` → `assets/landing-aanraders.png`),
route in `RootStackParamList`. Filters uit `aanraders-filters.js`: leeftijd (ondergrens,
enkelvoudig), categorie, prijs, materiaal, merk (meervoudig, OF) + zoeken.

---

## 3. Abonnement opzeggen

**Web:** `api/opzegverzoek.mjs` — `GET` = staat er een open verzoek? / `POST` = rij in
`cancellation_requests` + mail via Resend naar hallo@prilleven.be. UI in
`js/components/profiel.js::bindOpzegSection`. Zelf opzeggen in Plug&Pay kan niet
(Ultimate-only, wij draaien Premium) → handmatige afhandeling.

### App
- `services/subscription.ts`: `getSubscriptionStatus(email)` (endpoint dat `getIsAdmin`
  al gebruikt geeft ook `active`, `reason`, `end_date`), `getOpzegverzoek()`,
  `createOpzegverzoek(reden?)`.
- `ProfileScreen` → sectie **Account**: rij "Lidmaatschap — Actief tot 12 september 2026"
  + blok "Abonnement opzeggen" met `Alert`-bevestiging. Open verzoek → knop verdwijnt,
  bevestigingstekst verschijnt. Status komt uit de DB, niet uit AsyncStorage.

---

## 4. Gamification

De website heeft vier oppervlakken, allemaal bewust nog **localStorage-preview**
(fase 1 van het plan in `PLAN-TIMELINE.md` regel 959+):

| Oppervlak | Web-bestanden | Opslag |
|---|---|---|
| **Cooked it + Pril Ritme** — veeg om af te ronden op receptdetail, groen vinkje op de weekschema-tegel, 3 unieke kookdagen/week + 4-weken markerrij, mijlpalen (eerste Cooked it / eerste volle week / 5 verschillende recepten), "Hoe smaakte het?"-uitnodiging | `js/store.js` 600-810, `recipeDetail.js`, `weekSchedule.js` | `prilleven_cooked_meals_<user>` |
| **Mijn leertraject** — Nieuw/Bezig/Afgerond, "Ga verder met…", schuifactie op detail | `js/learningProgress.js`, `learningsLibrary.js`, `learningsDetail.js` | `prilleven_learning_progress_<user>` |
| **Allergenenpad** | `allergenen.js::renderAllergenPath` | afgeleid, geen opslag |
| **HapjesHeld "Dit helpt mij"** | `js/chat.js` | `prilleven_chat_helped_<email>` |

**Kernbeslissing.** Het gamificatieplan zet mobiel expliciet in **fase 5**, ná de
cross-device Supabase-basis (fase 3). Spiegelen we nu naar AsyncStorage, dan telt een
Cooked it op de website niet mee in de app en omgekeerd.

- **A — spiegelen als lokale preview.** Snel, geen DB-werk, twee losse voortgangen.
- **B — eerst de Supabase-basis.** Tabel `cooking_events` (+ evt. `learning_progress`)
  met RLS, website ombouwen, dán de app. Eén telling. Raakt het website-project.
- **C — gefaseerd.** Allergenenpad (blok 7) en leertraject-statussen nu (die zijn
  grotendeels afgeleid van bestaande serverdata: bookmarks + doses), Cooked it/Pril
  Ritme pas na de Supabase-basis.

App-kant: swipe-to-complete met `gesture-handler` + `reanimated` (beide aanwezig).
Haptics vereist `expo-haptics` — nieuwe dependency, dus eerst vragen.

---

## 5. Nieuwe kleurcodering — merkgroen centraal

**Web:** sinds 2026-08-01 is `--color-green-text: #4F7D6C` DE groentint, voor tekst én
vlakken. `--color-green-dark: #3F6558` is enkel hover. De salie-vullingen `#98C3A4` /
`#82BE93` zijn afgeschreven (staan nog in `:root` met "niet gebruiken"-comment).
Terracotta `#C98966` blijft de hoofdkleur.

Groen geworden op de web: `.btn-secondary`, genereer-knop, chatbubbels en -knoppen,
header-iconen, tabs én subtabs (tekst + onderstreping), dagkiezer weekschema,
leeftijdspil bij recepten, alles groens in tijdlijn en chatruimtes
(`.tl-*`, `.rooms-*`, `.follow-btn`).

### App
1. `constants/theme.ts`: `greenText: '#4F7D6C'` + `greenDark: '#3F6558'`;
   `secondary`/`secondaryDark` als afgeschreven markeren (niet verwijderen — 43 refs).
2. Sweep over 21 bestanden met `colors.secondary` + 9 hardcoded `#4a7c59`
   (`RecipeDetailScreen`, `RecipeCard`).
3. Schermen die nu `colors.primary` gebruiken waar de web groen werd: weekschema-tabs
   en dagkiezer (blok 6), leeftijd-badge, follow-knoppen, HapjesHeld-chatbubbels.
4. Android-notificatiekleur in `app.json` mee omzetten.

Aanpak: één commit tokens + mechanische sweep, daarna per scherm visueel nakijken.

---

## 6. Tabs in "Weekschema"

**Web (`weekSchedule.js` + `styles.css`):**
- **Subtabs** (Actief weekschema / Genereren): platte tekst-tabs, 3px groene
  onderlijn onder de actieve, geen achtergrondvlak.
- **Dagkiezer** (Vandaag / Vandaag en morgen / Heel weekschema): segmented control —
  één lage container (`--color-bg`, 1px `--color-light`, radius 12) met pill-knoppen;
  actieve = gevuld groen pilletje met zachte schaduw.
- Grote filterkaart vervangen door één lage titel-/segmentbalk
  (`active-schedule-toolbar`).
- Elke dag = 5 compacte fototegels (eetmoment + receptnaam) met het groene Cooked
  it-vinkje op de foto.

**App (`WeekScheduleScreen.tsx` ±293-390 + styles):** subtabs nu terracotta,
presetknoppen nu losse omrande knoppen. Fototegels horen bij blok 4 — samen doen,
anders bouw je ze twee keer.

---

## 7. Meldingen en weergave bij "Allergenen introduceren"

**Web (`js/components/allergenen.js`, 1225 regels):**

| Wijziging | Detail |
|---|---|
| **Allergenenpad-kaart** (`renderAllergenPath`, r. 858) | Eén kaart: `Allergenenpad · <kindnaam>`, teller `x/9` opgevolgd, 9 klikbare statussegmenten, korte zachte mijlpaal, en "Volgende stap" met CTA + hoeveelheid + allergeenfoto in dezelfde kaart. |
| **Losse Hoeveelheden-tegel weg** | Hoeveelheid staat in de Volgende stap-kaart. App heeft nog `HoeveelhedenBox` (r. 203). |
| **Eén veiligheidsbalk** (`renderSafetyBar`, r. 674) | Max. één melding per kindje, niet inklapbaar. Ernstig (⚠️, dose `ernstig` of symptoom `heftig` < 14 d) gaat vóór twijfel (●, `mild`/`matig`). Statusteksten niet herhalen — die blijven in de tegels. |
| **Medisch toezicht compact** | Onder de CTA van Volgende stap. |
| **Pencil-edit** | Doses + symptoom-logs bewerken via modal i.p.v. verwijderen. |
| **Segmentklik** | Wacht de accordeon-transitie af, lijnt de doeltegel via `scroll-margin-top` onder de sticky header uit. |
| **Ernst-labels** | mild 🟢 Mild · matig 🟠 Twijfel · heftig 🔴 Ernstig. |

**App:** `EersteHapjesScreen.tsx` (2370 r.) heeft al `NextUpBanner`,
`shouldShowArtsWarning`, `DisabledCard`, `PauseFlowCard`, `SetupCard`. De
symptoomvelden (`time_after_eating`, `duration`, `worsened`, `behavior`) zitten er
al in — CLAUDE.md §5 is op dat punt achterhaald en moet mee bijgewerkt.
Werk: `AllergenPathCard` bouwen, `HoeveelhedenBox` opheffen in de Volgende stap-kaart,
`shouldShowArtsWarning` uitbreiden naar de twee-niveau veiligheidsbalk, pencil-edit.

---

## 8. Inlogzone & lidmaatschap  ← NIEUW

**Web (`index.html` + `script.js` + `js/supabase.js`):**

1. **Lidmaatschap-CTA onder alle auth-views** (`index.html` r. 134-138):
   "Nog geen lid? **Word lid van Pril Leven**" →
   `https://prillenbe.plugandpay.com/checkout/pril-leven-community`.
2. **Verlopen-scherm** (`script.js::showSubscriptionExpiredScreen`, r. 197-280):
   volledig-scherm overlay met 🌿, "Je lidmaatschap is verlopen", een boodschap uit
   `subscriptionAccessMessage(status)` (drie varianten op `reason`:
   `not_registered` / `cancelled` / `expired`), en drie acties:
   "Lid worden van de community" (checkout), "Net betaald? Check opnieuw"
   (cache invalideren + hercheck), "Uitloggen".
3. **Toegangscontrole bij élke login** (`completeLogin`, r. 373): na `signIn` volgt
   `fetchSubscriptionStatus(email)`; niet actief → verlopen-scherm i.p.v. de app.
4. **Poll elke 60 s** (`startSubscriptionPoll`, r. 179) om een opzegging live te
   detecteren zonder refresh, + `verifySubscriptionInBackground` na de optimistische
   start.
5. **Specifieke signup-fouten** (r. 454-462): onderscheid tussen "heeft al een account
   → gebruik Inloggen" en "niet geregistreerd — heb je al betaald?".

De checkout-URL staat op **drie** plaatsen (`index.html`, `script.js`,
`api/aanraders.mjs::CHECKOUT_URL`); bij wijziging alle drie.

### Wat de app nu doet
- `AuthScreen`: 3 tabs, consent-zin, juridische footer. **Geen** lidmaatschap-CTA.
- `services/auth.ts`: whitelist (`allowed_users`) wordt **alleen bij signup** gecheckt.
- `signIn` doet géén toegangscontrole; er is nergens een `subscription-status`-call
  behalve de `is_admin`-check.
- **Gevolg: een lid met een verlopen abonnement behoudt in de app volledige toegang,
  onbeperkt.** Dat is geen cosmetisch verschil maar een gat in de toegangscontrole.

### App-werk
| # | Taak |
|---|---|
| 8.1 | `services/subscription.ts` (gedeeld met blok 3): `getSubscriptionStatus(email)` + `accessMessage(status)` als spiegel van `subscriptionAccessMessage`. |
| 8.2 | `AppGate` / `UserContext`: na login én bij `AppState 'active'` de status checken. Niet actief → `SubscriptionExpiredScreen` i.p.v. de navigatieboom. **Fail-open bij netwerkfout**, exact zoals de web (`fetchSubscriptionStatus` sluit niemand uit als de server hikt). |
| 8.3 | `SubscriptionExpiredScreen`: boodschap + "Net betaald? Check opnieuw" + "Uitloggen". Over de knop "Lid worden" → zie beslissing hieronder. |
| 8.4 | Poll elke 60 s zolang de app in de voorgrond staat (spiegel van `startSubscriptionPoll`). |
| 8.5 | `AuthScreen`: signup-foutmelding splitsen in "heeft al een account" vs. "niet geregistreerd — heb je al betaald?" (`checkAllowedUser` bestaat al in `services/auth.ts`). |
| 8.6 | Lidmaatschap-CTA onder de auth-card → zie beslissing hieronder. |

### Beslissing: mag de checkout-link in de app?

Het lidmaatschap is een **digitale dienst**. App Store-richtlijn 3.1.1 verbiedt
knoppen of links die naar een andere aankoopmethode dan in-app aankoop leiden; 3.1.3(b)
staat wél toe dat de app content ontsluit die elders is aangekocht. Een tappable
"Word lid"-knop naar de Plug&Pay-checkout is precies wat daar sneuvelt. Play hanteert
een vergelijkbare, maar in de EER soepelere regel. De app draait vandaag zonder zo'n
link en is goedgekeurd.

**Gekozen: A — platform-afhankelijk** (beslist 2026-09-02).

- **iOS:** neutrale platte tekst, geen domein, geen tap-actie:
  *"Je lidmaatschap is niet actief. Je beheert je lidmaatschap in de webversie van
  Pril Leven. Net betaald? Tik op Check opnieuw."*
  Een reviewer struikelt over knoppen en URL's, niet over een neutrale zin.
- **Android:** volledige tappable CTA naar `CHECKOUT_URL`.
- **Beide:** "Net betaald? Check opnieuw" + "Uitloggen".

Verworpen: B (overal de link — reëel afkeuringsrisico dat ook de push-release
blokkeert) en C (nergens een verwijzing — laat Android-gebruikers zonder route).

**NB — foutje aan de web-zijde.** `js/supabase.js:371` zegt "Verleng je lidmaatschap
op **prilleven.be**", maar de checkout staat op `prillenbe.plugandpay.com` en de
community op `community-web.prilleven.be`. Niet overnemen in de app; los aan de
web-zijde te corrigeren.

Dezelfde vraag geldt voor blok 2: bij een **WebView** op `/aanraders` komt de
"Lid worden"-knop uit de paginaheader mee. Bij de **native** variant niet — het
fragment bevat die header niet. Nog een reden voor de native aanpak.

---

## Testbeleid (beslist 2026-09-09)

Niet per blok bouwen en testen, maar **alles eerst uitprogrammeren en dan één
build**. Reden: blok 5 t/m 8 zijn puur JS/TS, dus een build levert daar niets op
wat je niet ook in code ziet.

Gevolgen om te onthouden:
- **De pushtest (1.5) schuift naar het einde**, samen met de rest.
- **Ruben heeft geen Android-toestel, enkel een iPhone.** De Android
  preview-build van 2026-09-09 is daardoor enkel een configuratiecheck
  (bewijst dat `google-services.json` + de plugin compileren), geen
  testinstrument. Android push blijft ongetest tot iemand met een
  Android-toestel meekijkt — regelen vóór de store-release.
- **Kritiek pad voor iOS: de Apple Program License Agreement.** Zolang die niet
  geaccepteerd is kan EAS geen APNs-sleutel maken en geen iOS-build tekenen.
- Distributie naar de iPhone: TestFlight (production + `eas submit`, `ascAppId`
  staat al ingesteld) of ad hoc (`eas device:create` + preview-profiel).
  TestFlight heeft de voorkeur — geen UDID-beheer, en Anneleen kan mee testen.

## Voorgestelde volgorde

| Release | Inhoud | Waarom hier |
|---|---|---|
| **3.2.0** | Blok 1 afmaken (tap-handling, credentials, build) | Code staat er al, ongecommit |
| **3.3.0** | Blok 8 (inlogzone + toegangscontrole) | Gat in de toegangscontrole; deelt `services/subscription.ts` met blok 3 |
| **3.4.0** | Blok 5 (kleuren) + blok 6 (tabs) | Tabs worden groen — samen doen |
| **3.5.0** | Blok 7 (allergenen) | Zelfstandig, groot, één scherm |
| **3.6.0** | Blok 3 (opzeggen) + blok 2 (aanraders) | Beide nieuw en afgebakend |
| **3.7.0** | Blok 4 (gamification) | Hangt af van keuze A/B/C |

### Stand van zaken (2026-09-09)

| Blok | Status |
|---|---|
| 1 — push | Code ✅ (app + server, server gedeployed). Testen ⬜ tot het einde. |
| 8 — inlogzone | ✅ `services/subscription.ts`, `lib/useSubscriptionGate.ts`, `SubscriptionExpiredScreen`, `constants/links.ts`, AuthScreen-CTA + gesplitste registratiefout. |
| 5 — kleuren | ✅ `greenText`/`greenDark` in `theme.ts`, 73 vervangingen over 22 bestanden, plus volgknop, genereerknop, leeftijd-badge en de HapjesHeld-tegel. |
| 6 — tabs weekschema | ✅ groene subtab-onderlijn, segmented dagkiezer, lage `activeToolbar`, dagblokken met groene rand + groene VANDAAG-badge. |
| 7 — allergenen | ✅ `AllergenPathCard`, `SafetyBar` (2 niveaus), `HoeveelhedenBox` en arts-toezicht-banner opgeheven, segmentklik scrolt naar de tegel. Pencil-edit op doses/symptomen bleek al te bestaan. |
| 2 — aanraders | ⬜ wacht op keuze native/WebView |
| 3 — opzeggen | ✅ `getOpzegverzoek`/`createOpzegverzoek` + rij "Lidmaatschap" en opzegblok in ProfileScreen. |
| 4 — gamification | ⬜ wacht op keuze A/B/C |

Nog niets gecommit in het app-project sinds `2f68625` (blok 1).

## Open beslissingen

1. **Gamification (4):** A (lokale preview), B (eerst Supabase cross-device), C (gefaseerd)?
2. **Aanraders (2):** native of WebView?
3. **Checkout-link (8):** A (platform-afhankelijk), B (overal), C (nergens)?
4. **Kleuren (5):** akkoord met de sweep over 21 bestanden in één commit?
5. **`expo-haptics`** toevoegen voor swipe-feedback: ja/nee?
6. **Volgorde** akkoord?

## Valkuilen

- Push werkt niet in Expo Go — altijd via een EAS dev/preview-build valideren.
- Toegangscontrole moet **fail-open** zijn bij netwerkfouten, net als de web.
- Checkout-URL staat op drie plaatsen aan de web-zijde.
- `reanimated`/`worklets` blijven exact gepind (4.1.1 / 0.5.1).
- CLAUDE.md §5 (SymptomFormScreen) is achterhaald: de vier symptoomdetailvelden
  zitten er al in. Bijwerken bij blok 7.
