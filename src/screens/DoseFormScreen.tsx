/**
 * DOSE FORM SCREEN — v2.7.4 (website-paritaire layout, edit-mode)
 *
 * Modal-style scherm om een introductie te registreren of te bewerken voor
 * een specifiek allergeen × kind.
 * Route-params:
 *   - childId
 *   - allergenKey
 *   - doseId? (indien ingevuld → bewerk-modus)
 *
 * Spiegel van de website-modal `openDoseModal` (allergenen.js). De
 * introductie-nummer wordt automatisch bepaald op basis van het aantal
 * reeds geregistreerde doses; er is dus geen 1/2/3-picker. Reacties
 * worden in een aparte "Reactie loggen"-flow geregistreerd, dus dit
 * scherm vraagt ze hier niet meer. Server krijgt reaction='geen'.
 *
 * Velden:
 *   - Hoeveelheid-tekst (read-only, hangt af van introductienummer)
 *   - intro_date (jjjj-mm-dd, default vandaag, niet in toekomst)
 *   - notes (max 500, optioneel)
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
  createEhDose,
  updateEhDose,
  getEhDoses,
  nextDoseNumber,
  todayIsoDate,
  ALLERGEN_TARGET_DOSES,
} from '../services';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'DoseForm'>;

const HEADER_CONTENT_HEIGHT = 42;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** Hoeveelheid-tekst per introductienummer (spiegel van DOSE_AMOUNT_TEXT op website). */
const DOSE_AMOUNT_TEXT: Record<1 | 2 | 3, string> = {
  1: 'Starten met ¼ koffielepel',
  2: '½ koffielepel',
  3: 'Volledige koffielepel',
};

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

/** Valideer datum: jjjj-mm-dd, geldige dag, niet in toekomst.
 *  We vergelijken via lokale-tijd-accessors omdat `new Date('YYYY-MM-DDT00:00:00')`
 *  als lokale middernacht wordt geparsed; UTC-accessors zouden in CET/CEST een
 *  off-by-one geven en zo de Opslaan-knop blokkeren. */
function validateDate(input: string): string | null {
  if (!DATE_REGEX.test(input)) {
    return 'Gebruik formaat jjjj-mm-dd.';
  }
  const [y, m, d] = input.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== y ||
    date.getMonth() + 1 !== m ||
    date.getDate() !== d
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
  const { childId, allergenKey, doseId } = route.params;
  const isEdit = !!doseId;

  const allergen = useMemo(
    () => ALLERGEN_FLOW.find(a => a.key === allergenKey),
    [allergenKey]
  );

  /* Form state */
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [doseNumber, setDoseNumber] = useState<1 | 2 | 3>(1);
  const [allDosesFull, setAllDosesFull] = useState(false);
  const [introDate, setIntroDate] = useState(todayIsoDate());
  const [notes, setNotes] = useState('');

  /* Auto-bepaal het volgende vrije introductienummer of laad bestaande */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const existing = await getEhDoses(childId, allergenKey);
        if (cancelled) return;
        if (isEdit) {
          const cur = existing.find(d => d.id === doseId);
          if (!cur) {
            show('Introductie niet gevonden.', 'error');
            navigation.goBack();
            return;
          }
          setDoseNumber(cur.dose_number);
          setIntroDate(cur.intro_date ?? todayIsoDate());
          setNotes(cur.notes ?? '');
          setAllDosesFull(false);
        } else {
          const next = nextDoseNumber(existing, allergenKey);
          if (next) {
            setDoseNumber(next);
            setAllDosesFull(false);
          } else {
            setAllDosesFull(true);
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          show(err.message || 'Kon introducties niet laden.', 'error');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [childId, allergenKey, doseId, isEdit, navigation, show]);

  /* Validatie */
  const trimmedDate = introDate.trim();
  const dateError = useMemo(() => validateDate(trimmedDate), [trimmedDate]);
  const canSave =
    !!allergen &&
    !dateError &&
    !allDosesFull &&
    notes.length <= 500 &&
    !saving &&
    !loading;

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      if (isEdit && doseId) {
        await updateEhDose(doseId, {
          intro_date: trimmedDate,
          notes: notes.trim() ? notes.trim() : null,
        });
        show(`Introductie ${doseNumber} bijgewerkt.`, 'success');
      } else {
        await createEhDose({
          child_id: childId,
          allergen_key: allergenKey,
          dose_number: doseNumber,
          reaction: 'geen',
          intro_date: trimmedDate,
          notes: notes.trim() ? notes.trim() : null,
        });
        show(`Introductie ${doseNumber} geregistreerd.`, 'success');
      }
      navigation.goBack();
    } catch (err: any) {
      show(err.message || 'Opslaan mislukt.', 'error');
    } finally {
      setSaving(false);
    }
  }, [
    canSave,
    isEdit,
    doseId,
    childId,
    allergenKey,
    doseNumber,
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
          <Text style={styles.headerTitle}>Introductie registreren</Text>
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
        <Text style={styles.headerTitle}>
          {isEdit ? 'Introductie bewerken' : 'Introductie registreren'}
        </Text>
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
            {/* Titel: "{label} — introductie N" */}
            <Text style={styles.title}>
              {allergen.label} — introductie {doseNumber}
            </Text>
            <Text style={styles.sub}>{allergen.suggestion}</Text>

            {allDosesFull && (
              <View style={styles.warningBlock}>
                <Feather
                  name="check-circle"
                  size={18}
                  color={colors.secondaryDark}
                />
                <Text style={styles.warningText}>
                  Alle 3 introducties zijn al geregistreerd voor dit allergeen.
                </Text>
              </View>
            )}

            {!allDosesFull && (
              <>
                {/* Hoeveelheid-box (read-only) */}
                <View style={styles.amountBox}>
                  <Text style={styles.amountLabel}>Hoeveelheid</Text>
                  <Text style={styles.amountValue}>
                    {DOSE_AMOUNT_TEXT[doseNumber]}
                  </Text>
                </View>

                {/* Datum */}
                <Text style={styles.fieldLabel}>Datum *</Text>
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

                {/* Hint: reactie apart loggen */}
                <View style={styles.hintBlock}>
                  <Feather name="info" size={14} color={colors.info} />
                  <Text style={styles.hintText}>
                    Een reactie hoort hier niet bij. Wil je een reactie of
                    symptoom melden? Gebruik dan{' '}
                    <Text style={styles.bold}>Reactie loggen</Text> op het
                    vorige scherm.
                  </Text>
                </View>

                {/* Notities (optioneel) */}
                <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>
                  Notities <Text style={styles.optional}>(optioneel)</Text>
                </Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Bv. vermengd met yoghurt of pap."
                  placeholderTextColor={colors.grayLight}
                  multiline
                  maxLength={500}
                  editable={!saving}
                />
                <Text style={styles.fieldHint}>{notes.length}/500 tekens</Text>

                {/* Voortgang-hint */}
                <Text style={styles.progressHint}>
                  Introductie {doseNumber} van {ALLERGEN_TARGET_DOSES}.
                </Text>

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
                      <Text style={styles.saveBtnText}>
                        {isEdit
                          ? `Introductie ${doseNumber} bijwerken`
                          : `Introductie ${doseNumber} opslaan`}
                      </Text>
                    </>
                  )}
                </Pressable>
              </>
            )}
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
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.dark,
  },
  sub: {
    fontSize: 13,
    color: colors.darkLight,
    marginTop: 2,
    marginBottom: spacing.lg,
    lineHeight: 18,
  },
  amountBox: {
    backgroundColor: '#fdf7e4',
    borderWidth: 1,
    borderColor: '#f5e8b8',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  amountLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.darkLight,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  amountValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.dark,
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
  optional: {
    fontSize: 11,
    color: colors.gray,
    fontWeight: '400',
  },
  bold: {
    fontWeight: '700',
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
  hintBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: '#e7f3fb',
    marginTop: spacing.md,
  },
  hintText: {
    flex: 1,
    fontSize: 12,
    color: colors.dark,
    lineHeight: 17,
  },
  progressHint: {
    fontSize: 12,
    color: colors.gray,
    textAlign: 'center',
    marginTop: spacing.lg,
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
    marginTop: spacing.sm,
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
