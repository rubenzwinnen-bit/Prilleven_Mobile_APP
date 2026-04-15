# Prilleven Receptenboek — Android Build Guide (Google Play)

## Overzicht
Dit document beschrijft hoe je de Android-versie van de Prilleven Receptenboek app bouwt en publiceert op Google Play.

---

## Vereisten

- **Node.js** 24+ geïnstalleerd
- **EAS CLI** geïnstalleerd: `npm install -g eas-cli`
- **Expo account** met organisatie `prilleven`
- **Google Play Console** account (geverifieerd)

### Inloggen
```bash
eas login
# Account: ruben_zwinnen / organisatie: prilleven
```

---

## Projectconfiguratie

### app.json (belangrijke Android-velden)
| Veld | Waarde |
|------|--------|
| `expo.name` | Prilleven Receptenboek |
| `expo.slug` | prilleven-mobile-app |
| `expo.version` | 1.0.0 |
| `expo.owner` | prilleven |
| `android.package` | be.prilleven.mobileapp |
| `android.versionCode` | automatisch verhoogd |
| `android.adaptiveIcon.backgroundColor` | #C98966 |
| EAS Project ID | 996391c7-00d0-4d2e-8113-fa3f9b79e0a9 |

### eas.json build profielen
| Profiel | Doel | Bestandstype |
|---------|------|-------------|
| `development` | Lokaal testen | APK |
| `preview` | Intern testen | APK |
| `production` | Google Play upload | AAB (app-bundle) |

---

## Build commando's

### Production build (voor Google Play)
```bash
eas build --platform android --profile production
```
Dit maakt een `.aab` bestand (Android App Bundle) aan in de cloud.

### Preview build (om te testen)
```bash
eas build --platform android --profile preview
```
Dit maakt een `.apk` bestand dat je direct op een Android-telefoon kunt installeren.

### Build status checken
```bash
eas build:list --platform android
```

---

## Publiceren op Google Play

### Stap 1: AAB downloaden
Na een succesvolle build download je het AAB-bestand via:
- De link in de terminal output, OF
- https://expo.dev/accounts/prilleven/projects/prilleven-mobile-app/builds

### Stap 2: App aanmaken in Google Play Console
1. Ga naar https://play.google.com/console
2. Klik "Maak je eerste app"
3. Vul in:
   - **App-naam**: Prilleven Receptenboek
   - **Standaardtaal**: Nederlands
   - **App-type**: App
   - **Gratis of betaald**: Gratis
4. Accepteer de verklaringen

### Stap 3: Store listing invullen
- **Korte beschrijving** (max 80 tekens)
- **Volledige beschrijving** (max 4000 tekens)
- **Screenshots**: minimaal 2 screenshots (telefoon)
- **App-icoon**: 512x512 PNG
- **Functieafbeelding**: 1024x500 PNG
- **Categorie**: Eten en drinken
- **Privacybeleid URL**: verplicht

### Stap 4: AAB uploaden
1. Ga naar "Productie" > "Releases"
2. Klik "Nieuwe release maken"
3. Upload het `.aab` bestand
4. Vul release-notities in
5. Klik "Beoordeling starten"

### Stap 5: Overige vereisten
- **Inhoudsclassificatie**: Vul de vragenlijst in
- **Doelgroep**: Selecteer leeftijdsgroepen
- **Data safety**: Geef aan welke data de app verzamelt
- **Privacybeleid**: Voeg een URL toe

---

## Signing (automatisch)
EAS beheert de Android signing key automatisch:
- **Keystore**: opgeslagen op Expo servers
- **Upload key**: automatisch gegenereerd
- Bij eerste upload naar Google Play wordt de app signing key gekoppeld

### Keystore downloaden (backup)
```bash
eas credentials --platform android
```

---

## Versioning
- `expo.version` = versie getoond aan gebruikers (bijv. "1.0.0")
- `android.versionCode` = intern versienummer (wordt automatisch verhoogd bij elke build)

### Versie verhogen voor update
Pas `expo.version` aan in `app.json`:
```json
"version": "1.1.0"
```
Dan opnieuw bouwen:
```bash
eas build --platform android --profile production
```

---

## Veelgestelde vragen

### Hoe lang duurt een build?
Gemiddeld 10-20 minuten op EAS cloud servers.

### Hoe update ik de app?
1. Verhoog `version` in app.json
2. Bouw opnieuw: `eas build --platform android --profile production`
3. Upload nieuw AAB naar Google Play Console
4. Maak nieuwe release aan

### Hoe lang duurt de Google Play review?
Eerste app: 1-7 dagen. Updates: meestal 1-3 dagen.

---

## Belangrijke links
- EAS Dashboard: https://expo.dev/accounts/prilleven/projects/prilleven-mobile-app
- Google Play Console: https://play.google.com/console
- Build logs: https://expo.dev/accounts/prilleven/projects/prilleven-mobile-app/builds
