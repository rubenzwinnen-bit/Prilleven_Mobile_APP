/**
 * CHAT FEEDBACK
 * Duim omhoog/omlaag onder een antwoord van HapjesHeld, plus het venster voor
 * een optionele reden bij duim omlaag. Spiegel van `attachFeedback()` in de web
 * `js/chat.js`: nogmaals op dezelfde duim tikken maakt het ongedaan. Opslaan
 * gebeurt in het chatscherm via `sendChatFeedback`.
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
import { Feather } from '@expo/vector-icons';
import { colors, radius, spacing, shadows } from '../constants/theme';

const MAX_REDEN = 500;

export function ChatFeedbackRow({
  rating,
  onRate,
}: {
  rating: 1 | -1 | 0;
  onRate: (next: 1 | -1) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>
        {rating ? 'Bedankt voor je feedback!' : 'Was dit antwoord nuttig?'}
      </Text>
      <Pressable
        onPress={() => onRate(1)}
        hitSlop={6}
        accessibilityLabel="Nuttig antwoord"
        style={[styles.btn, rating === 1 && styles.btnActive]}
      >
        <Feather
          name="thumbs-up"
          size={15}
          color={rating === 1 ? colors.greenText : colors.gray}
        />
      </Pressable>
      <Pressable
        onPress={() => onRate(-1)}
        hitSlop={6}
        accessibilityLabel="Niet nuttig antwoord"
        style={[styles.btn, rating === -1 && styles.btnActive]}
      >
        <Feather
          name="thumbs-down"
          size={15}
          color={rating === -1 ? colors.greenText : colors.gray}
        />
      </Pressable>
    </View>
  );
}

export function FeedbackReasonModal({
  visible,
  onSubmit,
  onClose,
}: {
  visible: boolean;
  onSubmit: (reden: string) => Promise<void>;
  onClose: () => void;
}) {
  const [reden, setReden] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) setReden('');
  }, [visible]);

  const submit = async () => {
    if (!reden.trim()) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      await onSubmit(reden.trim());
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
            <Text style={styles.title}>Wat kon beter?</Text>
            <Text style={styles.hint}>
              Optioneel. Zo kunnen we HapjesHeld verbeteren.
            </Text>
            <TextInput
              style={styles.input}
              value={reden}
              onChangeText={setReden}
              placeholder="Bv. het antwoord ging niet over mijn vraag"
              placeholderTextColor={colors.gray}
              multiline
              maxLength={MAX_REDEN}
              autoFocus
            />
            <View style={styles.actions}>
              <Pressable style={styles.btnSecondary} onPress={onClose}>
                <Text style={styles.btnSecondaryText}>Overslaan</Text>
              </Pressable>
              <Pressable
                style={[styles.btnPrimary, saving && styles.btnDisabled]}
                onPress={submit}
                disabled={saving}
              >
                <Text style={styles.btnPrimaryText}>
                  {saving ? 'Bezig…' : 'Verstuur'}
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    marginTop: -2,
    marginBottom: spacing.md,
    marginLeft: spacing.xs,
  },
  label: {
    fontSize: 12,
    color: colors.gray,
    marginRight: spacing.xs,
  },
  btn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.grayLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnActive: {
    borderColor: colors.greenText,
    backgroundColor: 'rgba(79, 125, 108, 0.12)',
  },
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
    marginBottom: spacing.xs,
  },
  hint: {
    fontSize: 13,
    color: colors.gray,
    marginBottom: spacing.md,
  },
  input: {
    minHeight: 80,
    maxHeight: 160,
    fontSize: 15,
    color: colors.dark,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    textAlignVertical: 'top',
    marginBottom: spacing.lg,
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
  btnDisabled: { opacity: 0.6 },
  btnPrimaryText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
});
