# Prilleven Receptenboek — Apple Build Guide (App Store)

## Overzicht
Dit document beschrijft hoe je de iOS-versie van de Prilleven Receptenboek app bouwt en publiceert op de Apple App Store.

> ⚠️ **Status**: Nog niet geconfigureerd. Dit document wordt bijgewerkt wanneer de Apple build wordt opgezet.

---

## Vereisten

- **Apple Developer Account** ($99/jaar): https://developer.apple.com
- **EAS CLI** geïnstalleerd: `npm install -g eas-cli`
- **Expo account** met organisatie `prilleven`
- **Apple ID** van de ontwikkelaar
- **Mac** is NIET vereist (EAS bouwt in de cloud)

---

## Projectconfiguratie

### app.json (belangrijke iOS-velden)
| Veld | Waarde |
|------|--------|
| `ios.bundleIdentifier` | be.prilleven.mobileapp |
| `ios.buildNumber` | 1 |
| `ios.supportsTablet` | true |

### eas.json submit configuratie (nog in te vullen)
```json
"submit": {
  "production": {
    "ios": {
      "appleId": "jouw-apple-id@email.com",
      "ascAppId": "APP_STORE_CONNECT_APP_ID"
    }
  }
}
```

---

## Stappen om iOS build te starten

### Stap 1: Apple Developer Account
1. Ga naar https://developer.apple.com/account
2. Schrijf je in voor het Apple Developer Program ($99/jaar)
3. Wacht op goedkeuring (kan 24-48 uur duren)

### Stap 2: App registreren in App Store Connect
1. Ga naar https://appstoreconnect.apple.com
2. Klik "My Apps" > "+" > "New App"
3. Vul in:
   - **Bundle ID**: be.prilleven.mobileapp
   - **Name**: Prilleven Receptenboek
   - **Primary Language**: Dutch
   - **SKU**: prilleven-receptenboek

### Stap 3: EAS configureren
```bash
# Apple credentials worden automatisch beheerd door EAS
eas build --platform ios --profile production
```
EAS zal vragen om:
- Apple ID en wachtwoord
- App-specifiek wachtwoord (als 2FA is ingeschakeld)

### Stap 4: Build starten
```bash
eas build --platform ios --profile production
```

### Stap 5: Uploaden naar App Store
```bash
eas submit --platform ios --profile production
```

---

## App Store listing vereisten

### Screenshots (verplicht)
- **iPhone 6.9"** (1320 x 2868 of equivalent): minimaal 2
- **iPhone 6.7"** (1290 x 2796): minimaal 2
- **iPad 13"** (2064 x 2752): als tablet support aan staat

### Tekst
- **App naam**: max 30 tekens
- **Ondertitel**: max 30 tekens
- **Beschrijving**: verplicht
- **Trefwoorden**: max 100 tekens
- **Privacybeleid URL**: verplicht

### App icoon
- 1024x1024 PNG (geen transparantie, geen alfa-kanaal)

### Leeftijdsclassificatie
- Vul de App Store vragenlijst in

---

## TODO bij Apple build
- [ ] Apple Developer Account aanmaken/verifiëren
- [ ] App registreren in App Store Connect
- [ ] Apple ID en ASC App ID invullen in eas.json
- [ ] App-icoon maken (1024x1024, geen transparantie)
- [ ] Screenshots maken voor iPhone en iPad
- [ ] Privacybeleid pagina aanmaken
- [ ] Build starten en uploaden

---

## Belangrijke links
- Apple Developer: https://developer.apple.com
- App Store Connect: https://appstoreconnect.apple.com
- EAS Dashboard: https://expo.dev/accounts/prilleven/projects/prilleven-mobile-app
