/**
 * AVATAR BUTTON
 *
 * Cirkelvormige knop met de initialen van de ingelogde gebruiker.
 * Past visueel bij `HomeIconButton` (sage-groene cirkel met witte
 * tekst), maar opent het Profile-scherm i.p.v. naar Landing te gaan.
 *
 * Wordt gebruikt in:
 *   - LandingScreen-header (rechtsboven, vervangt de losse logout-knop)
 *
 * Initialen worden afgeleid uit het e-mailadres:
 *   - "anneleen@prilleven.be"  → "A"
 *   - "anneleen.plettinx@..."  → "AP"
 */

import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { colors } from '../constants/theme';

function initialsFromEmail(email: string): string {
  if (!email) return '?';
  const local = email.split('@')[0] || '';
  const parts = local
    .split(/[._\-+]+/)
    .map(p => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return email.charAt(0).toUpperCase() || '?';
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}

interface AvatarButtonProps {
  email: string;
  onPress: () => void;
  size?: number;
  /** Toegankelijk label voor screenreaders. */
  accessibilityLabel?: string;
}

export function AvatarButton({
  email,
  onPress,
  size = 36,
  accessibilityLabel = 'Open mijn account',
}: AvatarButtonProps) {
  const initials = initialsFromEmail(email);
  const fontSize = size <= 32 ? 12 : size >= 44 ? 16 : 14;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text style={[styles.initials, { fontSize }]} numberOfLines={1}>
        {initials}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: {
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: colors.white,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
