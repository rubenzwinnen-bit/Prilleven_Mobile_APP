---
description: Snel up-to-speed in een nieuwe mobile-app chat — leest status en stelt voor wat te doen
---

Help me snel verder na een chat-wissel in de **Pril Leven Mobile App**. Voer in volgorde uit:

> Context: dit is de mobile app (React Native / Expo). De web-app is een ander project. Wissel niet per ongeluk van project — alles speelt zich af in `~/Desktop/Prilleven_MOBILE_APP/`.

## 1. Lees de status
- Lees `CLAUDE.md` enkel als snelle refresh — diepe lectuur enkel als nodig voor de eerste vraag.
- Lees `PLAN-TIMELINE.md` (laatste 2-3 datum-secties) als die bestaat. Bestaat niet? Meld dat en gebruik `git log` als enige status-bron.
- Check `git status` en `git log --oneline -10` voor recente activiteit.
- Check de huidige branch (`git branch --show-current`).
- Check de huidige versies in `app.json`: `version` / `ios.buildNumber` / `android.versionCode`.

## 2. Vat samen
Geef een korte status in 5 bullets:
- **Branch:** welke branch ben ik op, en t.o.v. main: voor of achter?
- **Huidige versie:** `version`/`buildNumber`/`versionCode` uit `app.json`.
- **Laatst afgerond:** wat is volgens PLAN-TIMELINE (of git log) de laatste afgewerkte taak?
- **Volgende stap:** wat staat er als next-up in PLAN-TIMELINE (of leid het af uit recente commits)?
- **Uncommitted changes?** zijn er werk-in-uitvoering bestanden? Draait er een Metro/Expo dev-server (zie `.claude/launch.json`)?

## 3. Stel voor
Eindig met **één** concrete vraag of voorstel, bijvoorbeeld:
- "Wil je verder met [volgende stap uit PLAN]?"
- "Er staan ongecommitteerde wijzigingen in `src/screens/X.tsx` — eerst afmaken of iets anders?"
- "Branch X loopt 3 commits achter op main — eerst rebasen?"
- "Versie staat op X maar er zijn sindsdien nog commits zonder bump — eerst syncen?"

Of als ik in mijn eerste bericht al een nieuwe taak heb genoemd:
- Bevestig wat je gaat doen, vraag om verheldering als nodig, en begin pas met code-werk na mijn 'go'.

## Wat NIET doen
- Geen volledige code-review of refactor-voorstellen ongevraagd.
- Geen nieuwe features bedenken die niet in PLAN-TIMELINE / mijn bericht staan.
- Geen lange uitleg over wat het project is — `CLAUDE.md` is al geladen.
- Niet meteen code schrijven zonder bevestiging van mij.
- Niet automatisch `npx tsc` of bundle-smoke-tests draaien tot er een wijziging is — pas verifiëren na een echte edit.
- Geen wijzigingen in `app.json` versie-velden tot ik daarom vraag of er code-wijzigingen zijn die het nodig maken.
