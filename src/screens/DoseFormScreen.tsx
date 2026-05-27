/**
 * DOSE FORM SCREEN
 *
 * Modal-style scherm om een nieuwe dose te registreren voor een
 * specifiek allergeen × kind. Route-params: { childId, allergenKey }.
 *
 * Velden:
 *   - dose_number (1-3) — auto-suggesteert volgende vrije positie
 *   - reaction (geen / mild / ernstig)
 *   - intro_date (jjjj-mm-dd, default vandaag, niet in toekomst)
 *   - notes (max 500)
 *
 * Server-side validaties (409 bij duplicate, etc.) worden via toast getoond.
 *
 * Op succes: `navigation.goBack()` → EersteHapjesScreen herlaadt via
 * useFocusEffect en toont de bijgewerkte tegel.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { colors, radius, spacing, shadows } from '../constants/theme';
import { useToast } from '../components/Toast';
import {
  ALLERGEN_FLOW,
  REACTION_LEVELS,
  createEhDose,
  getEhDoses,
  nextDoseNumber,
  todayIsoDate,
  ALLERGEN_TARGET_DOSES,
} from '../services';
import type { ReactionLevel } from '../services';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'DoseForm'>;

const HEADER_CONTENT_HEIGHT = 42;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function ChevronBack({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={12}
      style={{ paddingRight: spacing.md }}
    >
      <Text
        style={{
          fontSize: 28,
          color: colors.primary,
          fontWeight: '300',
          marginTop: -2,
        }}
      >
        ‹
      </Text>
    </TouchableOpacity>
  );
}

/** Valideer datum: jjjj-mm-dd, geldige dag, niet in toekomst. */
function validateDate(input: string): string | null {
  if (!DATE_REGEX.test(input)) {
    return 'Gebruik formaat jjjj-mm-dd.';
  }
  const [y, m, d] = input.split('-').map(Number);
  const date = new Date(`${input}T00:00:00`);
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() + 1 !== m ||
    date.getUTCDate() !== d
  ) {
    return 'Geen geldige datum.';
  }
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (date.getTime() > today.getTime()) {
    return 'Datum kan niet in de toekomst liggen.';
  }
  return null;
}

export function DoseFormScreen({ navigation, route }: Props) {
  const { show } = useToast();
  const { childId, allergenKey } = route.params;

  const allergen = useMemo(
    () => ALLERGEN_FLOW.find(a => a.key === allergenKey),
    [allergenKey]
  );

  /* Form state */
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [doseNumber, setDoseNumber] = useState<1 | 2 | 3>(1);
  const [reaction, setReaction] = useState<ReactionLevel>('geen');
  const [introDate, setIntroDate] = useState(todayIsoDate());
  const [notes, setNotes] = useState('');
  const [takenDoseNumbers, setTakenDoseNumbers] = useState<Set<number>>(
    new Set()
  );

  /* Volgende vrije dose-nummer ophalen */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const existing = await getEhDoses(childId, allergenKey);
        if (cancelled) return;
        setTakenDoseNumbers(new Set(existing.map(d => d.dose_number)));
        const next = nextDoseNumber(existing, allergenKey);
        if (next) setDoseNumber(next);
      } catch (err: any) {
        if (!cancelled) {
          show(err.message || 'Kon doses niet laden.', 'error');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [childId, allergenKey, show]);

  /* Validatie */
  const trimmedDate = introDate.trim();
  const dateError = useMemo(() => validateDate(trimmedDate), [trimmedDate]);
  const isDoseTaken = takenDoseNumbers.has(doseNumber);
  const allDosesFull = takenDoseNumbers.size >= ALLERGEN_TARGET_DOSES;
  const canSave =
    !!allergen &&
    !dateError &&
    !isDoseTaken &&
    !allDosesFull &&
    notes.length <= 500 &&
    !saving &&
    !loading;

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await createEhDose({
        child_id: childId,
        allergen_key: allergenKey,
        dose_number: doseNumber,
        reaction,
        intro_date: trimmedDate,
        notes: notes.trim() ? notes.trim() : null,
      });
      show(`Dose ${doseNumber} geregistreerd.`, 'success');
      navigation.goBack();
    } catch (err: any) {
      show(err.message || 'Opslaan mislukt.', 'error');
    } finally {
      setSaving(false);
    }
  }, [
    canSave,
    childId,
    allergenKey,
    doseNumber,
    reaction,
    trimmedDate,
    notes,
    navigation,
    show,
  ]);

  if (!allergen) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <ChevronBack onPress={() => navigation.goBack()} />
          <Text style={styles.headerTitle}>Dose toevoegen</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.loadingBlock}>
          <Text style={styles.errorText}>Onbekend allergeen.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <ChevronBack onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Dose toevoegen</Text>
        <View style={{ width: 28 }} />
      </View>

      {loading ? (
        <View style={styles.loadingBlock}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
          >
            {/* Allergen-info */}
            <View style={styles.allergenHeader}>
              <Text style={styles.allergenIcon}>{allergen.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.allergenLabel}>{allergen.label}</Text>
                <Text style={styles.allergenHint}>{allergen.suggestion}</Text>
              </View>
            </View>

            {allDosesFull && (
              <View style={styles.warningBlock}>
                <Feather
                  name="check-circle"
                  size={18}
                  color={colors.secondaryDark}
                />
                <Text style={styles.warningText}>
                  Alle 3 doses zijn al geregistreerd voor dit allergeen.
                </Text>
              </View>
            )}

            {/* Dose nummer */}
            <Text style={styles.fieldLabel}>Welke dose? *</Text>
            <View style={styles.segRow}>
              {[1, 2, 3].map(n => {
                const num = n as 1 | 2 | 3;
                const taken = takenDoseNumbers.has(num);
                const active = doseNumber === num;
                return (
                  <Pressable
                    key={n}
                    onPress={() => setDoseNumber(num)}
                    disabled={taken && !active}
                    style={({ pressed }) => [
                      styles.segChip,
                      active && styles.segChipActive,
                      taken && !active && styles.segChipTaken,
                      pressed && styles.btnPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.segChipText,
                        active && styles.segChipTextActive,
                      ]}
                    >
                      Dose {n}
                    </Text>
                    {taken && !active && (
                      <Text style={styles.segChipTakenHint}>al gedaan</Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
            {isDoseTaken && (
              <Text style={styles.fieldError}>
                Dose {doseNumber} bestaat al — kies een ander nummer.
              </Text>
            )}

            {/* Reactie */}
            <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>
              Reactie *
            </Text>
            <View style={styles.reactionCol}>
              {(['geen', 'mild', 'ernstig'] as const).map(level => {
                const info = REACTION_LEVELS[level];
                const active = reaction === level;
                return (
                  <Pressable
                    key={level}
                    onPress={() => setReaction(level)}
                    style={({ pressed }) => [
                      styles.reactionCard,
                      active && styles.reactionCardActive,
                      pressed && styles.btnPressed,
                    ]}
                  >
                    <View style={styles.reactionRow}>
                      <View
                        style={[
                          styles.reactionRadio,
                          active && styles.reactionRadioActive,
                        ]}
                      >
                        {active && <View style={styles.reactionRadioDot} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.reactionLabel,
                            active && styles.reactionLabelActive,
                          ]}
                        >
                          {info.label}
                        </Text>
                        <Text style={styles.reactionDescription}>
                          {info.description}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {reaction === 'ernstig' && (
              <View style={styles.warningBlock}>
                <Feather
                  name="alert-triangle"
                  size={18}
                  color={colors.danger}
                />
                <Text style={styles.warningTextDanger}>
                  Bij een ernstige reactie raden we sterk aan om dezelfde dag
                  nog een arts te contacteren.
                </Text>
              </View>
            )}

            {/* Datum */}
            <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>
              Datum *
            </Text>
            <TextInput
              style={styles.textInput}
              value={introDate}
              onChangeText={setIntroDate}
              placeholder={todayIsoDate()}
              placeholderTextColor={colors.grayLight}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              autoCorrect={false}
              autoCapitalize="none"
              editable={!saving}
            />
            <Text style={styles.fieldHint}>
              Formaat jjjj-mm-dd
              {introDate.length > 0 && dateError ? ` · ${dateError}` : ''}
            </Text>

            {/* Notities */}
            <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>
              Notities
            </Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Bv. een halve theelepel, vermengd met yoghurt."
              placeholderTextColor={colors.grayLight}
              multiline
              maxLength={500}
              editable={!saving}
            />
            <Text style={styles.fieldHint}>{notes.length}/500 tekens</Text>

            {/* Save */}
            <Pressable
              onPress={handleSave}
              disabled={!canSave}
              style={({ pressed }) => [
                styles.saveBtn,
                pressed && styles.btnPressed,
                !canSave && styles.btnDisabled,
              ]}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Feather name="check" size={18} color={colors.white} />
                  <Text style={styles.saveBtnText}>Dose opslaan</Text>
                </>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    height: HEADER_CONTENT_HEIGHT,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.dark,
  },
  loadingBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 14,
    color: colors.danger,
  },
  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  allergenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  allergenIcon: {
    fontSize: 36,
  },
  allergenLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.dark,
  },
  allergenHint: {
    fontSize: 12,
    color: colors.gray,
    marginTop: 2,
  },
  warningBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    marginBottom: spacing.md,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: colors.dark,
    lineHeight: 18,
  },
  warningTextDanger: {
    flex: 1,
    fontSize: 13,
    color: colors.danger,
    fontWeight: '600',
    lineHeight: 18,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.dark,
    marginBottom: spacing.xs,
  },
  fieldHint: {
    fontSize: 11,
    color: colors.gray,
    marginTop: spacing.xs,
  },
  fieldError: {
    fontSize: 11,
    color: colors.danger,
    marginTop: spacing.xs,
  },
  textInput: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.light,
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    color: colors.dark,
    ...shadows.sm,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: spacing.sm,
  },
  segRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  segChip: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.light,
    backgroundColor: colors.white,
    alignItems: 'center',
  },
  segChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  segChipTaken: {
    opacity: 0.5,
  },
  segChipText: {
    fontSize: 14,
    color: colors.dark,
    fontWeight: '600',
  },
  segChipTextActive: {
    color: colors.white,
    fontWeight: '700',
  },
  segChipTakenHint: {
    fontSize: 10,
    color: colors.gray,
    marginTop: 2,
  },
  reactionCol: {
    gap: spacing.sm,
  },
  reactionCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.light,
    padding: spacing.md,
    ...shadows.sm,
  },
  reactionCardActive: {
    borderColor: colors.primary,
    backgroundColor: '#fbf0e6',
  },
  reactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  reactionRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.grayLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionRadioActive: {
    borderColor: colors.primary,
  },
  reactionRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  reactionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.dark,
  },
  reactionLabelActive: {
    color: colors.primary,
  },
  reactionDescription: {
    fontSize: 12,
    color: colors.gray,
    marginTop: 2,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    marginTop: spacing.xl,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.white,
  },
  btnPressed: {
    opacity: 0.65,
  },
  btnDisabled: {
    opacity: 0.45,
  },
});
