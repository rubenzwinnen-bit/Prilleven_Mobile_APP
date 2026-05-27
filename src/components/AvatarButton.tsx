/**
 * AVATAR BUTTON
 *
 * Cirkelvormige knop. Toont — indien aanwezig — de community-avatar
 * van de gebruiker; anders een sage-groene cirkel met de initialen.
 *
 * Wordt gebruikt in:
 *   - LandingScreen-header (rechtsboven, vervangt de losse logout-knop)
 *   - ProfileScreen (grote variant in de community-sectie)
 *
 * Initialen worden afgeleid uit het e-mailadres:
 *   - "anneleen@prilleven.be"  → "A"
 *   - "anneleen.plettinx@..."  → "AP"
 */

import React, { useState, useEffect } from 'react';
import { Pressable, Image, Text, StyleSheet } from 'react-native';
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
  /** Signed avatar-URL (1u TTL). Wanneer leeg/ongeldig wordt op
   *  initialen teruggevallen. */
  avatarUrl?: string | null;
  /** Toegankelijk label voor screenreaders. */
  accessibilityLabel?: string;
}

export function AvatarButton({
  email,
  onPress,
  size = 36,
  avatarUrl,
  accessibilityLabel = 'Open mijn account',
}: AvatarButtonProps) {
  const initials = initialsFromEmail(email);
  const fontSize = size <= 32 ? 12 : size >= 44 ? 16 : size >= 64 ? 24 : 14;

  /* Wanneer Image faalt (verlopen signed URL, netwerk-fout, ...) val
     we automatisch terug op initialen. Reset bij URL-wijziging. */
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => {
    setImageFailed(false);
  }, [avatarUrl]);

  const showImage = !!avatarUrl && !imageFailed;

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
      {showImage ? (
        <Image
          source={{ uri: avatarUrl as string }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <Text style={[styles.initials, { fontSize }]} numberOfLines={1}>
          {initials}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: {
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initials: {
    color: colors.white,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
