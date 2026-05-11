/**
 * HEALTH DISCLAIMER MODAL
 *
 * Wordt getoond bij eerste gebruik van HapjesHeld. Gebruiker moet
 * expliciet bevestigen dat hij/zij begrijpt dat HapjesHeld géén
 * medisch advies geeft en geen vervanging is voor een arts, pediater
 * of andere zorgverlener.
 *
 * Acceptatie wordt opgeslagen in AsyncStorage onder
 * `hapjesheld:health-disclaimer:v1` zodat de modal niet steeds opnieuw
 * verschijnt. Verhoog het versienummer in de key als de tekst
 * substantieel verandert — dan moet de gebruiker opnieuw bevestigen.
 *
 * Nodig voor Google Play "Beleid voor content over en services voor
 * gezondheid" — gebruiker moet vóór gebruik geïnformeerd worden.
 */

import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radius, spacing, shadows } from '../constants/theme';

const STORAGE_KEY = 'hapjesheld:health-disclaimer:v1';

interface Props {
  /** Wordt aangeroepen als gebruiker de disclaimer accepteert. */
  onAccepted?: () => void;
}

export function HealthDisclaimerModal({ onAccepted }: Props) {
  const [checking, setChecking] = useState(true);
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const accepted = await AsyncStorage.getItem(STORAGE_KEY);
        if (cancelled) return;
        if (accepted === 'true') {
          setVisible(false);
        } else {
          setVisible(true);
        }
      } catch {
        // Bij storage-fout: toon disclaimer voor de zekerheid
        if (!cancelled) setVisible(true);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAccept = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // Niet kritisch: dan toont de modal volgende keer opnieuw
    } finally {
      setSaving(false);
      setVisible(false);
      onAccepted?.();
    }
  };

  if (checking || !visible) return null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        /* Niet sluitbaar zonder accepteren */
      }}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Belangrijk: geen medisch advies</Text>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator
          >
            <Text style={styles.intro}>
              HapjesHeld is een AI-assistent die je informatie en inspiratie
              geeft rond kindervoeding. De antwoorden zijn algemeen van aard
              en zijn <Text style={styles.bold}>geen medisch advies</Text>.
            </Text>

            <Text style={styles.sectionTitle}>Raadpleeg altijd een professional</Text>
            <Text style={styles.body}>
              Voor vragen over de gezondheid, ontwikkeling, voeding,
              allergieën, intoleranties, medicatie of het dieet van jouw
              kind moet je altijd een{' '}
              <Text style={styles.bold}>
                arts, kinderarts, vroedvrouw of andere erkende
                zorgverlener
              </Text>{' '}
              raadplegen. HapjesHeld vervangt geen consultatie en stelt
              geen diagnose.
            </Text>

            <Text style={styles.sectionTitle}>In een noodgeval</Text>
            <Text style={styles.body}>
              Bij een allergische reactie, verslikking, ademhalingsproblemen
              of een andere medische noodsituatie: bel onmiddellijk{' '}
              <Text style={styles.bold}>112</Text> of het Antigifcentrum op{' '}
              <Text style={styles.bold}>070 245 245</Text> (België). Wacht
              niet op een antwoord van HapjesHeld.
            </Text>

            <Text style={styles.sectionTitle}>Beperkingen van AI</Text>
            <Text style={styles.body}>
              Antwoorden kunnen fouten bevatten, onvolledig zijn of niet
              passen bij de specifieke situatie van jouw kind. Controleer
              belangrijke informatie altijd bij een betrouwbare bron of een
              zorgverlener.
            </Text>

            <Text style={styles.sectionTitle}>Allergenen & ingrediënten</Text>
            <Text style={styles.body}>
              Hoewel we ons best doen om allergeen-informatie correct weer
              te geven, ben jij als ouder/verzorger zelf verantwoordelijk
              voor het controleren van labels en ingrediënten. Vertrouw bij
              een gekende allergie nooit alleen op de app.
            </Text>
          </ScrollView>

          <TouchableOpacity
            style={styles.acceptButton}
            onPress={handleAccept}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Ik begrijp het en accepteer"
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.acceptText}>
                Ik begrijp het en ga akkoord
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.xl,
    ...shadows.lg,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.dark,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  scroll: {
    marginBottom: spacing.lg,
  },
  scrollContent: {
    paddingBottom: spacing.sm,
  },
  intro: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.darkLight,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.dark,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.darkLight,
  },
  bold: {
    fontWeight: '700',
    color: colors.dark,
  },
  acceptButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  acceptText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
  },
});
