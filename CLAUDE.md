# CLAUDE.md — Pril Leven Mobile App

Lees dit ALTIJD eerst voordat je code wijzigt. Dit document is geschreven op basis van een volledige lezing van de codebase op `v2.1.0`. Toekomstige Claude-sessies moeten dit bijwerken zodra de waarheid afwijkt.

> Zusterproject: de **web-app** in `~/Desktop/Project_weekschema_Productie/` heeft een eigen, uitgebreide `CLAUDE.md` per laag (root, `/js`, `/api`, `/supabase-migrations`). De mobiele app deelt **dezelfde Supabase-database en dezelfde Vercel-API** als de web-app — niet duplicaten.

---

## 1. Project in 1 alinea

**Pril Leven Mobile** is de native (iOS + Android) variant van `community-web.prilleven.be`. Zelfde Supabase-DB, zelfde Vercel-functions als backend — geen aparte server. Doel: stap voor stap optrekken naar feature-pariteit met web v3.x. Doelgroep: Nederlandstalig (Vlaanderen). Toegang via Supabase Auth + `allowed_users`-whitelist (gevuld door Plug&Pay-webhook aan de web-zijde).

---

## 2. Tech stack

| Onderdeel | Versie / keuze |
|---|---|
| React Native | `0.81.5` |
| Expo | `~54.0.34` (managed workflow, `newArchEnabled: false`) |
| TypeScript | `~5.9.2`, `"strict": true` (zie `tsconfig.json`, extends `expo/tsconfig.base`) |
| Navigatie | `@react-navigation/native` v7 + `native-stack` + `bottom-tabs` |
| State | React Context (geen Redux/Zustand) |
| Persistentie | `@react-native-async-storage/async-storage` |
| DB + Auth | `@supabase/supabase-js` 2.45 → project `ynrdoxukevhzupjvcjuw` |
| RAG-chat / community / chatruimtes / profiel | Vercel functions op `https://community-web.prilleven.be` |
| Icons | `@expo/vector-icons` (Feather) + `react-native-svg` |
| Image | `expo-image-picker` + `expo-image-manipulator` |
| File/share (GDPR-export) | `expo-file-system` (~19) `File`/`Paths` API + `expo-sharing` |
| Build/release | EAS, project-id `996391c7-00d0-4d2e-8113-fa3f9b79e0a9`, owner `prilleven` |
| iOS bundle | `be.prilleven.mobileapp`, ascAppId `6762270908`, buildNumber `11` |
| Android pkg | `be.prilleven.mobileapp`, versionCode `15` |

Node ≥ 20 lokaal voor Expo CLI.

---

## 3. Mappenstructuur (concreet)

```
/
├── App.tsx                          provider-boom + AppGate (zie §4)
├── index.ts                         expo entry
├── app.json                         expo config (version 2.1.0, permissions in NL)
├── eas.json                         EAS profielen (development/preview/production)
├── tsconfig.json                    strict, extends expo/tsconfig.base
├── package.json                     dependencies
├── google-service-account.json      Play-credentials (gitignore!)
├── assets/                          icon, adaptive-icon, splash, prilleven-logo,
│                                    landing-recepten.jpeg, landing-hapjesheld.png
├── docs/                            ANDROID-BUILD-GUIDE.md, APPLE-BUILD-GUIDE.md
├── fotos/                           bron-fotos
├── supabase/                        optionele mirror van migrations (read-only)
└── src/
    ├── screens/                     1 bestand per scherm (§5)
    ├── components/                  Toast, RecipeCard, Stars, IngredientTile,
    │                                TabIcons, UsernameHeader, UsernameModal,
    │                                HealthDisclaimerModal, AvatarButton
    ├── navigation/                  RootStack, MainTabs (index.tsx),
    │                                RecipesStack, ScheduleStack, FavoritesStack,
    │                                HapjesHeldStack, types.ts
    ├── services/                    data-laag (Supabase + Vercel) — alle exports
    │                                via services/index.ts barrel
    ├── context/                     UserContext, ShoppingListContext
    ├── lib/                         supabase.ts (singleton client)
    ├── constants/                   theme, data, ingredientIcons
    └── types/                       index.ts (Recipe, Schedule, Comment, ...)
```

---

## 4. Provider-boom & navigatiestructuur

### 4.1 Providers (volgorde is bewust)

```
SafeAreaProvider
  └── ToastProvider          (useToast() overal beschikbaar)
        └── UserProvider     (Supabase sessie + AsyncStorage email)
              └── ShoppingListProvider
                    └── AppGate
                          ├── ActivityIndicator        (loading sessie)
                          ├── AuthScreen               (geen sessie)
                          └── NavigationContainer
                                └── RootStackNavigator (ingelogd)
```

`AppGate` leest `useUser().loading` en wisselt automatisch zodra `onAuthStateChange` triggert.

### 4.2 Navigatie-tree (huidige stand v2.1.0)

```
RootStack  (native-stack, vaak headerless of CompactHeader inline)
├── Landing                              src/screens/LandingScreen.tsx
├── Main → MainTabs (bottom-tabs)        src/navigation/index.tsx
│   ├── Recepten         → RecipesStack    (RecipeList → RecipeDetail)
│   ├── Weekschema       → ScheduleStack   (WeekSchedule → ShoppingList → RecipeDetail)
│   ├── Favorieten       → FavoritesStack  (FavoritesList → RecipeDetail / ShoppingList)
│   └── Boodschappenlijst → ShoppingListTabScreen   (geen sub-stack)
├── HapjesHeld → HapjesHeldStack        (Conversations → Chat)
└── Profile                              src/screens/ProfileScreen.tsx  (geopend via AvatarButton in Landing-header)
```

Types: `src/navigation/types.ts` — `RootStackParamList`, `MainTabParamList`, `RecipesStackParamList`, `ScheduleStackParamList`, `FavoritesStackParamList`, `HapjesHeldStackParamList`.

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

## 5. Schermen (huidige stand v2.1.0)

| Bestand | Belangrijkste functies |
|---|---|
| `AuthScreen.tsx` | 3 tabs (login/register/reset). Whitelist-check vóór signup. Logo + sage/primary kleuren. |
| `LandingScreen.tsx` | 2 grote `AnimatedTile`-tegels (spring scale 0.96 → 1) + `AvatarButton` rechtsboven die `Profile` opent. `useFocusEffect` refresht `community avatar_url` zodat een upload meteen zichtbaar is. |
| `ProfileScreen.tsx` | 4 secties: **Account** (e-mail + uitloggen), **Community** (nickname-input met regex-validatie + Opslaan-knop, avatar-blok met `AvatarButton`-preview + "Foto kiezen/wijzigen/Verwijderen", upload-pipeline: `expo-image-picker` → `expo-image-manipulator` resize 512px JPEG q=0.8 → signed Storage URL → `PUT /api/community/profile { avatar_path }`), **Voorkeuren & privacy** (HapjesHeld memory-toggle via `Switch`, optimistic + rollback), **Mijn gegevens** (GDPR-export via `File`/`Paths` + `Sharing.shareAsync`, GDPR-delete via 2-staps modal met `VERWIJDER`-bevestiging). Header: `ChevronBack` + titel. Lokale `ChevronBack` om require-cycle met RootStack te vermijden. |
| `RecipeListScreen.tsx` | Zoekbalk + filterpanel (eetmoment + allergeen chip-rijen). `Promise.all`-load. `FlatList` met `RefreshControl`. |
| `RecipeDetailScreen.tsx` | Foto, fav-toggle, info-tags, **portion-scaling** o.b.v. actief weekschema (`X = ceil(persons/portions)`), ingredients, steps, sterren + comments. |
| `WeekScheduleScreen.tsx` | 2 sub-tabs (`active` / `generate`), 3 presets (`today` / `today-tomorrow` / `week`). Genereer-knop + per-slot 🔄 refresh. Modal "Opslaan met naam". |
| `ShoppingListScreen.tsx` | Stap 1 boodschappenlijst: kies dagen × slots. Aggregeert ingredients met unit-normalisatie en `X × count` vermenigvuldiger, navigeert naar de Boodschappenlijst-tab. |
| `ShoppingListTabScreen.tsx` | Stap 2: visuele ingrediënt-tegels + winkelmandje (drag/tap). |
| `FavoritesScreen.tsx` | Sectie "Opgeslagen weekschema's" + sectie "Favoriete recepten". Activeren via `Alert.prompt` (aantal personen). |
| `HapjesHeldScreen.tsx` | RAG-chat met `UsageBar` (maand-€-budget), foto-counter (`remaining/limit`), `HealthDisclaimerModal`, link-parser voor assistant-tekst. |
| `ConversationsScreen.tsx` | Gesprekkenlijst met `useFocusEffect` + `RefreshControl`. Long-press → delete. |

**Nog te bouwen (zie §14):** kinderen-CRUD, gezins-dieet, `AllergenenScreen`, `TimelineScreen`, `ChatRoomsScreen`.

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
- `app.json.expo.version` = user-facing string (huidig `2.1.0`).
- `app.json.ios.buildNumber` (`11`) + `app.json.android.versionCode` (`15`) bumpen bij elke store-release. EAS productie heeft `autoIncrement: true`.
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
| `…/api/community/*` | **(toekomst)** tijdlijn, posts, replies, likes, polls | nieuwe `services/community.ts` |
| `…/api/chat-rooms/*` | **(toekomst)** chatruimtes | nieuwe `services/chatRooms.ts` |
| `…/api/community/me` | **(toekomst)** nickname + avatar | nieuwe `services/communityProfile.ts` |
| `…/api/children` | **(toekomst)** kinderen-CRUD | nieuwe `services/children.ts` |
| `…/api/family` | **(toekomst)** gezins-dieet | nieuwe `services/family.ts` |
| `…/api/memory` | **(toekomst)** HapjesHeld memories-lijst | nieuwe `services/memory.ts` |
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
   - ⬜ Volgende: community-profiel (nickname + avatar) → kinderen-CRUD → gezins-dieet → memories-lijst.
3. ⬜ **Allergenen-introductieflow** — 9 hoofdallergenen (kippen-ei, pinda, noten, sesam, vis, schaaldieren, soja, tarwe, koemelk), doses + symptoomlog (mild/twijfel/ernstig).
4. ⬜ **Community-tijdlijn** — posts, replies, likes, polls, foto's, notificaties.
5. ⬜ **Chatruimtes** — categorische rooms (Melk & voeding, Eerste hapjes, Allergieën, Feedback) + topics.
6. ⬜ **Push-notificaties** — Expo Push, vervangt polling.

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
