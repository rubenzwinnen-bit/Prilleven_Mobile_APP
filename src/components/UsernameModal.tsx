/**
 * USERNAME MODAL
 * Verschijnt bij eerste launch om een gebruikersnaam te vragen.
 * Wordt ook hergebruikt om de naam later te wijzigen.
 */

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors, radius, spacing, shadows } from '../constants/theme';

interface UsernameModalProps {
  visible: boolean;
  initialName?: string;
  onSubmit: (name: string) => void;
  onCancel?: () => void;
  title?: string;
}

export function UsernameModal({
  visible,
  initialName = '',
  onSubmit,
  onCancel,
  title = 'Welkom bij Receptenboek!',
}: UsernameModalProps) {
  const [name, setName] = useState(initialName);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (trimmed) onSubmit(trimmed);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.modal}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>Voer je naam in om te beginnen:</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Jouw naam..."
            placeholderTextColor={colors.grayLight}
            maxLength={30}
            autoFocus
            style={styles.input}
            onSubmitEditing={handleSubmit}
            returnKeyType="done"
          />
          <View style={styles.buttonRow}>
            {onCancel && (
              <Pressable style={[styles.btn, styles.btnOutline]} onPress={onCancel}>
                <Text style={styles.btnOutlineText}>Annuleren</Text>
              </Pressable>
            )}
            <Pressable style={[styles.btn, styles.btnPrimary]} onPress={handleSubmit}>
              <Text style={styles.btnPrimaryText}>Start</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modal: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.xxl,
    width: '100%',
    maxWidth: 420,
    ...shadows.lg,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 14,
    color: colors.gray,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  input: {
    width: '100%',
    borderWidth: 2,
    borderColor: colors.light,
    borderRadius: radius.sm,
    padding: spacing.md,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: spacing.lg,
    color: colors.dark,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'flex-end',
  },
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 0,
  },
  btnPrimary: {
    backgroundColor: colors.primary,
  },
  btnPrimaryText: {
    color: colors.white,
    fontWeight: '600',
  },
  btnOutline: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  btnOutlineText: {
    color: colors.primary,
    fontWeight: '600',
  },
});
