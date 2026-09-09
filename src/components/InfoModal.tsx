/**
 * INFO MODAL
 * Uitleg die anders als vast blok schermruimte zou innemen. Wordt geopend via
 * de info-knop in de header (`CompactHeader onInfo`).
 */

import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { colors, radius, spacing, shadows } from '../constants/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function InfoModal({ visible, onClose, title, children }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        {/* Tik binnen de kaart mag niet sluiten. */}
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.body}>{children}</View>
          <Pressable style={styles.btn} onPress={onClose}>
            <Text style={styles.btnText}>Begrepen</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.xl,
    ...shadows.lg,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.greenText,
    marginBottom: spacing.md,
  },
  body: {
    marginBottom: spacing.lg,
  },
  btn: {
    backgroundColor: colors.greenText,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  btnText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
});
