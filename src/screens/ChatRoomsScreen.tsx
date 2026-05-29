/**
 * CHATRUIMTES SCREEN — placeholder
 *
 * Derde footer-tab op de landing. De chatruimtes-feature (rooms →
 * topics → replies) wordt later gebouwd; voorlopig tonen we een
 * "binnenkort beschikbaar"-scherm.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, spacing } from '../constants/theme';

export function ChatRoomsScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.center}>
        <View style={styles.iconCircle}>
          <Feather name="users" size={36} color={colors.secondary} />
        </View>
        <Text style={styles.title}>Chatruimtes</Text>
        <Text style={styles.subtitle}>
          Binnenkort beschikbaar — hier kun je straks in thema-ruimtes praten
          met andere ouders.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.dark,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 15,
    color: colors.gray,
    textAlign: 'center',
    lineHeight: 22,
  },
});
