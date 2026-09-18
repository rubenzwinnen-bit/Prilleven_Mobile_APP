/**
 * SUBSCRIPTION EXPIRED SCREEN
 *
 * Vervangt de hele app zodra de server zegt dat het lidmaatschap niet meer
 * actief is. Spiegel van `showSubscriptionExpiredScreen()` op de website.
 *
 * Drie acties, en dat is bewust weinig:
 *   - "Check opnieuw"  → iemand die net betaald heeft moet niet hoeven wachten
 *                        op de volgende poll of een herstart.
 *   - "Uitloggen"      → wisselen van account.
 *   - Lid worden       → ALLEEN op Android. Zie MAG_NAAR_CHECKOUT_LINKEN in
 *                        constants/links.ts voor waarom die knop op iOS
 *                        ontbreekt.
 *
 * Dit scherm hangt buiten de NavigationContainer: er is hier niets om naartoe
 * te navigeren, en de gebruiker mag er ook niet omheen.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing, shadows } from '../constants/theme';
import { CHECKOUT_URL, MAG_NAAR_CHECKOUT_LINKEN } from '../constants/links';
import {
  accessMessage,
  formatEndDate,
  type SubscriptionStatus,
} from '../services';

interface Props {
  status: SubscriptionStatus | null;
  /** Opnieuw bij de server navragen. Geeft de verse status terug. */
  onRecheck: () => Promise<void>;
  onLogout: () => void;
}

export function SubscriptionExpiredScreen({
  status,
  onRecheck,
  onLogout,
}: Props) {
  const [checking, setChecking] = useState(false);
  const [nogSteeds, setNogSteeds] = useState(false);

  const handleRecheck = async () => {
    setChecking(true);
    setNogSteeds(false);
    await onRecheck();
    /* Klopt het lidmaatschap intussen wél, dan is dit scherm al vervangen en
       zien we deze regel niet meer. Staan we er nog, dan is er niets
       veranderd — dat moet de knop dan ook zeggen. */
    setChecking(false);
    setNogSteeds(true);
  };

  const tot = formatEndDate(status?.end_date ?? null);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.leaf}>🌿</Text>

        <Text style={styles.title}>Je lidmaatschap is verlopen</Text>
        <Text style={styles.body}>{accessMessage(status)}</Text>

        {!!tot && (
          <Text style={styles.meta}>Je toegang liep tot {tot}.</Text>
        )}

        {MAG_NAAR_CHECKOUT_LINKEN ? (
          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && styles.pressed,
            ]}
            onPress={() => Linking.openURL(CHECKOUT_URL)}
          >
            <Text style={styles.primaryBtnText}>Lidmaatschap verlengen</Text>
          </Pressable>
        ) : (
          /* iOS: geen verwijzing naar waar je verlengt — dat is een oproep tot
             kopen buiten de app (3.1.3(f), zie constants/links.ts). Wel een
             supportroute: die gaat over hulp, niet over betalen. */
          <Text style={styles.webHint}>
            Denk je dat dit niet klopt? Mail ons via{' '}
            <Text
              style={styles.webHintLink}
              onPress={() => Linking.openURL('mailto:hallo@prilleven.be')}
            >
              hallo@prilleven.be
            </Text>
            .
          </Text>
        )}

        <Pressable
          style={({ pressed }) => [
            styles.secondaryBtn,
            pressed && styles.pressed,
            checking && styles.disabled,
          ]}
          onPress={handleRecheck}
          disabled={checking}
        >
          {checking ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.secondaryBtnText}>
              {nogSteeds ? 'Nog niets gewijzigd — probeer opnieuw' : 'Net betaald? Check opnieuw'}
            </Text>
          )}
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]}
          onPress={onLogout}
        >
          <Text style={styles.ghostBtnText}>Uitloggen</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  leaf: {
    fontSize: 44,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.darkLight,
    textAlign: 'center',
    marginBottom: spacing.sm,
    maxWidth: 340,
  },
  meta: {
    fontSize: 13,
    color: colors.gray,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  webHint: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.darkLight,
    textAlign: 'center',
    maxWidth: 320,
    marginBottom: spacing.lg,
  },
  webHintLink: {
    color: colors.greenText,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    minWidth: 260,
    alignItems: 'center',
    ...shadows.sm,
  },
  primaryBtnText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryBtn: {
    backgroundColor: colors.greenText,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    minWidth: 260,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  ghostBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  ghostBtnText: {
    color: colors.gray,
    fontSize: 14,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.6,
  },
});
