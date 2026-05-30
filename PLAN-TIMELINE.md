# Pril Leven Mobile App — Plan & Timeline

> Zusterproject: de **web-app** (`~/Desktop/Project_weekschema_Productie/`) heeft een eigen `PLAN-TIMELINE.md`. Beide projecten delen dezelfde Supabase-DB en Vercel-API, maar versionering en build-pipeline zijn los.
>
> Datum-secties van **nieuw naar oud**. Voeg een nieuwe sectie bovenaan toe per werksessie i.p.v. inline edits in oude secties.

---

## 2026-05-30 — Store-compliance + V3.0.0 release-build (v2.20.0 → v3.0.0)

**Context**: Voorbereiding op de eerste publieke release in de App Store + Play Store. Eerst een compliance-review uitgevoerd om store-rejections te vermijden, daarna de gevonden code-gaten gedicht en de grote V3.0.0-release gebouwd (alle features sinds v2.11.0 zaten al in `src/` maar waren nog niet als major release gebundeld/gebouwd).

### Afgerond deze sessie

- **Compliance-review** — gestructureerde checklist opgeleverd: ontbrekende in-app privacy-link, geen voorwaarden-pagina, geen consent-zin bij registratie + store-console TODO's (data safety, demo-account, content rating, screenshots).
- **v2.20.0 — juridische links (store-compliance)**:
  - `ProfileScreen.tsx` — nieuwe **Juridisch**-sectie: Privacybeleid (`shield`) + Gebruiksvoorwaarden (`file-text`), elk `Linking.openURL` naar `PRIVACY_URL`/`TERMS_URL`.
  - `AuthScreen.tsx` — consent-zin op de register-tab (tappable links) + altijd-zichtbare juridische footer onder de card. Constants `PRIVACY_URL`/`TERMS_URL`.
  - Web-project: **`voorwaarden.html`** aangemaakt (`~/Desktop/Project_weekschema_Productie/`, commit 2ce5a50) — 13 secties, zelfde stijl als `privacy.html`, incl. HapjesHeld geen-medisch-advies disclaimer. Bereikbaar op `community-web.prilleven.be/voorwaarden.html`.
- **v3.0.0 — grote release** (geen nieuwe feature-code, wel major version-bump + release-notes + builds): bundelt alle features sinds v2.11.0 (community-tijdlijn + eigen-content CRUD + likes + pinnen, chatruimtes + volgen + topic-follow + admin-intro, Learnings-viewer + PDF.js-viewer + bladwijzer/video-positie-sync, allergenen-flow feature-compleet, New Architecture).

### Status

- `npx tsc --noEmit` groen.
- **Beide EAS production-builds succesvol gequeued** (`--profile production --non-interactive --no-wait`):
  - Android (AAB): `https://expo.dev/accounts/prilleven/projects/prilleven-mobile-app/builds/bb8549ab-9da9-4bb6-b515-d9748fe078b8`
  - iOS: `https://expo.dev/accounts/prilleven/projects/prilleven-mobile-app/builds/8813f95f-8201-4c4a-a4f5-880fb94a0202`
- EAS `autoIncrement` schreef de build-nummers terug naar `app.json` (buildNumber 62→63, versionCode 66→67); die write-back is gecommit.
- Git clean, alles gepusht naar `main` (commits cd1114a v2.20.0, 616ade4 v3.0.0, 83fdcec build-nummers).

### Versie

`app.json.version` **3.0.0** · `ios.buildNumber` **63** · `android.versionCode` **67**. Nieuwe **builds** (geen EAS Update).

### Volgende stap

Store-console-administratie afronden (handmatig, kan Claude niet doen): data safety / privacy labels invullen (privacy-URL = `community-web.prilleven.be/privacy.html`), demo-account voor reviewers, content rating, screenshots/icon/feature graphic. Daarna `eas submit` naar TestFlight + Play Internal zodra de builds klaar zijn en de listings ingevuld.

### Open vragen / blockers

- Builds draaien nog op EAS (gequeued met `--no-wait`) — uitkomst nog niet geverifieerd.
- Store-listings + privacy-labels nog niet ingevuld in de consoles (user-taak).

---

## 2026-05-29 — Chatruimtes CRUD-MVP (v2.11.0)

**Context**: Tijdlijn-MVP stond op v2.10.0 met de footer-navigatie (`LandingTabs`, 3 tabs) en Chatruimtes als placeholder-scherm. Deze sessie heeft Chatruimtes uitgewerkt tot een volledige CRUD-MVP, parity met de website (`api/chat-rooms.mjs`).

### Scope (vooraf bevestigd)

- **Volledig CRUD**: rooms lezen, topics lezen/plaatsen, replies lezen/plaatsen, eigen topic/reply bewerken (15min-venster) + wissen.
- **Geen follow/unread-badges** (bewust overgeslagen — geen 60s-polling).
- **Admin-welkomsbericht read-only** bovenaan een room.

### Afgerond deze sessie

- **`services/chatRooms.ts`** (nieuw) — kopie van het `community.ts` auth-patroon. Constants: `ROOMS` (4 vaste rooms), `TOPIC_TITLE_MAX=120`, `TOPIC_BODY_MAX=4000`, `REPLY_BODY_MAX=2000`, `EDIT_WINDOW_MS=15min`. Types: `AdminIntro`, `ChatRoom`, `ChatRoomDetail`, `ChatTopic`, `ChatReply`. Helpers: `getCurrentUserId()` (uit `supabase.auth.getSession()` — UserContext heeft enkel email, niet de auth-UUID), `roomEmoji()`, `isWithinEditWindow()`. CRUD: `listRooms`, `getRoom`, `getTopic`, `createTopic`, `updateTopic`, `deleteTopic`, `createReply`, `updateReply`, `deleteReply`.
- **`services/index.ts`** — chatRooms-exports toegevoegd. **NB**: `createReply` + `REPLY_BODY_MAX` botsen met `community.ts`; daarom **niet** via de barrel geëxporteerd — `ChatTopicScreen` importeert ze rechtstreeks uit `./chatRooms`.
- **Navigatie** — `ChatRoomsStackParamList` in `navigation/types.ts`; `Chatruimtes`-tab nu `NavigatorScreenParams<ChatRoomsStackParamList>`. Nieuwe `navigation/ChatRoomsStack.tsx` (RoomList → ChatRoom → ChatTopic → ChatTopicForm). `LandingTabs.tsx` wijst de tab naar `ChatRoomsStackNavigator`.
- **4 schermen**: `ChatRoomsListScreen` (roomlijst + fallback uit `ROOMS`), `ChatRoomScreen` (admin-intro read-only + topic-lijst gepind-eerst + "Nieuw topic"-FAB), `ChatTopicScreen` (topic-body + replies + composer + eigen edit/delete via `getCurrentUserId` + `isWithinEditWindow`), `ChatTopicFormScreen` (create/edit topic).
- **`ChatRoomsScreen.tsx`** (placeholder) verwijderd.

### Status

- `npx tsc --noEmit` groen (na fix van de `createReply`/`REPLY_BODY_MAX` barrel-botsing).
- Geen EAS-build getriggerd; geen version-bump in `app.json` (vereist user-bevestiging).

### Pariteit met web-app

| Flow | Web | Mobile |
|---|---|---|
| Chatruimtes (rooms → topics → replies, CRUD) | v3.0.0 | ✅ v2.11.0 |
| Admin-welkomsbericht in room | v3.0.0 | ✅ v2.11.0 (read-only) |
| Follow-rooms / unread-badges | v3.0.0 | ⬜ overgeslagen |

### Volgende stap

Version-bump + commit + push (op user-bevestiging): `app.json.version` → 2.11.0, `ios.buildNumber` 37→38, `android.versionCode` 41→42. Daarna tijdlijn-uitbreidingen (foto's, polls, reply-likes, notificaties) of push-notificaties.

### Open vragen / blockers

- Version-bump nog niet uitgevoerd (wacht op user).
- Niet gecommit deze sessie.

---

## 2026-05-27 — Allergenen-flow parity met website (v2.7.0 → v2.9.1)

**Context**: Doorgewerkt aan parity met de webversie van de allergenen-introductieflow. De website draait sinds v3.0.0 en heeft een uitgebreide setup + welcome + pause + arts-toezicht-flow; mobile zat op v2.6.0 (MVP doses + symptomen). Deze sessie heeft mobile naar v2.9.1 gebracht.

### Afgerond deze sessie

- **v2.8.4** — Timezone-fix in `ChildFormScreen::validateBirthdate`: UTC-getters → lokale getters zodat geboortedatum vandaag/morgen geen valse "in de toekomst"-fout geeft (Belgische timezone).
- **v2.8.5** — Setup-flow card "Reeds geïntroduceerd?" in `EersteHapjesScreen`: checkbox-grid voor de 9 allergenen, persisteert `allergen_state.pre_introduced[]` via `patchEhState`.
- **v2.8.6** — Welcome-card (🍽 icoon + "Start met introduceren"-CTA) als `state.started !== true`; setup-items kregen foto-achtergrond + `LinearGradient` sage-overlay (parity met website-CSS).
- **v2.8.7** — `SymptomFormScreen` linked-allergen picker toont nu alle geïntroduceerde keys (unie van doses + `pre_introduced` + `known_allergies` via Set, mirror van website `computeIntroducedKeys()`).
- **v2.8.8** — Intro-text onder header in `EersteHapjesScreen`, paritair met website `.allergenen-intro`.
- **v2.8.9** — Pause-flow basis: zodra `state.paused === true` worden de "Symptoom-loggen"-knop én de Hoeveelheden-box verborgen tot de gebruiker de pause-flow doorlopen heeft (voorkomt dubbele loggen tijdens een actieve reactie).
- **v2.9.0** — Arts-toezicht-modus / exclude-toggle:
  - Extended `AllergenStatus` type met `'excluded'`.
  - Nieuwe `handleToggleExclude` callback die `excluded_keys` toggle't via `patchEhState`.
  - "Overslaan"/"Opnemen"-knop per allergeen-tegel, alleen zichtbaar in arts-toezicht-mode én als status ≠ veilig/allergisch.
- **v2.9.1** — Polish op exclude-knop:
  - Knop is text-only (geen icoon meer).
  - Knop verplaatst van header-row naar absolute positioning binnen de `ImageBackground` (rechtsonder, semi-transparante witte achtergrond), zodat de foto over de hele gesloten tegel blijft.
- **Tooling** — Nieuwe slash-commands aangemaakt voor mobile-app context:
  - `.claude/commands/start-sessie.md`
  - `.claude/commands/eind-sessie.md`
- **CLAUDE.md** — Bijgewerkt: §2 (build/version), §4.2/§5 (stand v2.9.1), `ChildFormScreen` (timezone), `EersteHapjesScreen` (welcome/setup/pause/exclude), `SymptomFormScreen` (allergen-unie), §6 (`eersteHapjes.ts` excluded status), §8 versionering, §14 roadmap.

### Status

- TS-bundle smoke-test (web/iOS/Android) groen sinds v2.8.7; geen runtime-errors in preview-logs of console-logs.
- Pre-existing warnings blijven (`textShadow*`/`shadow*` deprecation, require-cycle in `RootStack.tsx`) — niet aangeraakt deze sessie.

### Versie-stand

- `expo.version`: **2.10.0**
- `expo.ios.buildNumber`: **37**
- `expo.android.versionCode`: **41**

### Pariteit met web-app

| Flow | Web | Mobile |
|---|---|---|
| Allergenen-grid (status-derivatie) | v3.0.0 | ✅ v2.5.0 |
| Doses CRUD | v3.0.0 | ✅ v2.5.0 |
| Symptomen-log + red-flag | v3.0.0 | ✅ v2.6.0 |
| Welcome-card + setup-card (pre_introduced) | v3.0.0 | ✅ v2.8.6 |
| Linked-allergen-unie in symptoom-form | v3.0.0 | ✅ v2.8.7 |
| Pause-flow (hide Hoeveelheden + Symptoom-knop) | v3.0.0 | ✅ v2.8.9 |
| Arts-toezicht / exclude-toggle | v3.0.0 | ✅ v2.9.1 |
| Pause-wizard (3-staps modal + auto-trigger + allergisch ja/nee) | v3.0.0 | ✅ v2.9.1 |
| Tijdlijn / community feed | v3.0.0 | 🟡 MVP v2.10.0 (tekst: lezen/liken/reageren + admin-composer; foto's/polls/notificaties open) |
| Chatruimtes | v3.0.0 | 🟡 placeholder v2.10.0 (rooms→topics→replies open) |

> **Correctie (2026-05-29)**: de "readiness-checklist" bestaat **niet** op de webversie — dat was een foutieve aanname. De pause-wizard (3-staps modal: Gelezen → arts gecontacteerd → allergisch ja/nee) is **wél** volledig geïmplementeerd: auto-trigger in `SymptomFormScreen.tsx` (matig/heftig + gelinkt allergeen → `paused/paused_step/paused_type/paused_allergen` via `patchEhState`) + wizard-UI + `advancePauseStep`/`handleAllergyConfirmed`/`handleAllergyDenied` in `EersteHapjesScreen.tsx`. **Allergenen-introductie = feature-compleet t.o.v. web.**

### Volgende stap

Tijdlijn-MVP is gebouwd (v2.10.0): footer-navigatie (`LandingTabs`) met 3 tabs + `services/community.ts` + `TimelineScreen` (tekst-feed lezen/liken/reageren, admin-only composer). Chatruimtes is nu een placeholder-scherm.

Volgende roadmap-feature: **Chatruimtes uitwerken** — `services/chatRooms.ts` (kopieer `community.ts`-patroon) + echte rooms→topics→replies-UI in `ChatRoomsScreen`. Daarna tijdlijn-uitbreidingen (foto's, polls, notificaties).

### Open vragen / blockers

- Ongecommitteerde wijzigingen staan op `main` (modified: `app.json`, `package*.json`, 8 screens, `eersteHapjes.ts` service). User moet bevestigen wanneer commit + EAS-build moet gebeuren. Sessie wordt **niet** gecommit door /eind-sessie zelf.
- `assets/allergens/` is untracked — bevat de foto's die door v2.8.6 setup-card + tegels worden gebruikt. Moet meegecommit worden vóór de volgende EAS-build.
- Geen EAS preview/production build getriggerd deze sessie. Bij volgende session-start: beslissen of v2.9.1 als EAS Update kan (alleen JS-wijzigingen sinds laatste native build) of een volledige nieuwe build vereist (assets/allergens/ is nieuw, maar zijn JS-bundled assets via `require`/`ImageBackground`, dus update is voldoende mits geen native config-wijziging).

---
