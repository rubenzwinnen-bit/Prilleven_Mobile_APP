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
 * Allergenen-introductie keuze (parity met web `renderKindForm`, Optie B):
 *   - "Al geïntroduceerde allergenen" checkbox-grid → pre_introduced
 *   - twee elkaar uitsluitende keuzes: introductie nog volgen / functie
 *     uitschakelen (opted_out). Bij bewerken vooraf ingevuld uit ehState.
 *   - validatie: minstens 1 vakje OF 1 van de 2 keuzes aangevinkt.
 *   - na opslaan kind: `patchEhState` met pre_introduced + opted_out
 *     (niet-blokkerend; kind is dan al opgeslagen).
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
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { colors, radius, spacing, shadows } from '../constants/theme';
import { useToast } from '../components/Toast';
import {
  getChildren,
  createChild,
  updateChild,
  getEhState,
  patchEhState,
  BIRTHDATE_REGEX,
  KNOWN_ALLERGEN_OPTIONS,
} from '../services';
import type { Child } from '../services';
import type { RootStackParamList } from '../navigation/types';

/** Format an ISO date (yyyy-mm-dd) as Belgian display string (dd/mm/yyyy).
 *  Returns '' wanneer de input leeg of ongeldig is. */
function isoToDisplay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** Build today's ISO date (yyyy-mm-dd). */
function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Build the ISO date 10 years ago (yyyy-mm-dd). */
function tenYearsAgoIso(): string {
  const now = new Date();
  const d = new Date(now.getFullYear() - 10, now.getMonth(), now.getDate());
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Format a Date object as ISO yyyy-mm-dd in the local timezone. */
function dateToIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/* ----------------------------------------
   BirthdateField — cross-platform date picker
   - Web: native HTML <input type="date"> (toont calendar-dropdown in nl-BE
     locale = dd/mm/yyyy formaat).
   - iOS/Android: Pressable opent native DateTimePicker.
   - Interne state blijft altijd ISO (yyyy-mm-dd) → matches API.
---------------------------------------- */
function BirthdateField({
  iso,
  onChange,
  disabled,
}: {
  iso: string;
  onChange: (iso: string) => void;
  disabled?: boolean;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const maxIso = todayIso();
  const minIso = tenYearsAgoIso();

  if (Platform.OS === 'web') {
    // React Native Web laat HTML-elementen door — gebruik native date input
    // zodat de browser z'n eigen kalender-dropdown opent.
    return React.createElement('input', {
      type: 'date',
      value: iso,
      disabled,
      max: maxIso,
      min: minIso,
      onChange: (e: { target: { value: string } }) =>
        onChange(e.target.value || ''),
      style: {
        width: '100%',
        backgroundColor: colors.white,
        border: `1px solid ${colors.light}`,
        borderRadius: radius.sm,
        padding: '10px 16px',
        fontSize: 15,
        color: iso ? colors.dark : colors.grayLight,
        boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
        fontFamily: 'inherit',
        outline: 'none',
        boxSizing: 'border-box',
      },
    });
  }

  // Native (iOS/Android)
  const display = isoToDisplay(iso);
  const initialDate = iso ? new Date(`${iso}T00:00:00`) : new Date();
  const maxDate = new Date();
  const minDate = new Date(
    maxDate.getFullYear() - 10,
    maxDate.getMonth(),
    maxDate.getDate()
  );

  const handleChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
    if (event.type === 'dismissed') return;
    if (selectedDate) onChange(dateToIso(selectedDate));
  };

  return (
    <>
      <Pressable
        onPress={() => !disabled && setShowPicker(true)}
        style={({ pressed }) => [
          styles.textInput,
          styles.dateFieldRow,
          pressed && styles.btnPressed,
          disabled && styles.btnDisabled,
        ]}
        accessibilityLabel="Geboortedatum kiezen"
      >
        <Text
          style={[
            styles.dateFieldText,
            !display && styles.dateFieldPlaceholder,
          ]}
        >
          {display || 'dd/mm/jjjj'}
        </Text>
        <Feather name="calendar" size={16} color={colors.primary} />
      </Pressable>
      {showPicker && (
        <DateTimePicker
          value={initialDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          maximumDate={maxDate}
          minimumDate={minDate}
          locale="nl-BE"
          onChange={handleChange}
        />
      )}
      {Platform.OS === 'ios' && showPicker && (
        <Pressable
          onPress={() => setShowPicker(false)}
          style={styles.pickerDone}
        >
          <Text style={styles.pickerDoneText}>Klaar</Text>
        </Pressable>
      )}
    </>
  );
}

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
 *  Input = ISO yyyy-mm-dd (interne format). Geeft null bij valid; anders een
 *  gebruikersvriendelijke melding. */
function validateBirthdate(input: string): string | null {
  if (!input) return 'Geboortedatum is verplicht.';
  if (!BIRTHDATE_REGEX.test(input)) {
    return 'Geen geldige datum.';
  }
  const [y, m, d] = input.split('-').map(Number);
  const date = new Date(`${input}T00:00:00`);
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

  /* Allergenen-introductie keuze (Optie B, parity met web). */
  const [preIntroduced, setPreIntroduced] = useState<string[]>([]);
  const [prepFollow, setPrepFollow] = useState(false);
  const [prepDisable, setPrepDisable] = useState(false);

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

        /* Allergenen-keuze ophalen uit ehState zodat de tegels + keuzes
           vooraf juist staan. Niet-blokkerend (getEhState throwt als er nog
           geen state is) → form toont dan lege keuze. Web-parity:
           prepFollow = !optedOut bij bewerken. */
        try {
          const ehState = await getEhState(editingId);
          if (cancelled) return;
          const a = ehState?.allergen_state;
          const optedOut = !!a?.opted_out;
          setPreIntroduced(Array.isArray(a?.pre_introduced) ? a.pre_introduced : []);
          setPrepDisable(optedOut);
          setPrepFollow(!optedOut);
        } catch {
          if (cancelled) return;
          setPreIntroduced([]);
          setPrepDisable(false);
          setPrepFollow(true);
        }
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
  const toggleAllergen = useCallback((key: string) => {
    setKnownAllergies(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  }, []);

  const togglePreIntroduced = useCallback((key: string) => {
    setPreIntroduced(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  }, []);

  const allPreSelected =
    preIntroduced.length === KNOWN_ALLERGEN_OPTIONS.length;
  const toggleAllPre = useCallback(() => {
    setPreIntroduced(prev =>
      prev.length === KNOWN_ALLERGEN_OPTIONS.length
        ? []
        : KNOWN_ALLERGEN_OPTIONS.map(o => o.key)
    );
  }, []);

  /* Twee elkaar uitsluitende keuzes. */
  const onTogglePrepFollow = useCallback(() => {
    setPrepFollow(prev => {
      const next = !prev;
      if (next) setPrepDisable(false);
      return next;
    });
  }, []);
  const onTogglePrepDisable = useCallback(() => {
    setPrepDisable(prev => {
      const next = !prev;
      if (next) setPrepFollow(false);
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (saving || loading) return;
    // Validatie-feedback i.p.v. stilzwijgend de knop disabled houden:
    // toon de specifieke melding zodat de gebruiker weet wat er mist.
    if (!trimmedName) {
      show('Vul een naam in.', 'error');
      return;
    }
    if (trimmedName.length > 50) {
      show('Naam mag max 50 tekens zijn.', 'error');
      return;
    }
    if (birthdateError) {
      show(birthdateError, 'error');
      return;
    }
    if (previousReactions.length > 1000) {
      show('Eerdere reacties mag max 1000 tekens zijn.', 'error');
      return;
    }
    if (notes.length > 500) {
      show('Opmerkingen mag max 500 tekens zijn.', 'error');
      return;
    }
    // Allergenen-keuze: minstens 1 vakje OF 1 van de 2 opties (web-parity).
    if (!prepFollow && !prepDisable && preIntroduced.length === 0) {
      show(
        'Maak een keuze onder "Al geïntroduceerde allergenen": vink één van de twee opties aan, of selecteer minstens één allergeen.',
        'error'
      );
      return;
    }
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

      /* Allergenen-keuze opslaan in eerste_hapjes_state (nieuw kind én
         bewerken). Niet-blokkerend: het kind is al opgeslagen. */
      const targetChildId = isEdit && editingId ? editingId : result.id;
      if (targetChildId) {
        const allergenPatch = prepDisable
          ? { opted_out: true, setup_done: true }
          : { pre_introduced: preIntroduced, setup_done: true, opted_out: false };
        try {
          await patchEhState(targetChildId, { allergen_state: allergenPatch });
        } catch {
          /* niet-blokkerend */
        }
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
    saving,
    loading,
    trimmedName,
    trimmedBirthdate,
    birthdateError,
    knownAllergies,
    previousReactions,
    notes,
    prepFollow,
    prepDisable,
    preIntroduced,
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
            <BirthdateField
              iso={birthdate}
              onChange={setBirthdate}
              disabled={saving}
            />
            <Text style={styles.fieldHint}>
              Formaat dd/mm/jjjj · binnen de laatste 10 jaar
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

            {/* Allergenen-introductie keuze (Optie B, parity met web) */}
            <View style={styles.prepHead}>
              <Text style={[styles.fieldLabel, { marginBottom: 0 }]}>
                Al geïntroduceerde allergenen
              </Text>
              <Pressable onPress={toggleAllPre} hitSlop={8} disabled={saving}>
                <Text style={styles.prepLink}>
                  {allPreSelected ? 'Alles deselecteren' : 'Alles selecteren'}
                </Text>
              </Pressable>
            </View>
            <Text style={styles.fieldHint}>
              Vink aan welke allergenen je kindje al regelmatig en zonder
              reactie heeft gegeten. Deze slaan we over in de
              allergenen-tracker.
            </Text>
            <View style={styles.prepList}>
              {KNOWN_ALLERGEN_OPTIONS.map(opt => (
                <CheckRow
                  key={opt.key}
                  label={`${opt.icon} ${opt.label}`}
                  checked={preIntroduced.includes(opt.key)}
                  onPress={() => togglePreIntroduced(opt.key)}
                  disabled={saving}
                />
              ))}
            </View>
            <View style={styles.prepChoice}>
              <CheckRow
                label={'Ik ga de introductie nog volgen, zie functie "Allergenen introduceren".'}
                checked={prepFollow}
                onPress={onTogglePrepFollow}
                disabled={saving}
                multiline
              />
              <CheckRow
                label={'Ik wil de functie "Allergenen introduceren" niet volgen, schakel de functie uit.'}
                checked={prepDisable}
                onPress={onTogglePrepDisable}
                disabled={saving}
                multiline
              />
            </View>

            {/* Save — altijd klikbaar; validatie geeft duidelijke toast-feedback */}
            <Pressable
              onPress={handleSave}
              disabled={saving || loading}
              style={({ pressed }) => [
                styles.saveBtn,
                pressed && styles.btnPressed,
                (saving || loading) && styles.btnDisabled,
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

function CheckRow({
  label,
  checked,
  onPress,
  disabled,
  multiline,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
  disabled?: boolean;
  multiline?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.checkRow,
        multiline && styles.checkRowMultiline,
        pressed && styles.btnPressed,
      ]}
    >
      <Feather
        name={checked ? 'check-square' : 'square'}
        size={20}
        color={checked ? colors.primary : colors.grayLight}
      />
      <Text style={styles.checkRowText}>{label}</Text>
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
  dateFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateFieldText: {
    fontSize: 15,
    color: colors.dark,
  },
  dateFieldPlaceholder: {
    color: colors.grayLight,
  },
  pickerDone: {
    alignSelf: 'flex-end',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  pickerDoneText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
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
  prepHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  prepLink: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  prepList: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  prepChoice: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 6,
  },
  checkRowMultiline: {
    alignItems: 'flex-start',
  },
  checkRowText: {
    flex: 1,
    fontSize: 14,
    color: colors.dark,
    lineHeight: 20,
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
