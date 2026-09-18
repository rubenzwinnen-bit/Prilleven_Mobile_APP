# Pril Leven Mobile App — Plan & Timeline

> Zusterproject: de **web-app** (`~/Desktop/Project_weekschema_Productie/`) heeft een eigen `PLAN-TIMELINE.md`. Beide projecten delen dezelfde Supabase-DB en Vercel-API, maar versionering en build-pipeline zijn los.
>
> Datum-secties van **nieuw naar oud**. Voeg een nieuwe sectie bovenaan toe per werksessie i.p.v. inline edits in oude secties.

---

## 2026-09-18 — Laadtijden, App Store-veiligheid en release-voorbereiding

### Afgerond

- **Dev-build herinstalleerd in plaats van herbouwd.** De build van 9 september
  (`6550ca6d`) paste nog: sindsdien kwam er geen native module bij. Een dev-build vervalt
  niet — waarschijnlijk had iOS hem opgeruimd via "Ongebruikte apps verwijderen".
- **Formulieren sneller.** Dose- en symptoomformulier lazen opnieuw bij de aparte
  `/doses`- en `/state`-functions, die door de bundeling van vorige week bijna nooit meer
  geraakt werden en dus bijna altijd koud stonden (~4 s). Nu uit een overzichtscache van
  30 s die zeven mutaties wissen. Die vertraging was een bijwerking van de eigen fix.
- **Learnings**: cache, stil verversen, voorladen vanaf de landing; server-queries parallel
  (website-commit `3c4657f`).
- **Tijdlijn**: er liepen twee volledige feed-verzoeken tegelijk bij het openen
  (`useEffect` én `useFocusEffect`). Nu één, stil verversen, eenmalig voorladen.
- **Chatruimtes**: meteen tonen uit de lokale constant in plaats van een spinner; nieuwe hero.
- **App Store 3.1.3(f)**: op iOS geen enkele zin meer die zegt waar je lid wordt of koopt
  (inlogscherm, verlopen-scherm, aanraders). Commentaar bij `MAG_NAAR_CHECKOUT_LINKEN`
  verwees naar 3.1.3(b) — die vereist juist in-app aankoop; rechtgezet.
- **Profiel**: sectie Juridisch → Over Pril Leven, met een link naar prilleven.be.

### Bewust niet gedaan

- Een link naar de community-webapp vanaf het inlogscherm: dat inlogscherm heeft een
  "Word lid"-knop, en een link erheen is een koopoproep.
- De symptoomlog (lijst) leest nog bij de aparte `/symptoms`-function en kan dus koud staan.

### Volgende stap

Release 3.2.0. Nog open vóór de productiebuild: APNs-sleutel (`eas credentials`), het
monochrome notificatie-icoon voor Android, en de testmatrix — punt 1 t/m 5 (push) zijn nooit
getest, punt 12 (opzegverzoek) ook niet.

---

## 2026-09-09 (deel 3) — Gamification, sleepbeweging en gemeten traagheid

### Afgerond

- **Cooked it + Pril Ritme** (`lib/cookingProgress.ts`, `CookingRhythm`, `CookSlider`).
  Afvinken per plaats in het actieve schema, weekritme op unieke kookdagen (doel 3),
  historiek over vier weken, drie mijlpalen als toast. Opslag lokaal, zoals de web.
- **Eén baan per plaats, alleen vooruit.** Komt een recept meerdere keren voor, dan krijgt
  elke plaats een eigen slider; dagen die voorbij zijn verdwijnen. Daarvoor was er één
  slider die na het afvinken doorsprong naar de volgende plaats, waardoor de bevestiging
  nooit verscheen.
- **Sleepbeweging bruikbaar gemaakt**: de hele baan luistert (niet enkel de knop), het
  gebaar wordt in de capture-fase opgeëist zodat de ScrollView het niet afpakt, en de
  animatiewaarde wordt teruggezet na "Ongedaan maken".
- **`width` animeren kan niet op de native driver** — vervangen door `translateX`.
- **Allergenen: kind-picker vernieuwd** (hero + gekleurde initiaalbollen uit de
  family-layer), introtekst naar de info-knop.
- **Badges "NIEUW"** weg bij HapjesHeld, Learnings en Allergenen-introductie. Aanraders
  houdt de zijne.
- **PDF-viewer**: rendert nu lui (venster van 3, één render tegelijk, ver weg gerenderde
  pagina's weer leegmaken) en topt de pixelratio af op 2. Daarvoor werden álle pagina's
  vooraf gerenderd.

### Gemeten, niet gegokt

Het allergenenscherm voelde traag. Meting op het toestel (tijdelijke `__DEV__`-logs):

| call | koud | warm |
|---|---|---|
| token ophalen | 2 ms | 2 ms |
| `getChildren` | 4 ms | 1 ms |
| `getEhState` | 463 ms | 696 ms |
| `getEhSymptoms` | 678 ms | 512 ms |
| **`getEhDoses`** | **3762 ms** | 478 ms |

Het token en de kinderenlijst waren dus niet de oorzaak — mijn eerste vermoeden was fout.
Het waren **koude starts**: `state`, `doses` en `symptoms` zijn drie aparte Vercel-functions
die elk apart afkoelen, en omdat de app ze parallel aanroept kan er geen warme instantie
gedeeld worden.

Opgelost met `GET /api/eerste-hapjes/state?include=doses,symptoms` → `getEhOverview`.
Vier verzoeken werden er twee; één function die bovendien warmer blijft.
Website-commit `9c47bb2`.

Verder: `getChildren()` zit nu achter de 30 s-cache (met invalidatie bij mutaties), het
allergenenscherm wacht niet meer op de kinderenlijst voor het aan de rest begint, en beide
schermen verversen stil in plaats van leeg te knipperen.

### Correctie in de documentatie

`CLAUDE.md` beweerde dat endpoints gebundeld moesten worden wegens de Vercel Hobby-limiet
van 12 functions. Er staan er **21** gedeployed: het project draait sinds 2026-07-29 op
Vercel Pro. Bundelen blijft zinvol, maar dan wegens koude starts — dat staat nu zo in §11.

### Volgende stap

Website-deploy afwachten, dan op het toestel narekenen of de koude start echt zakt.

---

## 2026-09-09 (deel 2) — Toestel-testronde: stijl, weergaven en prestaties

**Context**: eerste sessie waarin de 3.2.0-code écht op een toestel draaide. Expo Go bleek
onbruikbaar (App Store levert enkel SDK 57, project staat op 54) en er staat geen Xcode op de
Mac, dus testen loopt voortaan via een EAS development build op de iPhone. De Apple-overeenkomst
was al goedgekeurd, waardoor die build kon.

### Opgelost onderweg

- **Metro bundelde niet.** `babel-preset-expo` zat genest onder `node_modules/expo/node_modules/`
  en was dus niet vindbaar vanaf de projectroot, waar `babel.config.js` staat. Stond al zo in de
  vastgelegde `package-lock.json`; viel nooit op omdat er lokaal nooit gebundeld werd. Opgelost
  door hem expliciet als devDependency toe te voegen — wat de Babel-foutmelding zelf voorstelt.
- **`expo-dev-client`** is door de EAS-build aan `package.json` toegevoegd.
- **Launch-profiel `mobile-dev`** toegevoegd zodat Metro met één commando in dev-client-modus start.

### Stijlronde (web-pariteit)

- **Inlogscherm**: titel, tabs, links en CTA naar `greenText`, conform `.auth-modal`.
- **Favorieten**: herbouwd naar `js/components/favorites.js` — hero met tel-tabs, panelen per tab,
  schemakaarten volgens `.saved-schedule-card`, lege staten volgens `.favorites-empty-state`.
  De knop "Bewerken" is bewust niet overgenomen: schema's bewerken bestaat niet in de app.
- **Weekschema**: sub-tabs als kaarten in de favorietenstijl (afwijking van de web), de
  genereer-tab toont `ScheduleTable` (spiegel van `renderScheduleGrid`), de actieve tab
  `ActiveDayBlocks` (spiegel van `renderActiveDays`) — net als op de website twee weergaven.
- **Landing**: hero-kaart in dezelfde stijl, volledig aanklikbaar naar het profiel. Tegels
  kregen één neutrale verdonkering; het veld `overlayColor` per tegel is geschrapt.
- **Ruimtewinst**: introblokken verhuisd naar een info-knop in de header (`InfoModal`), koppen
  geschrapt die de sub-tabs al zeggen, paginapadding verkleind.

### Favorietenvoorkeur bij het genereren

Nieuw `lib/scheduleSelection.ts`, één-op-één van `js/components/weekSchedule.js`: kans en plafond
schalen met het aantal passende favorieten (20%/2, 30%/4, 35%/7), het onderscheid vervalt onder
een niet-favoriete pool van 4, een favoriet komt hoogstens tweemaal voor, en `ensureFavoriteAppears`
forceert er één als alle kansen misten. `preferFavorites` wordt in het schema bewaard.

### Prestaties

- **Chatruimte-badges naar de server** (grootste winst). De app deed per telronde `listRooms()` +
  `getRoom()` per ruimte + `getTopic()` per recent actief topic: vijf tot twintig verzoeken, elke
  minuut. `countChatroomBadge` bestond al server-side voor de push-badge; die geeft nu
  `{ total, perRoom, perTopic }` en de route `app-badges` geeft `{ timeline, chatrooms }`.
  Eén verzoek per telronde. `services/notifications.ts` ging van 184 naar 62 regels, en de
  `getIsAdmin`-call bij het inloggen verviel omdat de server de telregel zelf toepast.
  **Website-commit `d8e84a7`; moet gedeployed zijn voor de app-kant zin heeft.**
- **Poll van 60 naar 180 seconden**, en terugkeren naar de voorgrond ververst hoogstens eens per
  30 seconden in plaats van bij elke wissel.
- **Lijstinstellingen** (`initialNumToRender`, `maxToRenderPerBatch`, `windowSize`,
  `removeClippedSubviews`) op zes lijstschermen; die stonden nergens ingesteld.
- **Receptenlijst versmald**: `getRecipes()` haalt geen ingrediënten en bereidingsstappen meer op.
  Daarom vult die functie de per-recept-cache niet meer — anders kreeg de boodschappenlijst een
  recept zonder ingrediënten.

### Bewust niet gedaan

- **`expo-image`** (schijfcache voor foto's): native module, dus de dev-build op het toestel zou
  breken tot er een nieuwe build is. Hoort in dezelfde ronde als de volgende build.
- **De acht require-cycles** in de navigatielaag: veel bestanden, kans op stukke navigatie, minste
  zichtbare winst. Slecht moment vlak voor een release.

### Volgende stap

1. Website deployen (commit `d8e84a7`), anders staan de chatruimtebadges op nul.
2. Verder met de testmatrix; punt 1 t/m 5 (push) vraagt nog een `preview`-build.

---

## 2026-09-09 — Web-pariteit ronde 4: acht blokken in één release (3.1.1 → 3.2.0)

**Context**: de web-app liep op zeven punten voor. Ruben vroeg om die op te zoeken in de
web-code en er een plan van te maken; dat werd `PLAN-MOBILE-3.2.md` met acht blokken (het
achtste — de inlogzone — kwam er tijdens het opzoekwerk bij). Alle acht zijn deze sessie
geprogrammeerd. De push-server-kant is op 2026-09-02 al naar productie gegaan.

### Afgerond deze sessie

- **Blok 1 — app-icoon-push afgemaakt.** `services/push.ts` uitgebreid met tik-afhandeling
  (`addPushResponseListener` + `getInitialPushResponse`) en een nieuw
  `navigation/pushRouting.tsx` met `navigationRef` + `<PushRouter/>`: een tik opent de
  Tijdlijn of rechtstreeks het juiste ChatTopic. `handledIds` voorkomt dubbel navigeren na
  een koude start; `initial: false` houdt RoomList onder ChatTopic zodat de terugknop in de
  tab blijft.
  **Website-kant (gedeployed naar productie, commits `6463c82` + `a5fb38a`)**: de server
  stuurde enkel title/body/badge, dus er viel niets te routeren. `notifyNewActivity` hangt nu
  `data: { kind, topicId?, postId?, roomSlug?, roomTitle? }` aan elk Expo-bericht.
- **Blok 8 — toegangscontrole op het lidmaatschap.** De app controleerde dit NERGENS:
  `allowed_users` werd enkel bij registratie geraadpleegd, dus een verlopen lid hield
  onbeperkt toegang. Nieuw: `services/subscription.ts`, `lib/useSubscriptionGate.ts`
  (login + 60 s-poll + AppState), `screens/SubscriptionExpiredScreen.tsx`,
  `constants/links.ts`. Registratiefout gesplitst in "je hebt al een account" vs. "dit adres
  is bij ons niet bekend".
- **Blok 5 — merkgroen `#4F7D6C`.** `greenText`/`greenDark` in `theme.ts`; 73 vervangingen
  over 22 bestanden, plus de lichte `rgba(152,195,164,α)`-vlakken, volgknoppen, genereerknop,
  leeftijd-badge en de HapjesHeld-landingstegel.
- **Blok 6 — weekschema-tabs.** Groene subtab-onderlijn, segmented dagkiezer, lage
  `activeToolbar`, dagblokken met rondlopende groene rand en groene VANDAAG-badge.
- **Blok 7 — allergenen.** `AllergenPathCard` vervangt drie losse blokken (Hoeveelheden,
  Volgende stap, arts-toezicht). `SafetyBar` met twee niveaus i.p.v. één. Segmentklik opent
  de tegel en scrolt ernaartoe.
- **Blok 3 — abonnement opzeggen** vanuit het profiel (`getOpzegverzoek` /
  `createOpzegverzoek` + rij "Lidmaatschap").
- **Blok 2 — Aanraders native.** `services/aanraders.ts` leest de drie `affiliate_*`-tabellen
  Supabase-direct; `AanradersScreen` + `AanraderProductScreen` + gedeelde `AanraderKaart`;
  vijfde landingstegel. `expo-clipboard` toegevoegd voor het kopiëren van kortingscodes.
- **Blok 4 — gamification, fase C.** Mijn leertraject: statusbadges Nieuw/Bezig/Afgerond,
  "X afgerond · Y bezig", "Ga verder met…", en een afrondbalk in zowel het detailscherm als
  de pdf-viewer.
- **Release-voorbereiding.** `app.json` naar `3.2.0`; patch-versies van `expo`,
  `expo-constants`, `expo-file-system` en `expo-font` bij → `expo-doctor` 18/18.
- **Firebase/FCM opgezet** (project `prilleven-d2186`): Android-app geregistreerd,
  `google-services.json` in de root + `android.googleServicesFile` in `app.json`,
  FCM-service-account geüpload naar EAS. Android preview-build geslaagd
  (`5a56a851-fc2b-4f39-82e2-bf20509b026a`) — enkel als configuratiecheck.

### Beslissingen

- **Checkout-links: optie A, platform-afhankelijk.** Het lidmaatschap is een digitale dienst;
  App Store 3.1.1 verbiedt een call-to-action naar een andere aankoopmethode. Op iOS dus geen
  knop en geen domein, enkel een neutrale zin over "de webversie"; op Android de echte link.
  Schakelaar + motivering in `constants/links.ts` (`MAG_NAAR_CHECKOUT_LINKEN`).
  Diezelfde regel geldt bij Aanraders: `magKoopknopTonen()` verbergt op iOS de koopknop bij
  Pril Levens eigen Plug&Pay-producten (masterclass, roadmap). De kaart blijft staan.
- **Aanraders wordt native, geen WebView.** De RLS staat anon-lezen toe, dus geen
  website-endpoint nodig. Een WebView zou bovendien de "Lid worden"-knop uit de paginaheader
  meebrengen, precies wat op iOS niet mag.
- **Gamification: optie C.** Allergenenpad en leertraject nu; Cooked it / Pril Ritme en de
  HapjesHeld-"Dit helpt mij" wachten op de cross-device Supabase-basis (fase 3 van het
  gamificatieplan). Niet bouwen op de localStorage-preview.
- **Testen pas op het einde, in één build.** Blok 2 t/m 8 zijn puur JS, dus een dev-build per
  blok levert niets op. Gevolg: de pushtest schuift mee naar het einde.
- **Eén release i.p.v. zes.** De versies 3.2.0 t/m 3.7.0 uit het plan zijn nooit apart
  gebouwd; alles is genormaliseerd naar `v3.2.0`, ook in de CLAUDE.md-annotaties.

### Afwijkingen t.o.v. web (bewust)

- **Geen categoriescherm** bij Aanraders (`/aanraders/c/<slug>`): dat bestaat op de web vooral
  voor Google; de categoriefilter doet in de app hetzelfde zonder extra navigatie.
- **Afronden van een learning is een knop met undo**, niet de schuifbeweging van de web. Op
  een telefoon even bewust en voorspelbaarder.
- De stoplicht-tinten in `SymptomFormScreen` (`#e8f3ec`/`#fdf3cf`/`#f7e3df`) blijven staan:
  dat is een op elkaar afgestemd trio pale wassingen, alleen de groene omzetten breekt de set.

### Status

- `npx tsc --noEmit` groen. `expo-doctor` 18/18.
- **11 commits lokaal op `main`, niets gepusht** — bewust, zodat er na de eerste build nog
  vrij herschikt kan worden. `2f68625` t/m `c6b81ad`.
- De website-kant van de push-payload staat **wel** live op productie.
- **Niets van blok 2 t/m 8 heeft ooit op een toestel gedraaid.** Typecheck zegt niets over
  lay-out of scrollgedrag; `AllergenPathCard` en het Aanraders-overzicht zijn blind gebouwd op
  basis van de web-CSS en zullen bijstelling vragen.

### Blockers

- ~~**Apple Program License Agreement is niet geaccepteerd.**~~ **Opgelost op 2026-09-09**:
  Ruben heeft de overeenkomst goedgekeurd, iOS-builds kunnen weer ondertekend worden.
- **Testen kan niet meer via Expo Go.** De App Store levert enkel de nieuwste Expo Go (SDK 57)
  en het project staat op SDK 54; een oudere Expo Go bijzetten kan niet op iOS. Er staat ook
  geen Xcode op de Mac (`xcode-select` wijst naar de Command Line Tools, `simctl` geeft nul
  toestellen), dus de simulator is evenmin een uitweg. Testen loopt daarom voortaan via een
  EAS-build op het toestel — die bouwt in de cloud, dus Xcode is niet nodig. Een SDK-upgrade
  naar 57 is bewust NIET nu gedaan: ze haalt de release-blokkade niet weg, push blijft ook in
  Expo Go ontestbaar, en ze zou de nooit-op-toestel-gedraaide blokken 2 t/m 8 met een tweede
  onbekende vermengen. Eigen project, ná deze release.
- **Geen Android-toestel beschikbaar** (Ruben heeft enkel een iPhone). Android push blijft
  ongetest tot iemand met een Android-telefoon meekijkt — regelen vóór de store-release.
- **Notificatie-icoon** staat nog op het kleurenlogo (`adaptive-icon.png`); Android vereist
  wit-op-transparant, anders een witte vlek in de statusbalk. Vraagt een asset van Anneleen.

### Volgende stap

1. ✅ PLA geaccepteerd. iPhone geregistreerd voor internal distribution
   (`eas device:create`; Apple-team `MTXU526TZL`).
2. **`eas build --platform ios --profile development`** → dev-client op de iPhone, met hot
   reload. Daarmee punt 6 t/m 13 van de testmatrix aflopen en de blind gebouwde schermen
   (`AllergenPathCard`, Aanraders) bijstellen.
3. Daarna `eas build --platform ios --profile preview` voor punt 1 t/m 5 (push, tik-routing,
   icoonbadge). Push werkt niet in de dev-build: `aps-environment` staat hard op `production`
   terwijl een dev-build de APNs-sandbox gebruikt.
4. APNs-sleutel aanmaken via `eas credentials --platform ios` (kan nu de PLA rond is).
5. `eas build --platform ios --profile production` + `eas submit`; de door `autoIncrement`
   gebumpte build-nummers daarna committen.

---

## 2026-06-04 (deel 2) — Leeftijd-badge + multi-select leeftijdsfilter (web-parity 3.1.0→3.1.3)

**Context**: De web-app kreeg tussen 3.1.0 en 3.1.3 een leeftijdscategorie-badge op recepten + een multi-select leeftijdsfilter (web-commits `9623ed0`, `91c5d4c`, `afd9885`, merge `63e81f6`). Deze sessie neemt die feature 1-op-1 over in de mobiele app.

### Afgerond deze sessie

- **`src/lib/familyLayer.ts`** — twee dunne helpers toegevoegd, identiek aan web `js/utils.js`. Hergebruiken de bestaande `getRecipeMinAge` + `MEAL_MOMENT_MIN_AGE` (ochtend 9, fruit moment 7, middag 6, snack 10, avond 6 — géén nieuwe databron):
  - `getRecipeAgeLabel(recipe): string | null` → `"vanaf X mnd"` (null als leeftijd onbekend).
  - `AGE_FILTER_OPTIONS: number[]` → unieke eetmoment-minima, oplopend (`[6, 7, 9, 10]`).
- **`src/components/RecipeCard.tsx`** — leeftijd-badge (klein groen pill-ovaal `rgba(152,195,164,0.25)` / `#4a7c59`, "vanaf X mnd") in een nieuwe `titleRow` (titel `flex:1` + badge `flexShrink:0`, `space-between`). Geen badge bij onbekende leeftijd. Verschijnt overal waar `RecipeCard` gerenderd wordt (recepten-overzicht + favorieten).
- **`src/screens/RecipeDetailScreen.tsx`** — grotere badge-variant rechts naast de "Informatie"-titel (`sectionTitleRow` draagt nu de onderlijn; `sectionTitleInRow` strip't border/margin van de titel-`Text`). Import `getRecipeAgeLabel`.
- **`src/screens/RecipeListScreen.tsx`** — multi-select leeftijdsfilter: nieuwe state `ageFilter: number[]` + `toggleAge`, derde chip-rij in het bestaande inklapbare filterpanel ("Alle leeftijden" reset + pill per `AGE_FILTER_OPTIONS`). Filterlogica: recept zichtbaar als `getRecipeMinAge(r)` in de selectie zit (OF-logica, parity met web). `filtersActive` telt de leeftijdsfilter mee (filter-dot op de toolbar-knop).

### Afwijking t.o.v. web (bewust)

- De web-toolbar toont de leeftijdsfilter altijd; mobiel zit hij in het bestaande inklapbare filterpanel naast eetmoment + allergenen (mobiele UI-conventie). Functioneel identiek.
- Badge-styling via inline groen `#4a7c59` (zelfde kleur als de bestaande momenttags) i.p.v. een nieuw theme-token — consistent met de al aanwezige tags in RecipeCard/RecipeDetail.

### Status

- `npx tsc --noEmit` groen.
- **Ongecommit** (samen met de eerdere RecipeDetailScreen-allergeenfix uit deel 1): `src/lib/familyLayer.ts`, `src/components/RecipeCard.tsx`, `src/screens/RecipeListScreen.tsx`, `src/screens/RecipeDetailScreen.tsx`, `CLAUDE.md`, `PLAN-TIMELINE.md`.

### Versie

`app.json.version` **3.1.0** · `ios.buildNumber` **66** · `android.versionCode` **72** — **niet** gebumpt deze sessie (alleen JS/UI-wijzigingen). Beslis bij commit/build of dit als nieuwe build 3.1.0 meelift dan wel een aparte patch (3.1.1) wordt, samen met de eerder ongecommitte RecipeDetailScreen-allergeenfix.

### Volgende stap

1. Visueel checken op toestel/Expo (badge op kaart + detail, filter-pills).
2. Committen samen met de openstaande wijzigingen.
3. Beslissen over version-bump + nieuwe EAS-build.

---

## 2026-06-04 — v3.1.0 release-build + submit & allergeen-legacy-namen opgeschoond

**Context**: v3.1.0 (per-topic notificatiebadges + 6-weken vervaltermijn + family-layer in receptdetail, code reeds in `src/` via commit `3cf6232`) klaargezet voor de stores. Daarna een datakwaliteits-issue aangepakt: in recepten verschenen nog oude allergeen-namen (gluten/lactose/ei) i.p.v. de canonieke keys (tarwe/koemelk/kippen-ei).

### Afgerond deze sessie

- **v3.1.0 release-builds** (EAS production, `--non-interactive --no-wait`):
  - iOS **buildNumber 66** (build-ID `88d4ad9c-…`) → **gesubmit naar App Store Connect** (`eas submit --platform ios`); binary geüpload, verwerkt door Apple → TestFlight.
  - Android **versionCode 71** geannuleerd (te lang in wachtrij) → herbouwd als **versionCode 72** (build-ID `7cb3fdf3-…`).
  - EAS write-back van build-nummers gecommit: `1bb7176` (iOS 66 / Android 71) + `3cf9c97` (Android 72). Eerder ook `72415c4` (emoji-iconen weg + EersteHapjes uitgeschakeld-stage).
- **Allergeen-legacy-namen — diagnose**: Supabase `recipes.allergens` is **jsonb** (geen `text[]`). 82 recepten, 64 met allergenen; legacy-waarden aanwezig: gluten(5), lactose(4), ei(2). Family-layer (`src/lib/familyLayer.ts`) normaliseerde al correct, maar `RecipeDetailScreen` toonde de rauwe DB-waarde. Web-import (`importRecipes.js`) normaliseert óók al correct; enkel de CSV-template-voorbeelden toonden legacy-namen.
- **SQL-correctie** (jsonb): `UPDATE recipes` met `jsonb_array_elements_text` + `jsonb_agg(DISTINCT …)` + `CASE` (gluten→tarwe, lactose/melk/zuivel→koemelk, ei→kippen-ei), `WHERE EXISTS`-filter. Preview (Stap 1) door gebruiker bevestigd correct. **UPDATE (Stap 2) nog door gebruiker uit te voeren.**
- **Mobiel — `RecipeListScreen.tsx` multi-select filter** (commit `72415c4`): `momentFilter`/`allergenFilter` van één waarde → `string[]`. Meerdere eetmomenten (any-of) en meerdere allergenen (wegfilteren bij minstens één) tegelijk. Allergeen-chips uit de canonieke **9** `KNOWN_ALLERGEN_OPTIONS` (i.p.v. 13 legacy `ALLERGENS`), recept-allergenen genormaliseerd via `normalizeAllergen`. `tsc` groen.
- **Mobiel — `RecipeDetailScreen.tsx`**: allergenen-tags tonen nu `getAllergenLabel(normalizeAllergen(a))` met `Set`-dedupe i.p.v. rauwe waarde. (Ongecommit.)
- **Web-project (ander project)** — `js/components/importRecipes.js`: drie legacy CSV-template-voorbeelden gecorrigeerd (regel 120 `gluten, lactose`→`tarwe, koemelk`; regel 154 `gluten, ei, lactose`→`tarwe, kippen-ei, koemelk`; regel 156 `gluten`→`tarwe`). (Ongecommit, aparte repo.)

### Status

- `npx tsc --noEmit` groen (exit 0).
- Git (mobile): commits t/m `3cf9c97` gepusht. **Ongecommit**: `src/screens/RecipeDetailScreen.tsx` + `CLAUDE.md` + `PLAN-TIMELINE.md`.
- Git (web): `js/components/importRecipes.js` ongecommit in `~/Desktop/Project_weekschema_Productie/`.
- iOS-build 66 staat in App Store Connect/TestFlight (verwerking). Android-build 72 status na herbouw nog te bevestigen + nog te submitten naar Play.

### Versie

`app.json.version` **3.1.0** · `ios.buildNumber` **66** · `android.versionCode` **72**. Nieuwe **builds** (geen EAS Update).
> NB: de RecipeDetailScreen-weergavefix is een kleine functionele wijziging ná de 3.1.0-build. Niet gebumpt — beslis of dit meelift in een volgende build of een aparte patch (3.1.1) wordt.

### Volgende stap

1. **Supabase**: de UPDATE (Stap 2) uitvoeren om de 9 recepten met legacy-allergenen te migreren; daarna verificatie-SELECT (0 rijen).
2. De drie ongecommitte wijzigingen committen (mobile: RecipeDetailScreen + docs; web: importRecipes.js — aparte repo's, aparte commits).
3. **Android**: build 72-status bevestigen → `eas submit --platform android`.
4. **iOS**: bevestigen dat build 66 in TestFlight zichtbaar is; indien gewenst indienen voor App Store-review.

### Open vragen / blockers

- Beslissing: telt de RecipeDetailScreen-allergeenfix mee in een nieuwe build (rebuild 3.1.0) of wordt het 3.1.1?
- Android-submit-rechten (Play Console service-account) — was een eerdere blocker; bevestigen of opgelost.

---

## 2026-05-30 (deel 2) — UGC-moderatie: rapporteren + blokkeren (v3.0.1 → v3.0.2)

**Context**: De App Store-review wees v3.0.x af op **Guideline 1.2** (user-generated content vereist een report-mechanisme én gebruiker-blokkeren). Deze sessie heeft report + block over beide projecten afgewerkt en de release-build voor herindiening gebouwd. Eén-richting-blok-model: de blocker ziet de geblokkeerde niet meer; de geblokkeerde merkt niets.

### Afgerond deze sessie

- **Mobiele app — moderatie (v3.0.1)**:
  - **`src/lib/moderation.ts`** (nieuw) — gedeeld `openModerationMenu` (native `Alert`): *Rapporteren* + *Gebruiker blokkeren* (met bevestig-alert), toast-feedback.
  - **`TimelineScreen.tsx`** — `more-horizontal` (···)-knop op posts/replies van anderen → moderatie-menu (`reportCommunityTarget` + `blockUser`, content lokaal uit feed). Niet op eigen content.
  - **`ChatTopicScreen.tsx`** — vlaggetje-knop "Rapporteren / blokkeren" op topics/replies van anderen (`reportChatTarget` + gedeelde `blockUser`).
  - **`ProfileScreen.tsx`** — nieuwe sectie **Geblokkeerde gebruikers** (lazy `listBlocks`, Deblokkeren → `unblockUser`).
  - **`services/community.ts`** — `reportCommunityTarget`, `BlockedUser`, `listBlocks`/`blockUser`/`unblockUser` (uniek genoeg → wél via barrel).
  - **`services/chatRooms.ts`** — `reportChatTarget` (blok hergebruikt `community.blockUser`, één `user_blocks`-tabel).
  - **`metro.config.js`** (nieuw) — standaard Expo default-config.
- **Web-project (ander project, `~/Desktop/Project_weekschema_Productie/`)** — report+block backend al eerder; deze sessie: frontend (tijdlijn/chatruimtes report+block, profiel "Geblokkeerde gebruikers"), admin-dashboard meldingen-queue voor chatruimtes (`admin-chat.html` + `admin-chat.js`). Alles gemerged naar `main` (web commit `640d573`).
- **v3.0.2 — versie-bump** voor herindiening (v3.0.1 lag al in de stores → nieuwe versie-string vereist).
- **EAS production-build** voor iOS + Android gedraaid (`--platform all`). autoIncrement schreef build-nummers terug: **iOS 65 / Android 70** (ongecommit in `app.json`).

### Status

- `npx tsc --noEmit` groen.
- Git: commits `b0cd0c4` (v3.0.1 moderatie) + `0d82446` (v3.0.2 bump) gepusht naar `main`. **Ongecommit**: `app.json` build-nummers 64→65 / 69→70 (EAS write-back; bewust niet gecommit in deze afsluit-sessie).
- **Android submit faalde** met "service account missing permissions" — Play Console-rechten-issue (geen code-fout). iOS-submission-status nog te bevestigen.
- App Store Connect: demo-account zit er al in; review-notes-tekst herschreven (incl. exacte report/block-locaties); Age Rating-vragenlijst: **UGC = YES** correct, **Advertising moet NO** (stond op YES).

### Versie

`app.json.version` **3.0.2** · `ios.buildNumber` **65** · `android.versionCode` **70** (build-nummers ongecommit, EAS write-back). Nieuwe **builds** (geen EAS Update).

### Volgende stap

1. **Google Play**: service-account rechten geven in Play Console (Users and permissions → release-rechten op be.prilleven.mobileapp), daarna `eas submit --platform android --latest` opnieuw.
2. **iOS**: bevestigen dat de build in TestFlight staat; review-notes + Age Rating (Advertising→NO) afronden; indienen voor review.
3. Zorg dat er bij review minstens één post van een ánder lid zichtbaar is (report/block-knop staat nooit op eigen content).

### Open vragen / blockers

- Play Console service-account-rechten (blokkeert Android-submit).
- iOS-submission-uitkomst nog onbekend.
- `app.json` build-nummer-write-back (65/70) staat ongecommit — volgende sessie committen of laten overschrijven door de volgende build.

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
