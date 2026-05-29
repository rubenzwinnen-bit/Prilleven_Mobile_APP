/**
 * CHATRUIMTE — TOPIC FORMULIER
 *
 * Topic aanmaken (route-param `slug`) of bewerken (route-param `topicId`
 * + initialTitle/initialBody). Op succes goBack → de vorige lijst/topic
 * herlaadt via useFocusEffect.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, radius, spacing } from '../constants/theme';
import { useToast } from '../components/Toast';
import {
  createTopic,
  updateTopic,
  TOPIC_TITLE_MAX,
  TOPIC_BODY_MAX,
} from '../services';
import type { ChatRoomsStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<ChatRoomsStackParamList, 'ChatTopicForm'>;

export function ChatTopicFormScreen({ navigation, route }: Props) {
  const { show } = useToast();
  const slug = route.params?.slug ?? '';
  const topicId = route.params?.topicId;
  const isEdit = !!topicId;

  const [title, setTitle] = useState(route.params?.initialTitle ?? '');
  const [body, setBody] = useState(route.params?.initialBody ?? '');
  const [saving, setSaving] = useState(false);

  const canSave = title.trim().length > 0 && body.trim().length > 0 && !saving;

  const onSave = useCallback(async () => {
    const t = title.trim();
    const b = body.trim();
    if (!t || !b || saving) return;
    setSaving(true);
    try {
      if (isEdit) {
        await updateTopic(topicId as string, { title: t, body: b });
        show('Topic bijgewerkt.', 'success');
      } else {
        await createTopic(slug, { title: t, body: b });
        show('Topic geplaatst.', 'success');
      }
      navigation.goBack();
    } catch (err: any) {
      show(err.message || 'Opslaan mislukt.', 'error');
    } finally {
      setSaving(false);
    }
  }, [title, body, saving, isEdit, topicId, slug, navigation, show]);

  return (
    <KeyboardAvoidingView
      style={styles.safe}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Titel</Text>
        <TextInput
          style={styles.titleInput}
          placeholder="Waar gaat je topic over?"
          placeholderTextColor={colors.gray}
          value={title}
          onChangeText={setTitle}
          maxLength={TOPIC_TITLE_MAX}
        />
        <Text style={styles.counter}>
          {title.length}/{TOPIC_TITLE_MAX}
        </Text>

        <Text style={styles.label}>Bericht</Text>
        <TextInput
          style={styles.bodyInput}
          placeholder="Schrijf je bericht…"
          placeholderTextColor={colors.gray}
          value={body}
          onChangeText={setBody}
          maxLength={TOPIC_BODY_MAX}
          multiline
        />
        <Text style={styles.counter}>
          {body.length}/{TOPIC_BODY_MAX}
        </Text>

        <Pressable
          onPress={onSave}
          disabled={!canSave}
          style={[styles.saveBtn, !canSave ? styles.saveBtnDisabled : null]}
        >
          {saving ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <Text style={styles.saveBtnText}>
              {isEdit ? 'Wijzigingen opslaan' : 'Topic plaatsen'}
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.darkLight,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  titleInput: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.dark,
  },
  bodyInput: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.dark,
    minHeight: 160,
    textAlignVertical: 'top',
  },
  counter: {
    fontSize: 11,
    color: colors.gray,
    textAlign: 'right',
    marginTop: 4,
  },
  saveBtn: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 16,
  },
});
