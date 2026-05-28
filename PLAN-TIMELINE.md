# Pril Leven Mobile App — Plan & Timeline

> Zusterproject: de **web-app** (`~/Desktop/Project_weekschema_Productie/`) heeft een eigen `PLAN-TIMELINE.md`. Beide projecten delen dezelfde Supabase-DB en Vercel-API, maar versionering en build-pipeline zijn los.
>
> Datum-secties van **nieuw naar oud**. Voeg een nieuwe sectie bovenaan toe per werksessie i.p.v. inline edits in oude secties.

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

- `expo.version`: **2.9.1**
- `expo.ios.buildNumber`: **36**
- `expo.android.versionCode`: **40**

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
| Volledige readiness-checklist (multi-step wizard) | v3.0.0 | ⬜ open |
| Tijdlijn / community feed | v3.0.0 | ⬜ open |
| Chatruimtes | v3.0.0 | ⬜ open |

### Volgende stap

1. **Readiness-checklist + multi-step pause-flow modal** uitwerken in `EersteHapjesScreen` (volledige parity met website `js/components/allergenen.js` pause-wizard) — momenteel nog `⬜ open`.
2. Daarna: keuze tussen tijdlijn-MVP (`services/community.ts` + `TimelineScreen`) of chatruimtes (`services/chatRooms.ts` + `ChatRoomsScreen`).

### Open vragen / blockers

- Ongecommitteerde wijzigingen staan op `main` (modified: `app.json`, `package*.json`, 8 screens, `eersteHapjes.ts` service). User moet bevestigen wanneer commit + EAS-build moet gebeuren. Sessie wordt **niet** gecommit door /eind-sessie zelf.
- `assets/allergens/` is untracked — bevat de foto's die door v2.8.6 setup-card + tegels worden gebruikt. Moet meegecommit worden vóór de volgende EAS-build.
- Geen EAS preview/production build getriggerd deze sessie. Bij volgende session-start: beslissen of v2.9.1 als EAS Update kan (alleen JS-wijzigingen sinds laatste native build) of een volledige nieuwe build vereist (assets/allergens/ is nieuw, maar zijn JS-bundled assets via `require`/`ImageBackground`, dus update is voldoende mits geen native config-wijziging).

---
