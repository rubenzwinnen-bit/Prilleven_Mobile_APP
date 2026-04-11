/**
 * USERNAME HEADER
 *
 * Klein header-balkje bovenaan elk scherm dat het e-mailadres
 * van de ingelogde gebruiker toont + een uitlog-knop.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { colors, radius, spacing } from '../constants/theme';
import { useUser } from '../context/UserContext';

interface UsernameHeaderProps {
  /** Optionele subtitel rechts (bv. "Recepten") */
  subtitle?: string;
}

export function UsernameHeader({ subtitle }: UsernameHeaderProps) {
  const { user, logout } = useUser();

  const handleLogout = () => {
    Alert.alert('Uitloggen', 'Weet je zeker dat je wil uitloggen?', [
      { text: 'Annuleren', style: 'cancel' },
      {
        text: 'Uitloggen',
        style: 'destructive',
        onPress: () => logout(),
      },
    ]);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.left}>
        <Text style={styles.greet}>Ingelogd als</Text>
        <Text style={styles.email} numberOfLines={1}>
          👤 {user || '...'}
        </Text>
      </View>
      <View style={styles.right}>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        <Pressable onPress={handleLogout} hitSlop={8} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Uitloggen</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: colors.bg,
  },
  left: {
    flexDirection: 'column',
    flexShrink: 1,
    marginRight: spacing.sm,
  },
  right: {
    alignItems: 'flex-end',
  },
  greet: {
    fontSize: 10,
    color: colors.gray,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  email: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryDark,
    backgroundColor: colors.white,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.sm,
    marginTop: 2,
    overflow: 'hidden',
  },
  subtitle: {
    fontSize: 12,
    color: colors.gray,
    fontWeight: '600',
  },
  logoutBtn: {
    marginTop: 2,
    paddingVertical: 2,
  },
  logoutText: {
    fontSize: 11,
    color: colors.danger,
    fontWeight: '600',
  },
});
