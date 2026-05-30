# CLAUDE.md — Pril Leven Mobile App

Lees dit ALTIJD eerst voordat je code wijzigt. Dit document is geschreven op basis van een volledige lezing van de codebase op `v2.6.0` en bijgewerkt t/m `v3.0.0`. Toekomstige Claude-sessies moeten dit bijwerken zodra de waarheid afwijkt.

> Zusterproject: de **web-app** in `~/Desktop/Project_weekschema_Productie/` heeft een eigen, uitgebreide `CLAUDE.md` per laag (root, `/js`, `/api`, `/supabase-migrations`). De mobiele app deelt **dezelfde Supabase-database en dezelfde Vercel-API** als de web-app — niet duplicaten.

---

## 1. Project in 1 alinea

**Pril Leven Mobile** is de native (iOS + Android) variant van `community-web.prilleven.be`. Zelfde Supabase-DB, zelfde Vercel-functions als backend — geen aparte server. Doel: stap voor stap optrekken naar feature-pariteit met web v3.x. Doelgroep: Nederlandstalig (Vlaanderen). Toegang via Supabase Auth + `allowed_users`-whitelist (gevuld door Plug&Pay-webhook aan de web-zijde).

---

## 2. Tech stack

| Onderdeel | Versie / keuze |
|---|---|
| React Native | `0.81.5` |
| Expo | `~54.0.34` (managed workflow, **`newArchEnabled: true`** sinds v2.19.0) |
| TypeScript | `~5.9.2`, `"strict": true` (zie `tsconfig.json`, extends `expo/tsconfig.base`) |
| Navigatie | `@react-navigation/native` v7 + `native-stack` + `bottom-tabs` |
| State | React Context (geen Redux/Zustand) |
| Persistentie | `@react-native-async-storage/async-storage` |
| DB + Auth | `@supabase/supabase-js` 2.45 → project `ynrdoxukevhzupjvcjuw` |
| RAG-chat / community / chatruimtes / profiel | Vercel functions op `https://community-web.prilleven.be` |
| Icons | `@expo/vector-icons` (Feather) + `react-native-svg` |
| Image | `expo-image-picker` + `expo-image-manipulator` |
| File/share (GDPR-export) | `expo-file-system` (~19) `File`/`Paths` API + `expo-sharing` |
| Learnings-viewer | `react-native-webview` (blog-HTML + eigen PDF.js-viewer) + `expo-video` (video) |
| Tegels herordenen | `react-native-draggable-flatlist` `^4.0.3` + `react-native-reanimated` **`4.1.1`** (exact) + `react-native-worklets` **`0.5.1`** (exact) + `react-native-gesture-handler` `~2.28.0` |
| Build/release | EAS, project-id `996391c7-00d0-4d2e-8113-fa3f9b79e0a9`, owner `prilleven` |
| iOS bundle | `be.prilleven.mobileapp`, ascAppId `6762270908`, buildNumber `63` (v3.0.0) |
| Android pkg | `be.prilleven.mobileapp`, versionCode `67` (v3.0.0) |

Node ≥ 20 lokaal voor Expo CLI.

> **New Architecture (v2.19.0).** De app draait op de **New Architecture** (`newArchEnabled: true` in `app.json`). Vereist omdat **reanimated 4 enkel op New Arch werkt** (Old-Arch-support is geschrapt). Expo Go SDK 54 draait sowieso al op New Arch. Bij twijfel altijd via een **EAS dev/preview-build** valideren, niet enkel Expo Go.
>
> **Reanimated/worklets-versies zijn exact gepind (v2.19.0).** Expo Go SDK 54 bevat de **native** modules `react-native-reanimated ~4.1.1` + `react-native-worklets 0.5.1`. De JS-kant MOET hiermee overeenkomen, anders crasht de app bij opstarten met `Exception in HostFunction: NativeWorklets`. Daarom staan ze met exacte versie in `package.json` (`4.1.1` / `0.5.1`). **Niet** upgraden zonder de Expo `bundledNativeModules.json` te checken (`expo install --check` ziet de transitieve worklets-mismatch NIET).
>
> **`babel.config.js` is verplicht.** Reanimated 4 splitst worklets af in `react-native-worklets`; de babel-plugin wordt **niet** automatisch door `babel-preset-expo` toegevoegd. Het project heeft daarom een `babel.config.js` met `plugins: ['react-native-worklets/plugin']` (als laatste plugin). Na babel- of versiewijzigingen: Metro starten met cache-clear (`npx expo start -c`).

---

## 3. Mappenstructuur (concreet)

```
/
├── App.tsx                          provider-boom + AppGate (zie §4)
├── index.ts                         expo entry
├── app.json                         expo config (version 2.19.0, newArchEnabled true, permissions in NL)
├── eas.json                         EAS profielen (development/preview/production)
├── tsconfig.json                    strict, extends expo/tsconfig.base
├── package.json                     dependencies
├── google-service-account.json      Play-credentials (gitignore!)
├── assets/                          icon, adaptive-icon, splash, prilleven-logo,
│                                    landing-recepten.jpeg, landing-hapjesheld.png,
│                                    landing-allergenen.png, landing-learnings.png
├── docs/                            ANDROID-BUILD-GUIDE.md, APPLE-BUILD-GUIDE.md
├── fotos/                           bron-fotos
├── supabase/                        optionele mirror van migrations (read-only)
└── src/
    ├── screens/                     1 bestand per scherm (§5)
    ├── components/                  Toast, RecipeCard, Stars, IngredientTile,
    │                                TabIcons, UsernameHeader, UsernameModal,
    │                                HealthDisclaimerModal, AvatarButton
    ├── navigation/                  RootStack, LandingTabs (footer 3 tabs),
    │                                MainTabs (index.tsx), RecipesStack,
    │                                ScheduleStack, FavoritesStack,
    │                                HapjesHeldStack, types.ts
    ├── services/                    data-laag (Supabase + Vercel) — alle exports
    │                                via services/index.ts barrel
    ├── context/                     UserContext, NotificationContext, ShoppingListContext
    ├── lib/                         supabase.ts (singleton client)
    ├── constants/                   theme, data, ingredientIcons
    └── types/                       index.ts (Recipe, Schedule, Comment, ...)
```

---

## 4. Provider-boom & navigatiestructuur

### 4.1 Providers (volgorde is bewust)

```
GestureHandlerRootView      (outermost, vereist voor draggable-flatlist)
  └── SafeAreaProvider
        └── ToastProvider          (useToast() overal beschikbaar)
              └── UserProvider     (Supabase sessie + AsyncStorage email)
                    └── NotificationProvider   (admin-post badges, poll 60s)
                          └── ShoppingListProvider
                                └── AppGate
                                ├── ActivityIndicator        (loading sessie)
                                ├── AuthScreen               (geen sessie)
                                └── NavigationContainer
                                      └── RootStackNavigator (ingelogd)
```

`AppGate` leest `useUser().loading` en wisselt automatisch zodra `onAuthStateChange` triggert.

### 4.2 Navigatie-tree (huidige stand v2.10.0)

```
RootStack  (native-stack, vaak headerless of CompactHeader inline)
├── Landing → LandingTabs (bottom-tabs)  src/navigation/LandingTabs.tsx — footer 3 tabs:
│   ├── Functies     → LandingScreen      (de module-tegels)
│   ├── Tijdlijn     → TimelineScreen     (community-feed)
│   └── Chatruimtes  → ChatRoomsStack     src/navigation/ChatRoomsStack.tsx
│                       (RoomList → ChatRoom → ChatTopic → ChatTopicForm)
├── Main → MainTabs (bottom-tabs)        src/navigation/index.tsx
│   ├── Recepten         → RecipesStack    (RecipeList → RecipeDetail)
│   ├── Weekschema       → ScheduleStack   (WeekSchedule → ShoppingList → RecipeDetail)
│   ├── Favorieten       → FavoritesStack  (FavoritesList → RecipeDetail / ShoppingList)
│   └── Boodschappenlijst → ShoppingListTabScreen   (geen sub-stack)
├── HapjesHeld → HapjesHeldStack        (Conversations → Chat)
├── Profile                              src/screens/ProfileScreen.tsx  (geopend via AvatarButton in Landing-header)
├── Children                             src/screens/ChildrenScreen.tsx
├── ChildForm                            src/screens/ChildFormScreen.tsx
├── Memories                             src/screens/MemoriesScreen.tsx
├── AllergenenChildren                   src/screens/AllergenenChildrenScreen.tsx
├── EersteHapjes                         src/screens/EersteHapjesScreen.tsx
├── DoseForm                             src/screens/DoseFormScreen.tsx
├── SymptomLog                           src/screens/SymptomLogScreen.tsx
├── SymptomForm                          src/screens/SymptomFormScreen.tsx
├── Learnings                            src/screens/LearningsScreen.tsx
└── LearningDetail                       src/screens/LearningDetailScreen.tsx
```

Types: `src/navigation/types.ts` — `RootStackParamList`, `LandingTabParamList`, `MainTabParamList`, `RecipesStackParamList`, `ScheduleStackParamList`, `FavoritesStackParamList`, `HapjesHeldStackParamList`.

**NB v2.10.0**: het `Landing`-route in `RootStackParamList` is nu `NavigatorScreenParams<LandingTabParamList> | undefined`. `LandingScreen` is daardoor een tab-screen binnen `LandingTabs` en gebruikt `CompositeScreenProps` (BottomTab + RootStack) om naar root-siblings te navigeren. Diepere schermen (Main, HapjesHeld, ...) worden bovenop de tabs gepusht en bedekken de footer.

### 4.3 Header-bouwstenen (in `src/navigation/RootStack.tsx`)

| Export | Doel |
|---|---|
| `HEADER_CONTENT_HEIGHT = 42` | hoogte van de inline screen-headers (RecipeList, etc.) |
| `<ChevronBack onPress />` | terug-pijl met primary-kleur (`<` icoon) |
| `<HomeIconButton onPress />` | sage-circle met Feather `home` (rechts in HapjesHeld-chat) |
| `<CompactHeader onBack onHome? />` | volle header met ChevronBack + optioneel HomeIconButton |
| `<MainHeader />` | logo + tab-titel voor MainTabs |
| `useResetMainHeader(levelsUp)` | helper om twee niveaus omhoog terug naar Landing te gaan |

**Patroon "ga naar Landing":** vanuit een stack-screen binnen MainTabs:
```ts
navigation.getParent()?.getParent()?.goBack();
```

---

## 5. Schermen (huidige stand v2.9.1)

| Bestand | Belangrijkste functies |
|---|---|
| `AuthScreen.tsx` | 3 tabs (login/register/reset). Whitelist-check vóór signup. Logo + sage/primary kleuren. **Store-compliance (v2.20.0)**: consent-zin op de register-tab ("Door een account aan te maken ga je akkoord met onze gebruiksvoorwaarden en privacybeleid", tappable `Text`-links) + altijd-zichtbare juridische footer (Privacybeleid · Gebruiksvoorwaarden) onder de card. Constants `PRIVACY_URL`/`TERMS_URL` → `Linking.openURL`. |
| `LandingScreen.tsx` | 4 grote tegels (`DraggableTile`), **alleen titel, tekst links-midden** (`tileBg` `justifyContent:'center'`, v2.18.0). Standaard-volgorde: Receptenboek & Weekschema → HapjesHeld 2.0 → Learnings → Allergenen-introductie. **Herordenen (v2.18.0)**: `react-native-draggable-flatlist` + `react-native-reanimated`. Lang drukken op een tegel → `editing`-modus: alle tegels wiebelen (reanimated `withRepeat`/`withSequence` rotatie ±1.3°), elke tegel toont een `move`-handle, en de actieve tegel schaalt 1.04. Sleep → `onDragEnd` → `persistOrder` slaat de key-volgorde op in AsyncStorage `receptenboek_landing_tile_order_<email>`. "Klaar"-knop verlaat edit-modus. In edit-modus navigeert tappen niet. `applyOrder(order)` herschikt `TILES` op opgeslagen keys (onbekende achteraan). + `AvatarButton` rechtsboven → `Profile`. `useFocusEffect` refresht `community avatar_url`. `navigateFor(key)`: Main / HapjesHeld / Learnings / AllergenenChildren. |
| `ProfileScreen.tsx` | 6 secties: **Account** (e-mail + uitloggen), **Community** (nickname-input met regex-validatie + Opslaan-knop, avatar-blok met `AvatarButton`-preview + "Foto kiezen/wijzigen/Verwijderen", upload-pipeline: `expo-image-picker` → `expo-image-manipulator` resize 512px JPEG q=0.8 → signed Storage URL → `PUT /api/community/profile { avatar_path }`), **Mijn kinderen** (knop → `ChildrenScreen`), **Dieet in het gezin** (9 chips uit `DIET_OPTIONS`, optimistic toggle met 400ms debounce + saveInFlight-ref + pending-queue, status-pill saving/saved/error, flush-on-unmount; vereist bestaand community-profile anders inline hint), **Voorkeuren & privacy** (HapjesHeld memory-toggle via `Switch`, optimistic + rollback, plus knop "Bekijk opgeslagen geheugen →" naar `MemoriesScreen`), **Mijn gegevens** (GDPR-export via `File`/`Paths` + `Sharing.shareAsync`, GDPR-delete via 2-staps modal met `VERWIJDER`-bevestiging), **Juridisch** (v2.20.0 — Privacybeleid + Gebruiksvoorwaarden, elk `Linking.openURL` naar `PRIVACY_URL`/`TERMS_URL` op `community-web.prilleven.be`). Header: `ChevronBack` + titel. Lokale `ChevronBack` om require-cycle met RootStack te vermijden. |
| `ChildrenScreen.tsx` | Lijst van kinderen (cards met naam + leeftijd via `formatAge`, optionele detail-rows voor bekende allergieën, geïntroduceerde allergenen, eerdere reacties, opmerkingen). `useFocusEffect` herlaadt na terugkeer uit `ChildForm`. Edit-knop → `navigate('ChildForm', { childId })`, verwijder-knop → `Alert.alert` confirm → `archiveChild` (soft delete). "Kind toevoegen"-CTA onderaan. Header: `ChevronBack` + titel. **NB v2.6.0**: de allergeen-flow start niet meer hier maar vanaf het landingscherm (Allergenen-tile → `AllergenenChildrenScreen`). |
| `ChildFormScreen.tsx` | Add/edit-formulier voor een kind. Route-param `childId` bepaalt edit-modus (laadt via `getChildren()` + filter — geen aparte GET-by-id endpoint). Velden + validatie (parity met website-UI sinds verwijdering textuur/eczeem): naam (verplicht, max 50), geboortedatum (regex `^\d{4}-\d{2}-\d{2}$`, max vandaag, min 10 jaar terug — v2.8.4: validatie gebruikt lokale getters i.p.v. UTC zodat geboortedatum vandaag/morgen geen timezone-fout geeft), known_allergies (9 chips uit `KNOWN_ALLERGEN_OPTIONS`), previous_reactions (textarea max 1000), notes (textarea max 500). `KeyboardAvoidingView` op iOS. Op succes: `goBack()` → ChildrenScreen herlaadt automatisch. |
| `AllergenenChildrenScreen.tsx` | Kind-picker voor de allergeen-flow (v2.6.0). Bereikbaar via de "Allergenen-introductie"-tile op `LandingScreen`. Laadt `getChildren()` met `useFocusEffect`. Toont per kind een kaart (naam + leeftijd via `formatAge` + chevron); tap → `navigate('EersteHapjes', { childId })`. Bij 0 kinderen: empty-state met CTA naar `Children` om er eerst een aan te maken. Header: `ChevronBack` + titel. |
| `EersteHapjesScreen.tsx` | Allergenen-grid per kind (v2.5.0 MVP, sterk uitgebreid t/m v2.9.1). Laadt via `useFocusEffect`: `getChildren()` + `getEhState(childId)` + `getEhDoses(childId)`, dan `buildAllergenContext(doses, state, ageMonths)`. Render-stage state-machine spiegelt website `js/components/allergenen.js`: **pause → welcome → setup → grid**. (1) Intro-text onder header (v2.8.8, parity met `.allergenen-intro`). (2) **WelcomeCard** (v2.8.6): 🍽-icoon + "Start met introduceren"-CTA als `state.started !== true`. (3) **Setup-card** "Reeds geïntroduceerd?" (v2.8.5/v2.8.6): checkbox-grid met foto-achtergrond + `LinearGradient` sage-overlay; persisteert `pre_introduced[]` in allergen-state. (4) **Grid** met 9 tegels — status-badge (Veilig / Bezig / Nog te doen / Allergisch / Gepauzeerd / Nog te jong / Overgeslagen) en `X/3 doses` teller. Tegels gebruiken `ImageBackground` uit `assets/allergens/`. **Pause-flow** (v2.8.9 hide-basis + v2.9.1 volledige wizard): zodra `state.paused === true` worden de Symptoom-loggen-knop én HoeveelhedenBox verborgen. De **pause-wizard** (3-staps modal, parity met website) wordt getoond als `paused && paused_step >= 1`: stap 1 info-kaart ("Gelezen"), stap 2 arts-vraag ("Heb je een arts gecontacteerd?"), stap 3 allergisch ja/nee. Trigger zit in `SymptomFormScreen` (reactie matig/heftig + gelinkt allergeen → `patchEhState` met `paused/paused_type ('twijfel'|'ernstig')/paused_step:1/paused_allergen`). Callbacks `advancePauseStep` / `handleAllergyConfirmed` (markeert allergisch + reset pauze) / `handleAllergyDenied` (reset pauze). Cooldown-banner als laatste dose < `ALLERGEN_COOLDOWN_DAYS` (2 dagen) geleden. Tik op een tegel → `navigate('DoseForm', { childId, allergenKey })`. Locked-age tegels zijn niet-klikbaar. **Arts-toezicht-modus** (v2.9.0/v2.9.1): als `state.arts_toezicht === true` krijgt elke nog-niet-veilige/niet-allergische tegel een "Overslaan"-knop (text-only, rechtsonder absolute positioned binnen de ImageBackground, zodat de foto over de volledige gesloten tegel blijft). Klik → `handleToggleExclude` patcht `allergen_state.excluded_keys` (Set-toggle); status wordt `'excluded'` (🚫 Overgeslagen) en knop verandert in "Opnemen". Onderaan een "Symptoomlog →"-knop → `navigate('SymptomLog', { childId })`. Header: `ChevronBack` + titel. |
| `DoseFormScreen.tsx` | Modal-style add-dose form. Route-params `{ childId, allergenKey }`. Laadt bestaande doses via `getEhDoses(childId, allergenKey)`, suggesteert volgende vrije `dose_number` via `nextDoseNumber()`. Velden: dose nummer (3 chips 1-2-3, "al gedaan"-hint op bezette posities), reactie (3 radio-cards geen/mild/ernstig met description; bij ernstig een danger-banner "arts contacteren"), `intro_date` (TextInput jjjj-mm-dd, default `todayIsoDate()`, niet in toekomst), notes (textarea max 500). Save → `createEhDose()`. Op succes goBack → EersteHapjesScreen herlaadt. Header: `ChevronBack` + titel. |
| `SymptomLogScreen.tsx` | Lijst van gelogde symptomen per kind (v2.6.0). Laadt `getChildren()` + `getEhSymptoms(childId, { limit: 100 })` met `useFocusEffect`. Per item: emoji-icon + label uit `SYMPTOM_TYPES`, severity-label, `formatOccurredAt(occurred_at)` ("27 mei · 14:32"), optioneel gelinkt allergeen + notities. Rode `red_flag`-badge als de server een red-flag heeft gevlagd; kaart krijgt dan een danger-border. + knop in header opent `SymptomForm` (nieuwe entry); tap kaart → edit-mode; trash-icoon → `Alert.alert` confirm → `deleteEhSymptom`. Empty-state met "Eerste symptoom loggen"-CTA. Header: `ChevronBack` + titel + plus-knop. |
| `SymptomFormScreen.tsx` | Add/edit symptoom-form (v2.6.0, v2.8.7 voor linked-allergen-unie). Route-params `{ childId, symptomId? }`. Bij edit laadt het bestaande item via `getEhSymptoms(childId, { limit: 200 })` (er is geen GET-by-id endpoint). Velden: symptoom-type (16 chips uit `SYMPTOM_TYPES` in 3-koloms grid), severity (3 radio-cards mild/matig/heftig met description), `occurred_at` (TextInput jjjj-mm-dd uu:mm, default `nowLocalDatetime()`, niet in toekomst → ISO via `localInputToIso`), **gelinkt allergeen** (chip-grid "Geen" + alle geïntroduceerde keys = unie van doses + `pre_introduced` + `known_allergies` via Set, parity met website `computeIntroducedKeys()`), notes (textarea max 500). **Red-flag banner** verschijnt live zodra `isRedFlag(type, severity)` true is, met advies om contact op te nemen met een arts. Save → `createEhSymptom` of `updateEhSymptom`. Op succes goBack → SymptomLog herlaadt. Header: `ChevronBack` + titel ("Symptoom loggen"/"bewerken"). |
| `MemoriesScreen.tsx` | Lijst van HapjesHeld-geheugen-items. Per item: importance-badge (1-5 met kleur-tier), content, "Opgeslagen X geleden · laatst gebruikt Y geleden" via `relTime()`-helper, ✕-knop met `Alert.alert` confirm → `deleteMemory(id)` + optimistic remove. "Alles wissen"-knop onderaan met `Alert.alert` confirm → `deleteAllMemories()`. Empty-state met `cpu`-icoon. Werkt onafhankelijk van memory-toggle: items blijven beheerbaar ook als toggle uit staat. `useFocusEffect` herlaadt bij elke focus. Header: `ChevronBack` + titel. |
| `RecipeListScreen.tsx` | Zoekbalk + filterpanel (eetmoment + allergeen chip-rijen). `Promise.all`-load. `FlatList` met `RefreshControl`. |
| `RecipeDetailScreen.tsx` | Foto, fav-toggle, info-tags, **portion-scaling** o.b.v. actief weekschema (`X = ceil(persons/portions)`), ingredients, steps, sterren + comments. |
| `WeekScheduleScreen.tsx` | 2 sub-tabs (`active` / `generate`), 3 presets (`today` / `today-tomorrow` / `week`). Genereer-knop + per-slot 🔄 refresh. Modal "Opslaan met naam". |
| `ShoppingListScreen.tsx` | Stap 1 boodschappenlijst: kies dagen × slots. Aggregeert ingredients met unit-normalisatie en `X × count` vermenigvuldiger, navigeert naar de Boodschappenlijst-tab. |
| `ShoppingListTabScreen.tsx` | Stap 2: visuele ingrediënt-tegels + winkelmandje (drag/tap). |
| `FavoritesScreen.tsx` | Sectie "Opgeslagen weekschema's" + sectie "Favoriete recepten". Activeren via `Alert.prompt` (aantal personen). |
| `HapjesHeldScreen.tsx` | RAG-chat met `UsageBar` (maand-€-budget), foto-counter (`remaining/limit`), `HealthDisclaimerModal`, link-parser voor assistant-tekst. |
| `ConversationsScreen.tsx` | Gesprekkenlijst met `useFocusEffect` + `RefreshControl`. Long-press → delete. |
| `TimelineScreen.tsx` | Community-tijdlijn MVP (v2.10.0), tweede footer-tab. `FlatList` met cursor-paginatie via `before` (= `created_at` van laatste niet-gepinde community-post, berekend in `computeCursor`), `RefreshControl` + `useFocusEffect`-refresh + `onEndReached`-loadMore (dedupe op id-Set), `PAGE_SIZE = 20`. **Gevolgde chatruimte-topics in de feed (v2.15.0)**: de server merget gevolgde chatroom-topics (`source_type === 'chatroom'`, met `title`/`source_room_title`/`source_room_slug`) al in `GET /api/community/posts`; deze worden NIET meer weggefilterd maar gerenderd als **`ChatroomTopicCard`** (sage linker-rand, bron-badge "Chatruimte: …", titel, body-snippet 200 tekens, footer "X reacties · Open discussie"). Tik → cross-tab `navigation.navigate('Chatruimtes', { screen: 'ChatTopic', params: { topicId, roomTitle } })`. `computeCursor` blijft community-only (chatroom-items pagineren mee op dezelfde `before`). **`PostCard`** is zelf-bevattend: eigen like-state (optimistic toggle met rollback via `togglePostLike`), lazy-loaded replies (`listReplies` bij eerste uitklap) + inline reply-composer (`createReply`), pin-badge ("Mededeling"), admin-badge, categorie-chip (verborgen voor `algemeen`), optionele foto. **`Composer`** (alleen admins, in `ListHeaderComponent`): tekst + categorie-pills uit `POST_CATEGORIES` → `createPost`. Admin-check via `getIsAdmin(user)`. `PostAvatar` toont foto of gekleurde initiaal-bol. **Eigen content bewerken/verwijderen** (v2.12.0, via `getCurrentUserId()` vergeleken met `user_id`): eigen post krijgt `edit-2`/`trash-2`-iconen in de kop → bewerken = inline `TextInput` (`editPost`, max `POST_BODY_MAX`), verwijderen = `Alert` confirm → `deletePost` → `onPostDeleted` filtert uit de feed. Eigen reply idem: inline edit (`editReply`, max `REPLY_BODY_MAX`) + delete via `Alert` → `deleteReply` (rechtstreeks uit `services/community` wegens naam-botsing met `chatRooms`). Geen edit-window (server doet owner-check, 403 bij niet-eigenaar). **Reply-likes** (v2.12.1): elke reactie heeft een hartje + teller onder de body (optimistic toggle via `toggleReplyLike`, rollback bij fout; teller verborgen bij 0). Buiten scope: foto-upload, polls, rapporteren, notificaties. |
| `ChatRoomsListScreen.tsx` | Chatruimtes-tab root (v2.11.0). Toont de 4 vaste rooms via `listRooms()` (server leidend; valt terug op lokale `ROOMS`-constant zodat de lijst nooit leeg is). Per room een kaart met titel + optionele beschrijving + chevron (**emoji-bol verwijderd in v2.17.1**). **Stille focus-reload (v2.17.1)**: eerste focus toont de centrale spinner (`initial`), daarna stil herladen (`silent`, geen `RefreshControl`-cirkel) via een `loadedOnce`-ref — voorkomt de vastzittende ververs-cirkel; `refresh`-mode enkel nog voor pull-to-refresh. **Volg-indicatie (v2.14.0)**: parallel met `listRooms()` wordt `getUnread()` opgehaald; per room toont de kaart óf een rode ongelezen-badge (`unread.rooms[room.id]`, "99+" cap) óf — als gevolgd zonder ongelezen — een sage gevolgd-stip. Tap → `navigate('ChatRoom', { slug, title })`. `useFocusEffect` + `RefreshControl`. Eigen header (geen stack-header). |
| `ChatRoomScreen.tsx` | Topic-lijst van één room (v2.11.0). `getRoom(slug)` → `{ room, topics }`. Optioneel **admin-welkomsbericht read-only** bovenaan (`room.admin_intro`, niet bewerkbaar op mobiel). `FlatList` van topics (gepind-badge, titel, body-snippet, auteur-avatar + nickname + admin-badge, `relTime(last_reply_at||created_at)`, replies-teller). Floating "Nieuw topic"-knop → `navigate('ChatTopicForm', { slug })`. Tap topic → `navigate('ChatTopic', { topicId, roomTitle })`. **Volg-knop (v2.14.0)**: header-rechts toggle "Volg"/"Gevolgd" (`navigation.setOptions` headerRight, plus/check-icoon) → `followRoom`/`unfollowRoom` optimistisch met rollback; bij openen van een gevolgde room én na volgen wordt `markRoomRead(slug)` aangeroepen zodat de ongelezen-badge reset. `useFocusEffect` + `RefreshControl`. Stack-header met `ChevronBack` + room-titel. |
| `ChatTopicScreen.tsx` | Topic-detail + reacties (v2.11.0). `getTopic(topicId)` → `{ topic, replies }`. `TopicHeader` (titel + body + auteur) en `ReplyRow`'s in een `FlatList` (`ListHeaderComponent`). **Eigen content** (via `getCurrentUserId()` vergeleken met `user_id`): Bewerken-knop alleen binnen 15 min (`isWithinEditWindow`), Verwijderen altijd. Topic-edit → `navigate('ChatTopicForm', { topicId, initialTitle, initialBody })`; topic-delete → `Alert` confirm → `deleteTopic` → goBack. Reply-edit = inline `TextInput` (`updateReply`); reply-delete = `Alert` → `deleteReply`. Onderaan reply-composer (`createReply`, geïmporteerd rechtstreeks uit `services/chatRooms` wegens naam-botsing met `community.ts`). `KeyboardAvoidingView` met `keyboardVerticalOffset={useHeaderHeight()}` (v2.17.1, `@react-navigation/elements`) zodat de composer exact boven het toetsenbord uitlijnt i.p.v. een hardcoded offset. Stack-header `ChevronBack`. |
| `ChatTopicFormScreen.tsx` | Topic aanmaken/bewerken (v2.11.0). Route-params `{ slug, topicId?, initialTitle?, initialBody? }`. Titel-input (max `TOPIC_TITLE_MAX` 120) + body-textarea (max `TOPIC_BODY_MAX` 4000) met live tellers. Create (`createTopic(slug, …)`) of edit (`updateTopic(topicId, …)`). Op succes goBack → vorige scherm herlaadt via `useFocusEffect`. `KeyboardAvoidingView`. Stack-header. |
| `LearningsScreen.tsx` | Learnings-bibliotheek (v2.17.0), read-only. Laadt alle items via `getLearnings()` (geen server-filter) met `useFocusEffect` + `RefreshControl`. Client-side `filtered` useMemo: type-filter (KIND_FILTERS chips Alle/Blog/Document/Video) + favorieten-only (hart-chip) + zoeken over titel/beschrijving/tags. `FlatList` van kaarten: thumbnail (`Image` of emoji-placeholder via `learningKindIcon`), type-badge + duur (`formatDuration`), titel, beschrijving, hartje-favorietknop (optimistic toggle met rollback via `toggleLearningFavorite`). **Tap-gedrag (v2.18.0)**: documenten (`kind==='pdf'`) → `navigate('LearningPdf', { id, title })` (eigen PDF.js-viewer met bladwijzer-sync); blog/video → `navigate('LearningDetail', { id, title })`. (WebBrowser/openingId verwijderd in v2.18.0.) Lokale `ChevronBack` + titel "Learnings". Empty-state met `book-open`-icoon. |
| `LearningDetailScreen.tsx` | Learning-viewer (v2.17.0), read-only. `getLearning(id)` in `useEffect` (goBack bij fout). Header: lokale `ChevronBack` + titel + favoriet-hartje (optimistic + rollback). Render per `kind`: **blog** → `WebView` (`react-native-webview`) met `wrapBlogHtml(body_html)` (theme-gestylede HTML-wrapper); **video** → `expo-video` `VideoView` + `useVideoPlayer(signed_url)` (nativeControls, allowsFullscreen, contentFit contain) in ScrollView; **pdf** → kaart met "Document openen"-knop → `WebBrowser.openBrowserAsync(signed_url)` (legacy-fallback; pdf-navigaties komen sinds v2.18.0 via `LearningPdfScreen`, niet meer hier). **Video-positie sync (v2.18.0)**: bij `kind==='video'` haalt het scherm `getLearningBookmark(id)` op (→ `resumeRef`); zodra de player `statusChange`→`readyToPlay` triggert, springt hij eenmalig naar `resumeRef` (`player.currentTime`). Een `timeUpdate`-listener (interval 2s) slaat de positie debounced (1500ms) op via `putLearningBookmark(id, { seconds })` (skip als < 1s verschil met `lastSavedRef`); op cleanup wordt de laatste positie geflusht. Parity met website-bookmark `seconds`. Notities/clips van de website blijven buiten de mobiele app. |
| `LearningPdfScreen.tsx` | Eigen **PDF.js-viewer** in een `WebView` (v2.18.0), full-screen, read-only. Route-params `{ id, title? }`. Laadt `Promise.all([getLearning(id), getLearningBookmark(id)])`, bepaalt `startPage = bookmark?.page_nr ?? 1`, en bouwt HTML via `buildViewerHtml(signed_url, startPage)`: laadt pdf.js 3.11.174 van cdnjs, rendert alle pagina's als canvases (body-breedte × devicePixelRatio), `scrollIntoView` naar `START_PAGE`, en een scroll-listener (250ms) detecteert de pagina dichtst bij het midden → `window.ReactNativeWebView.postMessage({type:'page', page})`. `onMessage`: type `page` → `pageRef` + debounced (`SAVE_DEBOUNCE_MS` 1500) `savePage` → `putLearningBookmark(id, { page_nr })` (skip als gelijk aan `lastSaved`); type `error` → toast. Cleanup flusht de timer + slaat `pageRef` op. **Bladwijzer-sync met de website**: page_nr wordt gedeeld via dezelfde `/api/learnings/:id/bookmark`, dus een bladwijzer op de web-app brengt je op de gsm op dezelfde pagina (en omgekeerd). Geen download-knop (parity: documenten downloaden gebeurt enkel op de website). Lokale `ChevronBack` + titel. |

**Nog te bouwen (zie §14):** Tijdlijn-uitbreidingen (foto's, polls, rapporteren, notificaties) staan open. Eigen post/reply bewerken+verwijderen ✅ v2.12.0. Reply-likes ✅ v2.12.1. Chatruimtes ✅ v2.11.0 (rooms → topics → replies, volledig CRUD op eigen content; geen volgen/badges, admin-intro read-only). Tijdlijn-MVP ✅ v2.10.0. Symptoom-log + red-flag banner ✅ v2.6.0. Setup-flow + welcome-card + pause-hide ✅ v2.8.x. Arts-toezicht-modus (exclude/include) + volledige pause-wizard (3-staps modal) ✅ v2.9.x. **Allergenen-introductie = feature-compleet t.o.v. web** (geen aparte readiness-checklist op de webversie).

**Routes** in `RootStackParamList`: `Landing` (→ `LandingTabs`: Functies/Tijdlijn/Chatruimtes; Chatruimtes = `ChatRoomsStack`: RoomList/ChatRoom/ChatTopic/ChatTopicForm) · `Main` · `HapjesHeld` · `Profile` · `Children` · `ChildForm` · `Memories` · `AllergenenChildren` · `EersteHapjes` · `DoseForm` · `SymptomLog` · `SymptomForm` · `Learnings` · `LearningDetail` · `LearningPdf`.

---

## 6. Services-laag (data-laag)

Barrel: `src/services/index.ts`. Iedere service exporteert pure functies (geen klassen).

| Bestand | Bevat |
|---|---|
| `auth.ts` | `checkAllowedUser`, `checkCanSignUp`, `signUp` (4 stappen: whitelist → Supabase → mark `post_registered` → signIn), `signIn`, `signOut`, `resetPassword`, `getSession`, `onAuthStateChange` |
| `cache.ts` | `CACHE_TTL = 30_000`. `cacheGet/cacheSet/cacheInvalidate(prefix)/clearCache()` |
| `recipes.ts` | `getRecipes`, `getRecipe`, `getRecipesByIds`, `dbToRecipe` mapper. Cache per-recipe + lijst. |
| `favorites.ts` | `getFavoriteRecipeIds`, `getFavoriteRecipes`, `isFavorite`, `toggleFavorite`. **Race-safe DELETE-then-INSERT** met 23505-conflict-tolerantie. |
| `ratings.ts` | `getUserRating`, `getAverageRating`, `getAllRatings`, `rateRecipe`. Upsert met `onConflict: 'recipe_id,user_name'`. Clamp 1–5. |
| `comments.ts` | `getComments`, `addComment` |
| `schedules.ts` | `getSavedSchedules`, `getSchedule`, `saveSchedule`, `deleteSchedule`, `getActiveSchedule`, `setActiveSchedule(id, persons)`, `deactivateSchedule`. **Max 1 actief schema per user**; default `persons = 4`. |
| `ingredientIcons.ts` | `getIngredientIconMaps()` met **5 min TTL**. Fallback wanneer `display_name`/`aliases` (legacy) ontbreken. |
| `hapjesheld.ts` | `RAG_API_URL` (`EXPO_PUBLIC_RAG_API_URL` override). `getAuthToken`, `authedFetch`, `parseOrThrow<T>`. Endpoints: `getProfile`, `listConversations`, `getConversation`, `deleteConversation`, `sendChatMessage`. Types: `ChatRequest/Response`, `MonthlyUsage`, `DailyImageUsage`, `ProfileResponse`, `ConversationSummary`, `StoredMessage`, `ConversationDetail`, `ChatError`. |
| `hapjesheld-image.ts` | `pickImageFromGallery`, `pickImageFromCamera`, `PickedImage`. `MAX_IMAGE_BYTES = 3 MB`, `DAILY_IMAGE_LIMIT = 50`. Compressie via `expo-image-manipulator`: `maxWidth 1600`, JPEG, quality start `0.85` → step −`0.15` → min `0.3`. EXIF-strip automatisch. |
| `profile.ts` | Eigen `authedFetch` + `jsonOrThrow` (kleine variant van `hapjesheld.ts`-helpers, geen image-handling). Endpoints: `getMemoryEnabled()` (GET `/api/profile`), `setMemoryEnabled(b)` (PUT `/api/profile`), `exportUserData()` (GET `/api/me` → raw JSON-string), `deleteAccount()` (DELETE `/api/me` — 200 = succes, 207 = partial + throw met server-message). |
| `communityProfile.ts` | Eigen `authedFetch` + `jsonOrThrow`. Type `CommunityProfile` (`user_id`, `nickname`, `avatar_path`, `avatar_url` (signed, 1u TTL), `created_at`, `updated_at`). `NICKNAME_REGEX = /^[A-Za-z0-9_\- ]{2,30}$/`. Endpoints: `getCommunityProfile()` (GET `/api/community/profile`, returnt `null` als nog niet gemaakt), `updateCommunityProfile({ nickname?, avatar_path? })` (PUT), `getAvatarUploadUrl()` (POST `/api/community/profile/avatar-url` → `{ path, uploadUrl }`, 5min TTL), `uploadAvatarToStorage(localUri, uploadUrl, mime?)` (PUT blob direct naar Supabase Storage signed URL — bucket `community-images`, pad `{user_id}/avatars/{random}.jpg`). |
| `children.ts` | Eigen `authedFetch` + `jsonOrThrow`. Types `Child`, `ChildInput`. `BIRTHDATE_REGEX = /^\d{4}-\d{2}-\d{2}$/`. `KNOWN_ALLERGEN_OPTIONS` (9 hoofdallergenen: kippen-ei, pinda, noten, sesam, vis, schaaldieren, soja, tarwe, koemelk — keys identiek aan `js/content/eersteHapjes-allergen-flow.js`). Endpoints: `getChildren()` (GET `/api/children`, server vult `introduced_allergens`-summary), `createChild(input)` (POST), `updateChild(id, patch)` (PATCH `{ id, ...patch }`), `archiveChild(id)` (DELETE `{ id }` → soft delete via `archived_at`). Helpers: `ageInMonths(birthdate)`, `formatAge(birthdate)` → "3 maanden" / "1 jaar 2 maanden". **NB**: `texture_preference` en `has_eczema` zijn op de website verwijderd uit UI sinds v2.2.1 — de DB-kolommen bestaan nog maar de mobile-app stuurt/toont ze niet meer. |
| `family.ts` | Eigen `authedFetch` + `jsonOrThrow`. `DIET_OPTIONS` (9 dieet-keys: vegetarisch, veganistisch, glutenvrij, lactosevrij, pescotarisch, halal, kosher, geen-varken, geen-rund — keys identiek aan server `api/family.mjs` ALLOWED_DIET). `MAX_DIET_ITEMS = 9`. Endpoints: `getFamilyDiet()` (GET `/api/family` → `string[]`), `setFamilyDiet(diet)` (PUT `/api/family` { family_diet }, server sanitizet + dedupliceert + whitelist + capt op 9). Vereist bestaand community-profile (anders 409). Opgeslagen op `community_profiles.family_diet` (`text[]`). |
| `memory.ts` | Eigen `authedFetch` + `jsonOrThrow` + `okOrThrow` (voor 204-DELETE). Type `Memory` (`id`, `content`, `importance` 1-5, `created_at`, `last_used_at`). Endpoints: `getMemories()` (GET `/api/memory` → `Memory[]`), `deleteMemory(id)` (DELETE `/api/memory?id=<uuid>`), `deleteAllMemories()` (DELETE `/api/memory`). Server-tabel `chat_user_memory` (RLS owner-only). Helper `relTime(iso)` voor "5 min" / "3 u" / "12 d" / NL-datum, identiek aan website `js/chat.js::relTime`. Werkt onafhankelijk van `memory_enabled`-flag. |
| `eersteHapjes.ts` | Eigen `authedFetch` + `jsonOrThrow` + `okOrThrow`. **Allergen-constants**: `ALLERGEN_FLOW` (9 hoofdallergenen met `key`/`label`/`icon`/`order`/`introFromMonths` (4) / `introBeforeMonths` (12) / `suggestion`), `ALLERGEN_COOLDOWN_DAYS = 2`, `ALLERGEN_TARGET_DOSES = 3`, `REACTION_LEVELS` (geen/mild/ernstig met `counts`/`pauses`/`escalate` flags). **Symptom-constants** (v2.6.0): `SYMPTOM_TYPES` (16 items met `key`/`label`/`icon`/`redFlagSeverity[]` — mirror van server `RED_FLAG_SEVERITIES`; `ademhaling` & `lethargie` triggeren al bij `mild`, `braken`/`koorts`/`zwelling`/`hoesten`/`gewicht` vanaf `matig`, de rest enkel bij `heftig`), `SYMPTOM_SEVERITIES` (mild/matig/heftig met description). Types: `EhState`, `EhDose`, `EhDoseInput`, `AllergenStatus` ('veilig' \| 'allergisch' \| 'paused' \| 'in-progress' \| 'wacht' \| 'locked-age' \| 'excluded' — v2.9.0), `AllergenContext`, `AllergenStateData`, `EhSymptom`, `EhSymptomInput`, `SymptomType`, `SymptomSeverity`, `TimeAfterEating`, `SymptomDuration`, `SymptomWorsened`, `SymptomBehavior`. State-endpoints: `getEhState(childId)`, `patchEhState(childId, patch)` (PATCH met deep-merge op `allergen_state`). Dose-endpoints: `getEhDoses`, `createEhDose` (409 op duplicate `(child, allergen, dose_number)`), `updateEhDose`, `deleteEhDose`. **Symptom-endpoints** (v2.6.0): `getEhSymptoms(childId, { since?, limit? })` (GET `/api/eerste-hapjes/symptoms`), `createEhSymptom(input)` (POST, server vult `red_flag` o.b.v. `RED_FLAG_SEVERITIES`), `updateEhSymptom(id, patch)` (PATCH), `deleteEhSymptom(id)` (DELETE → 204). Helpers: `buildAllergenContext`, `getAllergenStatus`, `successfulDoseCount`, `nextDoseNumber`, `todayIsoDate`, `isRedFlag(type, severity)` (lokale mirror voor live-banner in form), `symptomTypeInfo(type)` (label/icon lookup). Spiegelt `js/content/eersteHapjes-allergen-flow.js` + `js/eersteHapjesStateApi.js` + `api/_lib/eersteHapjes-logs.mjs` op de website. **v2.6.0** dekt state + doses + symptomen; **v2.8.x** voegt setup-flow + welcome-card + pause-hide toe; **v2.9.x** voegt arts-toezicht/exclude-toggle toe (`excluded_keys` patch via `patchEhState`) + volledige 3-staps pause-wizard. Feature-compleet t.o.v. web. |
| `community.ts` (v2.10.0) | Eigen `authedFetch` + `jsonOrThrow` (kopie van `communityProfile.ts`-helpers). Spiegelt `api/community.mjs`. Types `CommunityPost` (`id`, `user_id`, `body`, `category`, `image_path`, `is_pinned`, `edited_at`, `created_at`, `nickname`, `likes_count`, `replies_count`, `has_poll`, `source_type` `'community'\|'chatroom'`, `liked_by_me`, `image_url`/`avatar_url` signed 1u TTL, `poll`, `author_is_admin`, + optioneel voor chatroom-items `title`/`source_room_title`/`source_room_slug`/`last_reply_at` — v2.15.0), `CommunityReply`, `CategoryInfo`. Constants: `POST_CATEGORIES` (algemeen💬, vraag❓, tip💡, mijlpaal⭐, voeding🥕, slapen😴), `POST_BODY_MAX = 4000`, `REPLY_BODY_MAX = 2000`, helper `categoryInfo(key)`. Endpoints: `listPosts({ before?, limit?, category? })` (GET `/api/community/posts`, **cursor-paginatie** via `before` = created_at), `createPost({ body, category })` (POST, 412 zonder nickname), `togglePostLike(postId)` (POST `/like` → `{ liked, count }`), `toggleReplyLike(replyId)` (POST `/replies/:id/like` → `{ liked, count }`, v2.12.1), `listReplies(postId)`, `createReply(postId, body)` (412 zonder nickname), `editPost(postId, body)` (PATCH, owner-check 403, geen edit-window), `deletePost(postId)` (DELETE → `{ ok }`), `editReply(replyId, body)` (PATCH), `deleteReply(replyId)` (DELETE) — v2.12.0, `getIsAdmin(email)` (GET `/api/subscription-status?email=` → `{ is_admin }`, stille false bij fout). **NB**: `deleteReply` wordt NIET via de barrel geëxporteerd (botst met `chatRooms.deleteReply`); `TimelineScreen` importeert die rechtstreeks uit `services/community`. |
| `notifications.ts` (v2.13.0, admin-modus v2.13.1, chatroom-feed v2.15.0) | Telfuncties voor de notificatie-badges op de footer-tabs (geen push). `countNewAdminTimelinePosts(since, includeAllAuthors?)` (listPosts limit 50 → telt nieuwe items `created_at > since`: ALLE `source_type==='chatroom'`-items — gevolgde topics, tellen altijd — PLUS community-posts `(includeAllAuthors \|\| author_is_admin)`; v2.15.0) en `countNewAdminChatroomPosts(since, includeAllAuthors?)` (per room `getRoom(slug)` → topics `(includeAllAuthors \|\| author_is_admin) && created_at > since`, opgeteld over alle `ROOMS`). `includeAllAuthors` (v2.13.1) = admin-modus: admins tellen ALLE nieuwe posts, gewone gebruikers enkel admin-posts. Beide defensief: bij fout → 0 (poll-loop crasht nooit). "Nieuw" = strikt na `since`; geen `since` → 0 (eerste run telt niets). Wordt gepolld door `NotificationContext`. |
| `chatRooms.ts` (v2.11.0) | Eigen `authedFetch` + `jsonOrThrow` + `okOrThrow` (kopie van `community.ts`-helpers). Spiegelt `api/chat-rooms.mjs`. **Constants**: `ROOMS` (4 vaste rooms: melk-voeding🍼, eerste-hapjes🥄, allergieen-overgevoeligheden🌾, feedback💬), `TOPIC_TITLE_MAX = 120`, `TOPIC_BODY_MAX = 4000`, `REPLY_BODY_MAX = 2000`, `EDIT_WINDOW_MS = 15 min`. Types: `ChatRoom`, `ChatRoomDetail` (+ `admin_intro`), `ChatTopic` (`title`, `body`, `is_pinned`, `replies_count`, `last_reply_at`, `author_is_admin`, nickname/avatar_url signed), `ChatReply`, `AdminIntro`. Endpoints: `listRooms()` (GET `/api/chat-rooms`), `getRoom(slug)` (GET `/api/chat-rooms/:slug` → `{ room, topics }`), `getTopic(id)` (GET `/api/chat-rooms/topics/:id` → `{ topic, replies }`), `createTopic(slug, { title, body })` (POST, 412 zonder nickname / 422 moderatie), `updateTopic(id, patch)` (PATCH, 403 buiten eigenaar/venster), `deleteTopic(id)` (DELETE → `{ ok: true }`), `createReply(topicId, body)` / `updateReply(id, body)` / `deleteReply(id)`. **Follow/unread (v2.14.0)**: `getUnread()` (GET `/api/chat-rooms/unread` → `UnreadCounts` `{ rooms: {room_id:count}, topics: {topic_id:count} }`, defensief → lege maps bij fout), `followRoom(slug)` (POST `/api/chat-rooms/:slug/follow`), `unfollowRoom(slug)` (DELETE), `markRoomRead(slug)` (POST `/api/chat-rooms/:slug/read`, stil falen — mag het openen van de room niet blokkeren). `ChatRoom` + `ChatTopic` hebben `is_followed?: boolean`. Helpers: `getCurrentUserId()` (uit `supabase.auth.getSession()` — UserContext heeft enkel de e-mail, niet de UUID, nodig voor eigenaarschap-checks), `isWithinEditWindow(createdAt)`, `roomEmoji(slug)`. **NB**: `createReply` + `REPLY_BODY_MAX` worden NIET via de barrel geëxporteerd (botsen met `community.ts`); `ChatTopicScreen` importeert ze rechtstreeks uit `services/chatRooms`. **Topic-follow** (`/api/chat-rooms/topics/:id/follow` + `/read`) bestaat server-side maar is nog niet in de mobile-app gewired (enkel room-follow). |

| `learnings.ts` (v2.17.0) | Eigen `authedFetch` + `jsonOrThrow` (kopie van `memory.ts`-helpers, `RAG_API_URL` uit `./hapjesheld`). Read-only viewer van de website-bibliotheek; aanmaken/bewerken/verwijderen blijft admin-only op de website. Types: `LearningKind` (`pdf`/`blog`/`video`), `Learning` (`id`, `kind`, `title`, `description`, `thumbnail_url`, `duration_sec`, `tags`, `created_at`, `is_favorite`), `LearningDetail extends Learning` (+ `body_html` voor blog, `signed_url` voor pdf/video). Endpoints: `getLearnings({ kind?, favoritesOnly? })` (GET `/api/learnings`, `?kind=`/`?favorites=1`), `getLearning(id)` (GET `/api/learnings/:id` → detail incl. `signed_url` (pdf 10min / video 4u TTL) of `body_html`), `toggleLearningFavorite(id)` (POST `/api/learnings/:id/favorite` → nieuwe `is_favorite`). Helpers: `learningKindIcon` (📄/🎬/📝), `learningKindLabel` (Document/Video/Blog), `formatDuration(sec)` ("m:ss"). **Bladwijzer-sync (v2.18.0)**: type `LearningBookmarkPosition` (`page_nr?` PDF / `scroll_px?` blog / `seconds?` video). `getLearningBookmark(id)` (GET `/api/learnings/:id/bookmark` → `position | null`), `putLearningBookmark(id, position)` (PUT `{ position }`). Gedeeld met de website (`user_learning_bookmarks`), dus bladwijzer/positie synchroniseren tussen web en mobiel (pdf-pagina + video-seconden gewired in de app; blog `scroll_px` nog niet). Spiegelt `api/learnings.mjs` op de website (notities/clips bewust buiten scope). |

**Patroon voor nieuwe services:**
- **Supabase-direct** (legacy email-keyed tabellen): kopieer `recipes.ts`/`favorites.ts`.
- **Vercel-API** (auth.users.id-keyed, community, chatruimtes, profiel): kopieer `hapjesheld.ts` — gebruik `authedFetch` + `parseOrThrow`.

---

## 7. Constants & types

### 7.1 `src/constants/theme.ts`

```ts
colors = {
  primary: '#C98966', primaryDark: '#BE764E', primaryLight: '#FFBC7D',
  secondary: '#98C3A4', secondaryDark: '#82BE93',
  danger: '#c0392b', dangerDark: '#a93226',
  warning: '#f1c40f', info: '#5dade2',
  dark: '#171717', darkLight: '#3d3d3d',
  gray: '#7a7a7a', grayLight: '#c5c5c5',
  light: '#f0ebe6', white: '#ffffff', bg: '#faf8f5',
  star: '#f1c40f', starEmpty: '#dddddd',
}
radius  = { sm: 4, md: 12, lg: 20 }
spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 }
shadows = { sm, md, lg }   // shadowColor #000 + elevation 1/3/6
fontFamily = 'System'
```

### 7.2 `src/constants/data.ts`

```ts
ALLERGENS = [
  'gluten','lactose','ei','noten','pinda','soja','vis',
  'schaaldieren','selderij','mosterd','sesam','sulfiet','lupine'
]
MEAL_MOMENTS = [{id,label},...]    // ontbijt, lunch, diner, tussendoor, …
SCHEDULE_SLOTS = [{id,label},...]  // ochtend/middag/avond + tussendoortjes
WEEKDAYS = ['maandag','dinsdag',...,'zondag']
slotToMealMoment(slotId) → mealMomentId
getSlotLabel(slotId) → string
getMealMomentLabel(mealMomentId) → string
```

### 7.3 `src/types/index.ts`

Interfaces: `Ingredient`, `Recipe`, `Comment`, `RatingSummary`, `Schedule` (saved in DB), `ActiveSchedule` (lokaal gegenereerd).

---

## 8. Conventies (NIET-onderhandelbaar)

### Algemeen
- **Taal:** alles in het **Nederlands** — UI, foutmeldingen, code-comments, commits.
- **TypeScript strict** — geen `any` zonder zeer goede reden, types in `src/types/`.
- **Geen overengineering.** Kleine, gerichte wijzigingen. Geen "preventive" refactors.
- **Geen overbodige fallbacks/validaties** voor scenario's die niet kunnen voorkomen.

### Styling
- **Native `StyleSheet.create({...})`** onderaan elk component-bestand.
- **Altijd tokens** uit `constants/theme.ts` — geen hardcoded hexes/sizes in screens.
- **Geen styled-components / NativeWind / Tailwind.**
- Inline-style alleen voor échte runtime-waarden (bv. `{ width: \`${pct}%\` }`).
- Flexbox-only — geen grid, geen `:hover`/`:focus`. `Pressable` met `style={({pressed}) => ...}`.

### State
- **UserContext** (`receptenboek_user`-key, AsyncStorage): email-string van de ingelogde gebruiker.
- **ShoppingListContext** (`receptenboek_shoppinglist_v1`-key): gegenereerde lijst + basket-state. Bij load: `refreshIconUrls` vernieuwt de iconen uit Supabase.
- **ToastProvider** (`useToast().show(msg, 'success'|'error'|'info')`) — 3 s, bottom 90 px.
- Component-state via `useState`/`useReducer`. Geen extra globale store.

### AsyncStorage-keys (volledige lijst)

| Key | Eigenaar | Waarde |
|---|---|---|
| `receptenboek_user` | `UserContext` | email-string ingelogde gebruiker |
| `receptenboek_shoppinglist_v1` | `ShoppingListContext` | JSON-blob (lijst + basket + persons) |
| `receptenboek_active_schedule_<email>` | `WeekScheduleScreen` | gegenereerd schema (vóór opslaan in DB) |
| `receptenboek_schedule_subtab_<email>` | `WeekScheduleScreen` | `'active'` of `'generate'` |
| `receptenboek_active_preset_<email>` | `WeekScheduleScreen` | `'today'` / `'today-tomorrow'` / `'week'` |
| `hh_health_disclaimer_seen_v1` | `HealthDisclaimerModal` | `'1'` na accept |
| `receptenboek_landing_tile_order_<email>` | `LandingScreen` | JSON-array van tegel-keys (eigen volgorde, v2.18.0) |
| `notif_seen_timeline_<email>` | `NotificationContext` | ISO-tijdstip "tijdlijn laatst gezien" |
| `notif_seen_chatrooms_<email>` | `NotificationContext` | ISO-tijdstip "chatruimtes laatst gezien" |

Gebruik altijd `<prefix>_<email>` voor per-user state (zoals WeekScheduleScreen doet), zodat het wisselen van account geen lekkage geeft.

### Cache (services)
- 30 s TTL (`cache.ts`). 5 min TTL voor `ingredientIcons.ts`.
- Roep `cacheInvalidate('<prefix>')` aan **na elke mutation** in de betreffende service.
- `clearCache()` wordt automatisch aangeroepen in `UserContext.logout` en bij `setUser`.

### Auth-model
- **Eén** auth-systeem: Supabase Auth. Legacy tabellen (`recipes/ratings/comments/favorites/schedules`) keyen op email-string `user_name`; nieuwe tabellen (`conversations`, community-tabellen) keyen op `auth.users.id` (UUID).
- JWT: altijd via `supabase.auth.getSession()` (níét cachen — auto-refresh).
- Vercel-calls: `Authorization: Bearer <jwt>` (zie `hapjesheld.ts::getAuthToken`).
- Signup-flow (4 stappen, zie `auth.ts::signUp`): whitelist check → Supabase `signUp` → mark `post_registered=true` → directe `signIn`.

### Image-handling (HapjesHeld)
- Galerij/camera via `expo-image-picker`, dan **altijd** door `expo-image-manipulator`: resize tot maxWidth 1600 px, re-encode JPEG, EXIF-strip.
- Quality loop: 0.85 → 0.70 → 0.55 → 0.40 → 0.30 totdat onder 3 MB.
- Server controleert dagelijks limiet (50/user) **en** rate-limit (max 50/uur). 429 → toast tonen, geen chat-bubble.

### Git / commits
- Commit messages in **Nederlands**, kort en concreet (zie recente commits, bv. `HapjesHeld: klikbare links + HealthDisclaimer + app v2.0.2`).
- Geen "feat:" / "chore:" prefixen — natuurlijke taal.
- Branch `main` = productie. Grotere features → feature branch + merge.

### Versionering
- `app.json.expo.version` = user-facing string (huidig `3.0.0`).
- `app.json.ios.buildNumber` (`63`) + `app.json.android.versionCode` (`67`) bumpen bij elke store-release. EAS productie heeft `autoIncrement: true`.
- `package.json.version` wordt **niet** actief gebruikt — niet syncen.

---

## 9. Werkwijze met Claude

### Wat Claude WEL mag zonder vragen
- Bestaande bugs fixen met duidelijke root cause.
- Bestanden lezen om context op te bouwen.
- Kleine UI-tweaks op expliciet verzoek.
- Nieuwe service-functie volgens bestaand patroon (kopieer `hapjesheld.ts` voor Vercel, `recipes.ts` voor Supabase-direct).
- Nieuw scherm + navigatie-entry volgens screen+service-patroon.
- **CLAUDE.md zelf bijwerken** zodra er iets wezenlijk wijzigt (nieuwe service, screen, conventie, key, valkuil). Eén regel mag.
- **Waarschuwen voor sessie-afsluiting** bij veel edits / klaar-feature / context-druk.

### Wat Claude EERST moet vragen
- Nieuwe npm-dependency aan `package.json` toevoegen (bundle-size + EAS-impact).
- Wijzigingen aan auth-flow / `UserContext`.
- DB-schema-wijzigingen (worden in het website-project uitgevoerd, niet hier).
- Wijzigingen aan `RAG_API_URL` / backend-koppeling.
- Refactors die >2-3 bestanden raken.
- Versie-bumps voor App/Play Store.
- Kleurthema / design-tokens aanpassen.

### Wat Claude NOOIT doet
- Eject naar bare RN zonder bevestiging.
- TS-strict uitzetten of `// @ts-ignore` zonder uitleg.
- Pushen naar `main` zonder bevestiging.
- Secrets, `.env*`, of `google-service-account.json` lezen/wijzigen/committen.
- "Voor de zekerheid" code refactoren die niet gevraagd is.
- Tests/comments toevoegen aan code die niet gewijzigd is.
- Een nieuwe state-library (Redux/Zustand/Jotai) introduceren — Contexts volstaan.

---

## 10. Env-vars & secrets

```
EXPO_PUBLIC_RAG_API_URL    optioneel, override van community-web.prilleven.be
```

- **Supabase URL + anon key** staan hardcoded in `src/lib/supabase.ts` — publiek = OK, identiek aan webversie.
- **Geen service-role key** in de mobiele app. Schrijfacties die service-role vereisen (community-posts, chatruimtes, profiel) gaan via de Vercel-API.
- `google-service-account.json` blijft lokaal voor `eas submit`, **nooit committen**.
- `eas.json` bevat `production.android.serviceAccountKeyPath` + `production.ios.ascAppId`.

---

## 11. Backends — wie doet wat?

| Bron | Doel | Mobiele caller |
|---|---|---|
| `supabase.from('recipes')` | Recepten | `services/recipes.ts` |
| `supabase.from('ratings')` | Sterren | `services/ratings.ts` |
| `supabase.from('comments')` | Reacties | `services/comments.ts` |
| `supabase.from('favorites')` | Favorieten | `services/favorites.ts` |
| `supabase.from('schedules')` | Opgeslagen + actief weekschema | `services/schedules.ts` |
| `supabase.from('ingredient_icons')` | Custom icoon-mapping | `services/ingredientIcons.ts` |
| `…/api/chat` | RAG-chat | `services/hapjesheld.ts::sendChatMessage` |
| `…/api/profile` GET | Quota + profiel (chat-mount) | `hapjesheld.ts::getProfile` |
| `…/api/profile` GET/PUT | Memory-toggle | `services/profile.ts::getMemoryEnabled` / `setMemoryEnabled` |
| `…/api/me` GET | GDPR data-export (JSON download) | `services/profile.ts::exportUserData` |
| `…/api/me` DELETE | GDPR account-verwijdering | `services/profile.ts::deleteAccount` |
| `…/api/conversations*` | Chatgeschiedenis | `hapjesheld.ts` |
| `…/api/community/posts` GET/POST | Tijdlijn-feed (cursor via `before`; server merget gevolgde chatroom-topics in als `source_type==='chatroom'`) + post maken | `services/community.ts::listPosts` / `createPost` |
| `…/api/community/posts/:id/like` POST | Like toggle → `{ liked, count }` | `services/community.ts::togglePostLike` |
| `…/api/community/posts/:id` PATCH/DELETE | Eigen post bewerken/verwijderen (owner-check, geen edit-window) | `services/community.ts::editPost` / `deletePost` |
| `…/api/community/posts/:id/replies` GET/POST | Replies lezen + plaatsen | `services/community.ts::listReplies` / `createReply` |
| `…/api/community/replies/:id/like` POST | Reply-like toggle → `{ liked, count }` | `services/community.ts::toggleReplyLike` |
| `…/api/community/replies/:id` PATCH/DELETE | Eigen reply bewerken/verwijderen | `services/community.ts::editReply` / `deleteReply` |
| `…/api/subscription-status?email=` GET | `is_admin`-check (admin-only composer) | `services/community.ts::getIsAdmin` |
| `…/api/community/*` | **(toekomst)** polls, foto's, rapporteren, notificaties | `services/community.ts` (uitbreiding) |
| `…/api/chat-rooms` GET | Roomlijst (gesorteerd op `sort_order`) + `is_followed` | `services/chatRooms.ts::listRooms` |
| `…/api/chat-rooms/unread` GET | Ongelezen-tellingen per gevolgde room/topic | `services/chatRooms.ts::getUnread` |
| `…/api/chat-rooms/:slug` GET | Eén room + topics (gepind eerst) + `admin_intro` + `is_followed` | `services/chatRooms.ts::getRoom` |
| `…/api/chat-rooms/:slug/follow` POST/DELETE | Chatruimte volgen / ontvolgen | `services/chatRooms.ts::followRoom` / `unfollowRoom` |
| `…/api/chat-rooms/:slug/read` POST | `last_read_at` bijwerken (ongelezen-badge resetten) | `services/chatRooms.ts::markRoomRead` |
| `…/api/chat-rooms/:slug/topics` POST | Topic aanmaken `{ title, body }` (201) | `services/chatRooms.ts::createTopic` |
| `…/api/chat-rooms/topics/:id` GET/PATCH/DELETE | Topic + replies lezen (`+ is_followed`) / bewerken (15min) / wissen (eigen) | `services/chatRooms.ts::getTopic` / `updateTopic` / `deleteTopic` |
| `…/api/chat-rooms/topics/:id/follow` POST/DELETE | Eén topic volgen / ontvolgen (verschijnt op tijdlijn) | `services/chatRooms.ts::followTopic` / `unfollowTopic` |
| `…/api/chat-rooms/topics/:id/read` POST | Topic `last_read_at` bijwerken (silent fail) | `services/chatRooms.ts::markTopicRead` |
| `…/api/chat-rooms/topics/:id/pin` POST `{ pin? }` | **Admin** topic vastpinnen/losmaken → `{ id, is_pinned }` | `services/chatRooms.ts::pinTopic` |
| `…/api/chat-rooms/:slug` PATCH `{ admin_intro_message?, title?, description? }` | **Admin** welkomsbericht zetten (string)/wissen (null) + room-meta → `{ room }` | `services/chatRooms.ts::updateRoom` |
| `…/api/chat-rooms/topics/:id/replies` POST | Reply plaatsen `{ body }` (201) | `services/chatRooms.ts::createReply` |
| `…/api/chat-rooms/replies/:id` PATCH/DELETE | Reply bewerken (15min) / wissen (eigen) | `services/chatRooms.ts::updateReply` / `deleteReply` |
| `…/api/community/posts/:id/pin` POST `{ pin? }` | **Admin** tijdlijn-post vastpinnen/losmaken (MAX_PINNED → 409) → `{ is_pinned }` | `services/community.ts::togglePostPin` |
| `…/api/community/profile` GET/PUT | Community-profiel (nickname + avatar) | `services/communityProfile.ts::getCommunityProfile` / `updateCommunityProfile` |
| `…/api/community/profile/avatar-url` POST | Signed upload-URL voor avatar | `services/communityProfile.ts::getAvatarUploadUrl` |
| `…/api/children` GET/POST/PATCH/DELETE | Kinderen-CRUD (soft delete) | `services/children.ts::getChildren` / `createChild` / `updateChild` / `archiveChild` |
| `…/api/family` GET/PUT | Gezins-dieet (9 keys, max 9 items) | `services/family.ts::getFamilyDiet` / `setFamilyDiet` |
| `…/api/memory` GET/DELETE | HapjesHeld memories-lijst (list + single + delete-all) | `services/memory.ts::getMemories` / `deleteMemory` / `deleteAllMemories` |
| `…/api/eerste-hapjes/state` GET/PATCH | Allergeen-state per kind (readiness + pause + dietary + meals_per_day) | `services/eersteHapjes.ts::getEhState` / `patchEhState` |
| `…/api/eerste-hapjes/doses` GET/POST | Doses-log (3 per allergeen, reactie geen/mild/ernstig) | `services/eersteHapjes.ts::getEhDoses` / `createEhDose` |
| `…/api/eerste-hapjes/doses/:id` PATCH/DELETE | Dose bewerken of wissen | `services/eersteHapjes.ts::updateEhDose` / `deleteEhDose` |
| `…/api/eerste-hapjes/symptoms*` | Symptoom-log per kind (CRUD) + server-side `red_flag` flag o.b.v. `RED_FLAG_SEVERITIES` | `services/eersteHapjes.ts` (v2.6.0) |
| `…/api/learnings` GET (?kind=, ?favorites=1) | Learnings-bibliotheek (lijst) | `services/learnings.ts::getLearnings` (v2.17.0) |
| `…/api/learnings/:id` GET | Learning-detail (incl. `signed_url` pdf/video of `body_html` blog) | `services/learnings.ts::getLearning` (v2.17.0) |
| `…/api/learnings/:id/favorite` POST | Favoriet togglen | `services/learnings.ts::toggleLearningFavorite` (v2.17.0) |
| `…/api/learnings/:id/bookmark` GET/PUT | Bladwijzer/positie (pdf page_nr / video seconds / blog scroll_px), gedeeld met website | `services/learnings.ts::getLearningBookmark` / `putLearningBookmark` (v2.18.0) |
| Supabase RPC `match_*` | Server-side — **niet** vanuit mobile aanroepen | — |

**Regel:** alles wat in de webversie via `/api/*` op `community-web.prilleven.be` loopt, loopt in de mobiele app ook via diezelfde URL — niet duplicaten.

---

## 12. Bekende valkuilen

- **Twee user-key systemen.** Legacy DB-tabellen keyen op email-string (`user_name`). Nieuwe op `auth.users.id` (UUID). Bij elke nieuwe query: kies bewust.
- **30 s in-memory cache** kan stale data tonen na een mutation. Roep `cacheInvalidate(prefix)` aan in de service zelf, **niet** in screens.
- **Token-verval** tijdens lange sessies. Altijd `supabase.auth.getSession()` voor elke authed fetch (zie `getAuthToken`) — niet cachen.
- **Whitelist (`allowed_users`)** moet vóór elke signup. Niet omzeilen.
- **HapjesHeld image-pipeline** (3 MB, JPEG, EXIF-strip) is privacy-kritisch — niet wijzigen zonder bevestiging.
- **Rate-limits/quota** komen server-side via HTTP 429 met NL-message. Toon als toast, niet als chat-bubble. Refresh daarna `getProfile()` zodat barometer en image-counter accuraat blijven.
- **iOS-permissies** zitten in `app.json.ios.infoPlist` (`NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`). Nieuwe permissies altijd in NL — anders rejection in App Store review.
- **`navigation.getParent()`-cascade.** Vanuit een screen in een sub-stack in MainTabs is Landing 2 levels omhoog: `navigation.getParent()?.getParent()?.goBack()`. Vanuit MainTabs direct: 1 level.
- **Per-user AsyncStorage-keys.** Suffix met email om data-lekkage tussen accounts te vermijden (zie `WeekScheduleScreen` patroon).
- **Health-disclaimer modal** wordt 1× per device getoond (`hh_health_disclaimer_seen_v1`). Verplicht voor Google Play "Beleid voor content over en services voor gezondheid".

---

## 13. Lokaal draaien

```bash
npm install
npm start                            # Expo dev server (Metro)
npm run ios                          # iOS Simulator (vereist Xcode)
npm run android                      # Android emulator (vereist Android Studio)
```

Expo Go op fysiek toestel: scan QR uit `npm start`.

**EAS** (TestFlight / Play Internal):
```bash
eas build --platform ios --profile production
eas build --platform android --profile production
eas submit --platform ios
eas submit --platform android
```

Profielen in `eas.json`:
- `development` → APK met dev-client + internal distribution.
- `preview` → APK met internal distribution.
- `production` → `app-bundle` (Android) + `autoIncrement: true` (iOS+Android).

---

## 14. Roadmap (web → mobile)

Bron: `Project_weekschema_Productie/PLAN-TIMELINE.md` (web v3.0.0).

1. ✅ **HapjesHeld 2.0 RAG-chat** — gedaan in mobile v2.0.0.
2. 🟡 **Profiel** — fundament voor de rest (avatars + nicknames hergebruikt door tijdlijn + chatruimtes).
   - ✅ MVP in v2.0.3: e-mail + uitloggen, memory-toggle, GDPR-export, GDPR-delete.
   - ✅ Community-profiel (nickname + avatar) in v2.1.0.
   - ✅ Kinderen-CRUD (parity met website-UI: naam, geboortedatum, allergieën, eerdere reacties, opmerkingen) in v2.2.1.
   - ✅ Gezins-dieet (9 chips, autosave met debounce + inflight-queue) in v2.3.0.
   - ✅ Memories-lijst (bekijken + delete-one + delete-all) in v2.5.0.
3. 🟡 **Allergenen-introductieflow** — 9 hoofdallergenen (kippen-ei, pinda, noten, sesam, vis, schaaldieren, soja, tarwe, koemelk), doses + symptoomlog (mild/twijfel/ernstig).
   - ✅ MVP in v2.5.0: state + doses (CRUD), allergeen-grid per kind, status-derivatie (veilig/bezig/wacht/allergisch/paused/locked-age), cooldown-banner (2 dagen), dose-form (1-3 + reactie geen/mild/ernstig + datum + notes).
   - ✅ v2.6.0: symptomen-log (16 types × 3 severities, CRUD), live red-flag detectie (mirror van server) met danger-banner in symptoom-form; `ademhaling`/`lethargie` triggeren al bij `mild`. Entry verplaatst van `ChildrenScreen` naar 3de landing-tile → `AllergenenChildrenScreen` (kind-picker) → `EersteHapjes` → `SymptomLog`/`DoseForm`.
   - ✅ v2.8.4: timezone-fix in `validateBirthdate` (lokale getters i.p.v. UTC).
   - ✅ v2.8.5–v2.8.6: setup-flow ("Reeds geïntroduceerd?"-card met `pre_introduced` checkbox-grid + foto-achtergronden + `LinearGradient` sage-overlay) + welcome-card (🍽-icoon + Start-CTA als `state.started !== true`).
   - ✅ v2.8.7: SymptomFormScreen linked-allergen-unie (doses + pre_introduced + known_allergies via Set), parity met website `computeIntroducedKeys()`.
   - ✅ v2.8.8: intro-text onder header in EersteHapjesScreen (parity met `.allergenen-intro`).
   - ✅ v2.8.9: pause-flow basis — Hoeveelheden-box + Symptoom-loggen-knop worden verborgen zolang `state.paused === true` (gebruiker moet eerst pause-flow doorlopen).
   - ✅ v2.9.1: volledige pause-wizard — 3-staps modal (Gelezen → arts gecontacteerd → allergisch ja/nee), auto-trigger bij reactie matig/heftig in `SymptomFormScreen`, callbacks `advancePauseStep`/`handleAllergyConfirmed`/`handleAllergyDenied` in `EersteHapjesScreen`.
   - ✅ v2.9.0–v2.9.1: arts-toezicht-modus — exclude/include-toggle per allergeen-tegel ("Overslaan"/"Opnemen", text-only knop rechtsonder absolute in ImageBackground zodat foto over hele gesloten tegel blijft); nieuwe `'excluded'` status (🚫 Overgeslagen). Patch via `allergen_state.excluded_keys`.
   - ✅ Allergenen-introductie is feature-compleet t.o.v. web. (Er is géén "readiness-checklist" op de webversie — dat was een foutieve aanname in oudere docs.)
4. 🟡 **Community-tijdlijn** — posts, replies, likes, polls, foto's, notificaties.
   - ✅ v2.10.0: footer-navigatie op de landing (3 tabs: Functies / Tijdlijn / Chatruimtes via `LandingTabs`). Tijdlijn-MVP: tekst-feed lezen (cursor-paginatie), liken (optimistic), replies lazy-load + plaatsen, admin-only tekst-composer (`getIsAdmin`-check). `services/community.ts` + `TimelineScreen`.
   - ✅ v2.12.0: eigen post + reply bewerken/verwijderen (owner-check server-side, geen edit-window; inline edit-TextInput + `Alert`-confirm delete). `editPost`/`deletePost`/`editReply`/`deleteReply` in `services/community.ts`.
   - ✅ v2.12.1: reply-likes (hartje + teller per reactie, optimistic toggle via `toggleReplyLike`).
   - ✅ v2.13.0: in-app notificatie-badges (rode cijfer-rondjes) op de footer-tabs — zie roadmap-punt 6.
   - ✅ v2.16.0: admin kan tijdlijn-posts vastpinnen/losmaken (bookmark-knop in de post-header naast edit/delete, zichtbaar voor admins ook op niet-eigen posts; `togglePostPin`). `onPinChanged` werkt de post lokaal bij + stabiele sort zet gepinde posts bovenaan (mirror server-feed waar gepinde posts eerst komen). MAX_PINNED-overschrijding → 409 met NL-toast.
   - ⬜ Open: foto-upload bij post, polls, rapporteren. (Categorie-filterbalk is op de website verwijderd → niet meer bouwen.)
5. 🟡 **Chatruimtes** — categorische rooms (Melk & voeding, Eerste hapjes, Allergieën & overgevoeligheden, Feedback) + topics.
   - ✅ v2.10.0: placeholder-scherm "binnenkort" als 3de footer-tab.
   - ✅ v2.11.0: volledige CRUD-MVP. `services/chatRooms.ts` + `ChatRoomsStack` (RoomList → ChatRoom → ChatTopic → ChatTopicForm). Rooms lezen, topics lezen/plaatsen, replies lezen/plaatsen, eigen topic/reply bewerken (15min-venster) + wissen, admin-welkomsbericht read-only bovenaan een room.
   - ✅ v2.14.0: chatruimtes volgen — "Volg"/"Gevolgd"-toggle in de room-header (`followRoom`/`unfollowRoom`, optimistisch + rollback), ongelezen-badge + gevolgd-stip op de roomlijst via `getUnread()`, `markRoomRead` reset de badge bij openen van een gevolgde room (parity met website `api/chat-rooms.mjs`).
   - ✅ v2.15.0: gevolgde topics zichtbaar op de tijdlijn — de server merget gevolgde chatroom-topics al in `GET /api/community/posts` (`source_type==='chatroom'`); `TimelineScreen` filtert ze niet meer weg maar rendert ze als `ChatroomTopicCard` (bron-badge + titel + snippet + "Open discussie"), tik → cross-tab naar `ChatTopic`. Tijdlijn-notificatieteller telt nu admin-posts + alle nieuwe gevolgde chatroom-items op (`countNewAdminTimelinePosts`, parity met website timeline-feed).
   - ✅ v2.16.0: drie admin/volg-features parity met website:
     - **Topic-follow** in `ChatTopicScreen`: "Volg"/"Gevolgd"-knop in de header (`followTopic`/`unfollowTopic`, optimistisch), `getTopic` levert `is_followed`, bij openen van een gevolgd topic `markTopicRead`. Gevolgde topics verschijnen automatisch op de tijdlijn (server merget directe topic-followers al in de feed → geen extra tijdlijn-werk).
     - **Topic pinnen (admin)** in `ChatTopicScreen` (bookmark-actie in `TopicHeader`, "Vastpinnen"/"Losmaken") + per topic-card in `ChatRoomScreen` (bookmark-knop in de foot-row, optimistisch + her-sorteren via `sortTopics` gepind-eerst). `pinTopic(topicId, pin?)`.
     - **Admin-welkomsbericht bewerken** in `ChatRoomScreen`: `IntroSection`-component toont read-only `AdminIntroCard` voor iedereen; admins krijgen Bewerken/Verwijderen-knoppen of een "Welkomsbericht toevoegen"-CTA, met inline `TextInput`-editor (max `ADMIN_INTRO_MAX = 4000`). Opslaan → `updateRoom(slug, { admin_intro_message })`, verwijderen → `updateRoom(slug, { admin_intro_message: null })` na `Alert`-confirm.
   - ⬜ Open: notificaties (Expo Push).
6. 🟡 **Notificaties** — admin-post badges op de footer-tabs.
   - ✅ v2.13.0: in-app badges (rood rondje + cijfer "nieuw sinds laatst") op twee footer-tabs, gevoed door `NotificationContext` (poll 60s + AppState 'active'): **Tijdlijn** (prilleven-logo) toont nieuwe admin-posts in de community-feed; **Chatruimtes** toont de som van nieuwe admin-topics over alle rooms. Markeerpunt per gebruiker in AsyncStorage (`notif_seen_timeline_<email>` / `notif_seen_chatrooms_<email>`), wist bij focus op de tab (`markTimelineSeen` / `markChatroomsSeen`). Eerste run initialiseert markeerpunt op "nu". Telfuncties in `services/notifications.ts`.
   - ✅ v2.13.1: admin-modus — voor admins (`getIsAdmin`) tellen ALLE nieuwe posts/topics mee i.p.v. enkel admin-posts (`includeAllAuthors`-vlag in de telfuncties; admin-status één keer per gebruiker bepaald in `NotificationContext`).
   - ⬜ Open: Expo Push (server-side trigger), vervangt polling.
7. 🟡 **Learnings** — bibliotheek met documenten, blogs en video's (admins beheren op de website).
   - ✅ v2.17.0: read-only viewer (4de landing-tile "Learnings" + `Functies`-tab is nu de default-tab). `services/learnings.ts` + `LearningsScreen` (lijst + zoeken + type-filter + favorieten) + `LearningDetailScreen` (blog → `react-native-webview`, video → `expo-video`, pdf → `expo-web-browser` in-app browser). Favoriet togglen werkt; aanmaken/bewerken/verwijderen blijft op de website. Notities/clips/bookmarks bewust buiten scope.
   - ✅ v2.18.0: eigen PDF.js-viewer (`LearningPdfScreen`, vervangt in-app browser voor pdf) + **bladwijzer-sync** (pdf page_nr) + **video-positie sync** (seconds) via `/api/learnings/:id/bookmark`, gedeeld met de website. Geen download-knop in de pdf-viewer (parity).
   - ⬜ Open: blog `scroll_px`-sync + notities/clips (indien ooit gewenst op mobiel).

**Werkvolgorde per feature:**
1. CLAUDE.md uitbreiden (nieuwe service/screen toevoegen aan §3/§5/§6/§11).
2. Service-laag (`src/services/<feature>.ts`) + types.
3. Screen(s) + navigatie-entry in juiste stack/types.
4. Toast + error-handling + cache-invalidatie.
5. Version-bump (`app.json.version`, builds auto-increment).
6. EAS preview build → toestel-test.
7. Merge naar `main` + production-build wanneer ok.

---

## 15. Communicatiestijl van Claude

- Antwoord in het **Nederlands**.
- Beknopt — geen lange inleidingen of samenvattingen achteraf.
- Bij twijfel: vragen, niet gokken.
- Bij meerdere mogelijke aanpakken: kort de opties geven, niet zelf kiezen.
- Geen tijdsschattingen ("dit duurt 5 min").
- SQL of grote code-blokken die de gebruiker handmatig moet uitvoeren: altijd in de chat plakken, kopieerbaar.
- Direct, eerlijk, technisch correct boven aardig zijn — geen "Je hebt helemaal gelijk"-validatie.
