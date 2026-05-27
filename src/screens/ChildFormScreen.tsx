/**
 * CHILD FORM SCREEN — fase 2
 *
 * Add/edit-formulier voor een kind. Route-param `childId`:
 *   - aanwezig → edit-modus (haalt kind op via `getChildren()`).
 *   - afwezig  → create-modus.
 *
 * Velden (parity met website-validatie):
 *   - name                  (verplicht, trim, max 50)
 *   - birthdate             (verplicht, regex jjjj-mm-dd, max vandaag,
 *                            min 10 jaar terug)
 *   - known_allergies       (chips uit KNOWN_ALLERGEN_OPTIONS)
 *   - previous_reactions    (textarea, max 1000)
 *   - notes                 (textarea, max 500)
 *
 * Op succes: `navigation.goBack()` → ChildrenScreen herlaadt via
 * useFocusEffect.
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
  getChildren,
  createChild,
  updateChild,
  BIRTHDATE_REGEX,
  KNOWN_ALLERGEN_OPTIONS,
} from '../services';
import type { Child } from '../services';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ChildForm'>;

const HEADER_CONTENT_HEIGHT = 42;

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

/** Birthdate-validatie: regex + bereik (max vandaag, min 10 jaar terug).
 *  Geeft null bij valid; anders een gebruikersvriendelijke melding. */
function validateBirthdate(input: string): string | null {
  if (!BIRTHDATE_REGEX.test(input)) {
    return 'Gebruik formaat jjjj-mm-dd (bv. 2024-03-15).';
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
  const tenYearsAgo = new Date(
    today.getFullYear() - 10,
    today.getMonth(),
    today.getDate()
  );
  if (date.getTime() > today.getTime()) {
    return 'Geboortedatum kan niet in de toekomst liggen.';
  }
  if (date.getTime() < tenYearsAgo.getTime()) {
    return 'Geboortedatum moet binnen de laatste 10 jaar vallen.';
  }
  return null;
}

export function ChildFormScreen({ navigation, route }: Props) {
  const { show } = useToast();
  const editingId = route.params?.childId;
  const isEdit = Boolean(editingId);

  /* Form state */
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [knownAllergies, setKnownAllergies] = useState<string[]>([]);
  const [previousReactions, setPreviousReactions] = useState('');
  const [notes, setNotes] = useState('');

  /* Bestaand kind ophalen wanneer edit. `getChildren()` is OK omdat de
     lijst klein is; geen aparte GET /api/children/:id endpoint. */
  useEffect(() => {
    if (!editingId) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await getChildren();
        const target = list.find(c => c.id === editingId);
        if (cancelled) return;
        if (!target) {
          show('Kind niet gevonden.', 'error');
          navigation.goBack();
          return;
        }
        setName(target.name);
        setBirthdate(target.birthdate);
        setKnownAllergies(target.known_allergies);
        setPreviousReactions(target.previous_reactions ?? '');
        setNotes(target.notes ?? '');
      } catch (err: any) {
        if (!cancelled) {
          show(err.message || 'Kon kind niet laden.', 'error');
          navigation.goBack();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editingId, navigation, show]);

  /* Validatie */
  const trimmedName = name.trim();
  const trimmedBirthdate = birthdate.trim();
  const nameError = trimmedName ? null : 'Naam is verplicht.';
  const birthdateError = useMemo(
    () => validateBirthdate(trimmedBirthdate),
    [trimmedBirthdate]
  );
  const canSave =
    !!trimmedName &&
    trimmedName.length <= 50 &&
    !birthdateError &&
    previousReactions.length <= 1000 &&
    notes.length <= 500 &&
    !saving &&
    !loading;

  const toggleAllergen = useCallback((key: string) => {
    setKnownAllergies(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  }, []);

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = {
        name: trimmedName.slice(0, 50),
        birthdate: trimmedBirthdate,
        known_allergies: knownAllergies,
        previous_reactions: previousReactions.trim() || null,
        notes: notes.trim() || null,
      };
      let result: Child;
      if (isEdit && editingId) {
        result = await updateChild(editingId, payload);
      } else {
        result = await createChild(payload);
      }
      show(
        isEdit ? `${result.name} bijgewerkt.` : `${result.name} toegevoegd.`,
        'success'
      );
      navigation.goBack();
    } catch (err: any) {
      show(err.message || 'Opslaan mislukt.', 'error');
    } finally {
      setSaving(false);
    }
  }, [
    canSave,
    trimmedName,
    trimmedBirthdate,
    knownAllergies,
    previousReactions,
    notes,
    isEdit,
    editingId,
    navigation,
    show,
  ]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <ChevronBack onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>
          {isEdit ? 'Kind bewerken' : 'Kind toevoegen'}
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
            {/* Naam */}
            <Text style={styles.fieldLabel}>Naam *</Text>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
              placeholder="Voornaam"
              placeholderTextColor={colors.grayLight}
              maxLength={50}
              autoCapitalize="words"
              editable={!saving}
            />
            {trimmedName.length === 0 && (
              <Text style={styles.fieldError}>{nameError}</Text>
            )}

            {/* Geboortedatum */}
            <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>
              Geboortedatum *
            </Text>
            <TextInput
              style={styles.textInput}
              value={birthdate}
              onChangeText={setBirthdate}
              placeholder="2024-03-15"
              placeholderTextColor={colors.grayLight}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              autoCorrect={false}
              autoCapitalize="none"
              editable={!saving}
            />
            <Text style={styles.fieldHint}>
              Formaat jjjj-mm-dd · binnen de laatste 10 jaar
              {birthdate.length > 0 && birthdateError
                ? ` · ${birthdateError}`
                : ''}
            </Text>

            {/* Bekende allergieën */}
            <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>
              Bekende allergieën
            </Text>
            <Text style={styles.fieldHint}>
              Vink aan wat al bekend is. Pril Leven gebruikt dit om HapjesHeld
              persoonlijker te maken.
            </Text>
            <View style={styles.chipRow}>
              {KNOWN_ALLERGEN_OPTIONS.map(opt => (
                <Chip
                  key={opt.key}
                  label={`${opt.icon} ${opt.label}`}
                  active={knownAllergies.includes(opt.key)}
                  onPress={() => toggleAllergen(opt.key)}
                />
              ))}
            </View>

            {/* Eerdere reacties */}
            <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>
              Eerdere reacties
            </Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={previousReactions}
              onChangeText={setPreviousReactions}
              placeholder="Bv. uitslag na ei op 8 maanden."
              placeholderTextColor={colors.grayLight}
              multiline
              maxLength={1000}
              editable={!saving}
            />
            <Text style={styles.fieldHint}>
              {previousReactions.length}/1000 tekens
            </Text>

            {/* Opmerkingen */}
            <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>
              Opmerkingen
            </Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Extra info die HapjesHeld mag weten."
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
                  <Text style={styles.saveBtnText}>
                    {isEdit ? 'Wijzigingen opslaan' : 'Kind toevoegen'}
                  </Text>
                </>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active && styles.chipActive,
        pressed && styles.btnPressed,
      ]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </Pressable>
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
  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  loadingBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.light,
    backgroundColor: colors.white,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  chipText: {
    fontSize: 13,
    color: colors.dark,
    fontWeight: '500',
  },
  chipTextActive: {
    color: colors.white,
    fontWeight: '700',
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
