/**
 * RENAME MODAL
 * Klein venster met één tekstveld om iets een eigen naam te geven. Gebruikt
 * door het gesprekkenoverzicht van HapjesHeld (titel van een gesprek).
 * Zelfde vorm als het reden-venster in ChatFeedback.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors, radius, spacing, shadows } from '../constants/theme';

export function RenameModal({
  visible,
  title,
  initialValue,
  maxLength,
  onSubmit,
  onClose,
}: {
  visible: boolean;
  title: string;
  initialValue: string;
  maxLength: number;
  onSubmit: (value: string) => Promise<void>;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) setValue(initialValue);
  }, [visible, initialValue]);

  const trimmed = value.trim();
  const canSave = trimmed.length > 0 && trimmed !== initialValue.trim() && !saving;

  const submit = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSubmit(trimmed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.overlay} onPress={onClose}>
          {/* Tik binnen de kaart mag niet sluiten. */}
          <Pressable style={styles.card} onPress={() => {}}>
            <Text style={styles.title}>{title}</Text>
            <TextInput
              style={styles.input}
              value={value}
              onChangeText={setValue}
              maxLength={maxLength}
              autoFocus
              selectTextOnFocus
              returnKeyType="done"
              onSubmitEditing={submit}
            />
            <Text style={styles.counter}>
              {value.length}/{maxLength}
            </Text>
            <View style={styles.actions}>
              <Pressable style={styles.btnSecondary} onPress={onClose}>
                <Text style={styles.btnSecondaryText}>Annuleer</Text>
              </Pressable>
              <Pressable
                style={[styles.btnPrimary, !canSave && styles.btnDisabled]}
                onPress={submit}
                disabled={!canSave}
              >
                <Text style={styles.btnPrimaryText}>
                  {saving ? 'Bezig…' : 'Opslaan'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
  input: {
    fontSize: 16,
    color: colors.dark,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  counter: {
    alignSelf: 'flex-end',
    fontSize: 11,
    color: colors.gray,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  btnSecondary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.greenText,
    alignItems: 'center',
  },
  btnSecondaryText: {
    color: colors.greenText,
    fontSize: 15,
    fontWeight: '700',
  },
  btnPrimary: {
    flex: 1,
    backgroundColor: colors.greenText,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  btnPrimaryText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
});
