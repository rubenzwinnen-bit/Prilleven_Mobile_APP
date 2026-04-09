# 🍳 Prilleven Receptenboek — Mobile App

Native mobile versie van de Prilleven receptenwebsite, gebouwd met **Expo + React Native + Supabase**. De app spiegelt het design en alle features van de bestaande webversie (`project_weekschema`) — zelfde Supabase-database, zelfde tabellen, zelfde gebruiksflow.

## ✨ Features

- 📖 **Recepten** — Doorzoek en filter alle recepten op naam, eetmoment en allergenen
- ⭐ **Sterren & commentaren** — Beoordeel recepten en lees wat anderen ervan vinden
- ❤️ **Favorieten** — Bewaar je favoriete recepten per gebruikersnaam
- 📅 **Weekschema** — Laat de app automatisch een gevarieerd weekschema genereren (5 maaltijden × 7 dagen) met allergenen-filter
- 💾 **Opgeslagen weekschema's** — Bewaar je favoriete weekschema's en haal ze later op
- 🛒 **Visuele boodschappenlijst** — Tik op een vierkante ingrediënt-tegel om hem in je winkelmandje te plaatsen
- 👤 **Gebruikersnaam** — Eerste launch vraagt om een naam (bewaard in `AsyncStorage`); favorieten en ratings zijn per gebruiker

## 🎨 Design

Gebaseerd op de website (terracotta `#C98966` + sage groen `#98C3A4`). Theme-tokens staan in [`src/constants/theme.ts`](src/constants/theme.ts).

## 🏗️ Architectuur

```
App.tsx                          ← SafeArea + Toast + UserProvider + Tab/Stack-navigatie
src/
├── constants/
│   ├── theme.ts                 ← kleuren, spacing, schaduwen, radius
│   ├── data.ts                  ← weekdagen, slots, allergenen, eetmomenten
│   └── ingredientIcons.ts       ← emoji-mapping voor de boodschappenlijst-tegels
├── lib/
│   ├── supabase.ts              ← Supabase client (AsyncStorage als session-storage)
│   └── store.ts                 ← CRUD-laag met 30s in-memory cache
├── context/
│   └── UserContext.tsx          ← huidige gebruikersnaam (AsyncStorage)
├── components/
│   ├── RecipeCard.tsx
│   ├── Stars.tsx
│   ├── Toast.tsx
│   └── UsernameModal.tsx
├── screens/
│   ├── RecipeListScreen.tsx
│   ├── RecipeDetailScreen.tsx
│   ├── FavoritesScreen.tsx
│   ├── WeekScheduleScreen.tsx
│   └── ShoppingListScreen.tsx
└── types/
    └── index.ts
```

### Navigatie

Drie tabs, ieder met een eigen native stack:

- **Recepten** → `RecipeList → RecipeDetail`
- **Weekschema** → `WeekSchedule → ShoppingList → RecipeDetail`
- **Favorieten** → `FavoritesList → RecipeDetail / ShoppingList`

## 🚀 Lokaal draaien

```bash
# Dependencies (al gebeurd, maar voor een verse clone)
npm install

# Start de Expo dev server
npm start

# Of direct op een device / simulator
npm run ios       # macOS + Xcode nodig
npm run android   # Android Studio + emulator nodig
```

Scan de QR-code met de **Expo Go** app op je telefoon om hem live te testen.

## 🗄️ Supabase

De app gebruikt **dezelfde Supabase-database** als de webversie. Geen extra setup nodig — de URL en anon-key staan in [`src/lib/supabase.ts`](src/lib/supabase.ts) en werken meteen.

Tabellen die gebruikt worden:

- `recipes` — alle recepten met ingrediënten, instructies, allergenen, eetmoment
- `ratings` — sterren per gebruiker per recept
- `comments` — commentaren per recept
- `favorites` — favoriete recepten per gebruikersnaam
- `schedules` — opgeslagen weekschema's per gebruikersnaam

> **Hoeft Supabase nog opgezet te worden?**
> Nee — als de webversie werkt, werkt deze app ook. Zelfde database = data is direct zichtbaar.

## 📱 Hoeft React Native nog opgezet te worden?

Niet apart, nee. **Expo** zorgt voor de hele toolchain (Metro, builds, native modules). Je hoeft Xcode of Android Studio alleen te installeren als je een eigen build wil maken — voor dagelijks ontwikkelen volstaat **Expo Go** op je telefoon.

## 🔼 Pushen naar GitHub

De repo op GitHub bestaat al (`Prilleven_Mobile_APP`). Eerste push vanaf deze map:

```bash
cd ~/Desktop/Prilleven_MOBILE_APP

# (alleen eerste keer) zet de remote
git remote add origin https://github.com/<jouw-username>/Prilleven_Mobile_APP.git

# Push naar main
git branch -M main
git push -u origin main
```

Daarna voor elke wijziging:

```bash
git add .
git commit -m "korte beschrijving"
git push
```

## 🤝 Expo / EAS

Je GitHub is al gekoppeld aan Expo. Om een native build te maken:

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform ios       # of: android
```

## 📝 Volgende stappen

- [ ] App-icoon en splash screen aanpassen (`app.json` + `assets/`)
- [ ] Push notifications voor nieuwe recepten
- [ ] Offline-modus (cache recepten in AsyncStorage)
- [ ] Foto's lokaal opslaan voor snellere lijsten
