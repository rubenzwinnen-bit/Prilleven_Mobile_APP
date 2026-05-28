---
description: Sluit de mobile-app sessie netjes af met handover-prompt voor de volgende chat
---

Sluit deze sessie netjes af zodat ik soepel kan verdergaan in een nieuwe chat. Voer de stappen uit in volgorde.

> Context: dit is de **Pril Leven Mobile App** (React Native / Expo). De web-app zit in een ander project (`~/Desktop/Project_weekschema_Productie/`) en heeft zijn eigen `/eind-sessie`-command. Beide projecten delen dezelfde Supabase-DB en Vercel-API, maar de versionering, build-pipeline en code zijn los.

## 1. Sync CLAUDE.md
Bekijk wat er deze sessie gewijzigd is en update `CLAUDE.md` indien nodig:
- Nieuwe screens / services / hooks / conventies → relevante sectie in `CLAUDE.md`.
- Verandering in EAS-config, app.json-permissies, of native plugins → §2 (Tech stack) of §4 (App-boot).
- Nieuwe pariteits-status met de web-app → §5 (Feature-pariteit).
- Beknopt: één regel of bullet per wijziging.

## 2. Update PLAN-TIMELINE.md
Open `PLAN-TIMELINE.md` (in de root van de mobile-app). Bestaat het bestand niet, maak het dan aan met dezelfde toon als de web-app variant (datum-secties van nieuw naar oud, bullets per dag). Voeg toe / werk bij:
- Wat is vandaag afgerond in de mobile app? (concrete bullets, met versie-bumps erbij)
- Wat is de volgende stap? (1-3 concrete acties)
- Beslissingen die vastgelegd moeten worden (bv. parity-strategie, native-only choices)
- Open vragen of blockers (bv. EAS build-fout, store-rejection)

Houd de toon en structuur van het bestaande bestand aan. Voeg een nieuwe datum-sectie toe i.p.v. inline edits in oude secties.

## 3. Check versie-consistentie
Bevestig dat `app.json` deze sessie correct gebumpt is (en niets is blijven hangen):
- `expo.version` (semver, bv. `2.9.1`)
- `expo.ios.buildNumber` (monotoon stijgend, string)
- `expo.android.versionCode` (monotoon stijgend, integer)

Vermeld de huidige drie waarden in de eindsamenvatting. Indien het een EAS Update i.p.v. een nieuwe build was, vermeld dat ook.

## 4. Genereer een handover-prompt

Print onderaan je antwoord een **kant-en-klaar blok** dat ik kan kopiëren in een nieuwe chat. Format:

```
---HANDOVER VOOR NIEUWE CHAT (MOBILE APP)---

Project: Pril Leven Mobile App (zie CLAUDE.md voor context)

Huidige versie:
- app.json version: <x.y.z>
- iOS buildNumber: <n>
- Android versionCode: <n>

Waar we mee bezig zijn:
<1-2 zinnen wat de huidige feature/bug is>

Vandaag gedaan:
- <bullet>
- <bullet>

Status:
<wat werkt, wat niet, waar het stopt, tsc/bundles status>

Pariteit met web-app:
<welke screens/flows nu in sync zijn, welke nog achterblijven>

Volgende stap:
<1 concrete actie>

Belangrijke beslissingen / context:
<zaken die niet uit code af te leiden zijn, bv. design-keuzes, EAS-config tweaks>

Begin met: <eerste concrete actie zoals "lees src/screens/X.tsx en stel Y voor">
---/HANDOVER---
```

## 5. Korte samenvatting voor mij
Sluit af met:
- Welke secties in `CLAUDE.md` je hebt aangepast (of "geen wijzigingen nodig").
- Of `PLAN-TIMELINE.md` is bijgewerkt / aangemaakt.
- Huidige `version` / `buildNumber` / `versionCode` (uit app.json).
- Of de handover-prompt klaar staat om te kopiëren.

## Wat NIET doen
- Geen nieuwe code schrijven — dit is een afsluit-command.
- Geen commit of git push (tenzij ik er expliciet om vraag).
- Geen versie-bump als er deze sessie geen functionele wijziging in `src/` was.
- Geen verzonnen "open issues" — alleen wat we deze sessie hebben aangeraakt.
- Geen EAS build of submit triggeren — enkel rapporteren wat klaar is om te builden.
