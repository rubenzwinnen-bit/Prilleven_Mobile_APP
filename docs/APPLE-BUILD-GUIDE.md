# Prilleven Receptenboek — Apple Build Guide (App Store)

## Overzicht
Dit document beschrijft hoe je de iOS-versie van de Prilleven Receptenboek app bouwt en publiceert op de Apple App Store.

> ✅ **Status**: Geconfigureerd en eerste build gestart.

---

## Accounts en credentials

| Rol | Account | Email |
|-----|---------|-------|
| **Expo (EAS)** | ruben_zwinnen | ruben.zwinnen@hotmail.be |
| **Apple Developer** | Anneleen Plettinx (Account Holder) | leentje_plettinx@hotmail.com |
| **Apple Team ID** | MTXU526TZL | - |
| **Apple Provider ID** | 128783603 | - |

> **Let op**: Bij de eerste build moet je inloggen met het Apple ID van Anneleen (Account Holder). Daarna worden de credentials opgeslagen door EAS.

---

## Projectconfiguratie

### app.json (belangrijke iOS-velden)
| Veld | Waarde |
|------|--------|
| `ios.bundleIdentifier` | be.prilleven.mobileapp |
| `ios.buildNumber` | automatisch verhoogd |
| `ios.supportsTablet` | true |
| `ios.infoPlist.ITSAppUsesNonExemptEncryption` | false |
| EAS Project ID | 996391c7-00d0-4d2e-8113-fa3f9b79e0a9 |

### eas.json production profiel
```json
"production": {
  "autoIncrement": true,
  "ios": {
    "autoIncrement": true
  }
}
```

---

## Build commando's

### Production build (voor App Store)
```bash
eas build --platform ios --profile production
```
Dit maakt een `.ipa` bestand aan in de cloud.

### Build status checken
```bash
eas build:list --platform ios
```

### Uploaden naar App Store Connect
```bash
eas submit --platform ios
```

---

## Eerste keer bouwen (credentials setup)

Bij de eerste iOS build moet je interactief draaien (zonder `--non-interactive`):

```bash
eas build --platform ios --profile production
```

EAS vraagt dan:
1. **Apple ID**: `leentje_plettinx@hotmail.com`
2. **Wachtwoord**: Apple ID wachtwoord van Anneleen
3. **2FA code**: code die Anneleen ontvangt op haar device
4. **Distribution Certificate**: "Generate new" → Y
5. **Provisioning Profile**: "Generate new" → Y

Na de eerste keer worden credentials opgeslagen en kun je `--non-interactive` gebruiken.

---

## Publiceren op de App Store

### Stap 1: App aanmaken in App Store Connect
1. Ga naar https://appstoreconnect.apple.com
2. Klik "My Apps" > "+" > "New App"
3. Vul in:
   - **Bundle ID**: be.prilleven.mobileapp
   - **Name**: Prilleven Receptenboek
   - **Primary Language**: Dutch
   - **SKU**: prilleven-receptenboek

### Stap 2: IPA uploaden
Na succesvolle build:
```bash
eas submit --platform ios
```
Of download de IPA van de EAS dashboard en upload via Transporter app.

### Stap 3: App Store listing invullen
- **App naam**: max 30 tekens
- **Ondertitel**: max 30 tekens
- **Beschrijving**: verplicht
- **Trefwoorden**: max 100 tekens
- **Privacybeleid URL**: verplicht

### Screenshots (verplicht)
- **iPhone 6.9"** (1320 x 2868): minimaal 2
- **iPhone 6.7"** (1290 x 2796): minimaal 2
- **iPad 13"** (2064 x 2752): als tablet support aan staat

### App icoon
- 1024x1024 PNG (geen transparantie, geen alfa-kanaal)

### Stap 4: Review indienen
Vul de leeftijdsclassificatie en data safety in, en dien de app in voor review.

---

## Versioning
- `expo.version` = versie getoond aan gebruikers (bijv. "1.0.0")
- `ios.buildNumber` = intern buildnummer (wordt automatisch verhoogd)

### Versie verhogen voor update
```json
"version": "1.1.0"
```
Dan opnieuw bouwen:
```bash
eas build --platform ios --profile production
```

---

## Veelgestelde vragen

### Hoe lang duurt een iOS build?
Gemiddeld 15-25 minuten op EAS cloud servers.

### Hoe lang duurt de App Store review?
Eerste app: 1-7 dagen. Updates: meestal 1-2 dagen.

### Moet ik een Mac hebben?
Nee! EAS bouwt in de cloud op Apple hardware.

---

## TODO bij App Store publicatie
- [x] Apple Developer Account actief
- [x] Apple credentials ingesteld via EAS
- [x] Distribution Certificate gegenereerd
- [x] Provisioning Profile gegenereerd
- [x] Eerste iOS build gestart
- [ ] App aanmaken in App Store Connect
- [ ] App-icoon maken (1024x1024, geen transparantie)
- [ ] Screenshots maken voor iPhone en iPad
- [ ] Privacybeleid pagina aanmaken
- [ ] Store listing invullen
- [ ] Build uploaden en review indienen

---

## Belangrijke links
- EAS Dashboard: https://expo.dev/accounts/prilleven/projects/prilleven-mobile-app
- App Store Connect: https://appstoreconnect.apple.com
- Apple Developer: https://developer.apple.com
- Build logs: https://expo.dev/accounts/prilleven/projects/prilleven-mobile-app/builds
