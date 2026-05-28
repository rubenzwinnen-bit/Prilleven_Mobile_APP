/**
 * SYMPTOM FORM SCREEN — v2.7.1 (Reactie loggen — website-paritair)
 *
 * Spiegel van de website-modal `openSymptomLogModal` (symptomLogModal.js).
 * Vervangt de oude 16-type symptoomkeuze door één eenvoudig "Reactie
 * loggen"-formulier waarbij elke entry naar de server gaat met
 * `symptom_type='anders'`. Ernst wordt gekozen via een stoplicht
 * (🟢/🟠/🔴) en de gebruiker linkt de reactie verplicht aan één van de
 * geïntroduceerde allergenen via een dropdown.
 *
 * Verplichte velden:
 *   - linked_allergen_key (één van de geïntroduceerde allergenen)
 *   - severity (mild / matig / heftig)
 *   - occurred_at (default = nu)
 *
 * Optionele context-chips (single-select per groep, klik-nogmaals = uit):
 *   - time_after_eating, duration, worsened, behavior
 *
 * Plus notities (max 500 tekens).
 *
 * Route-params: { childId, symptomId? }. Als `symptomId` ontbreekt wordt het
 * een nieuwe entry. Een legend-modal ("Wat betekenen deze?") legt het
 * stoplicht uit.
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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { colors, radius, spacing, shadows } from '../constants/theme';
import { useToast } from '../components/Toast';
import {
  ALLERGEN_FLOW,
  createEhSymptom,
  updateEhSymptom,
  getEhSymptoms,
  getEhDoses,
  getChildren,
  getEhState,
  patchEhState,
} from '../services';
import type {
  SymptomSeverity,
  EhSymptom,
  TimeAfterEating,
  SymptomDuration,
  SymptomWorsened,
  SymptomBehavior,
} from '../services';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'SymptomForm'>;

const HEADER_CONTENT_HEIGHT = 42;
const DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}$/;

interface SeverityOption {
  value: SymptomSeverity;
  icon: string;
  label: string;
  hint: string;
}

const SEVERITY_OPTIONS: readonly SeverityOption[] = [
  { value: 'mild', icon: '🟢', label: 'Mild', hint: 'meestal verder doen' },
  {
    value: 'matig',
    icon: '🟠',
    label: 'Twijfel',
    hint: 'tijdelijk pauzeren + opvolgen',
  },
  {
    value: 'heftig',
    icon: '🔴',
    label: 'Ernstig',
    hint: 'stoppen + medische hulp',
  },
] as const;

interface ChipOption<T extends string> {
  value: T;
  label: string;
}

const TIME_AFTER_EATING_OPTIONS: readonly ChipOption<TimeAfterEating>[] = [
  { value: 'direct', label: 'Direct (<15 min)' },
  { value: 'snel', label: 'Snel (15 min – 1 u)' },
  { value: 'later', label: 'Later (1 – 4 u)' },
  { value: 'veel-later', label: 'Veel later (>4 u)' },
  { value: 'onbekend', label: 'Onbekend' },
] as const;

const DURATION_OPTIONS: readonly ChipOption<SymptomDuration>[] = [
  { value: 'kort', label: 'Kort (<30 min)' },
  { value: 'paar-uur', label: 'Een paar uur' },
  { value: 'halve-dag', label: 'Een halve dag' },
  { value: 'dag-of-langer', label: 'Een dag of langer' },
  { value: 'nog-bezig', label: 'Nog bezig' },
] as const;

const WORSENED_OPTIONS: readonly ChipOption<SymptomWorsened>[] = [
  { value: 'stabiel', label: 'Bleef stabiel' },
  { value: 'langzaam-erger', label: 'Langzaam erger' },
  { value: 'snel-erger', label: 'Snel erger' },
  { value: 'minder', label: 'Werden minder' },
] as const;

const BEHAVIOR_OPTIONS: readonly ChipOption<SymptomBehavior>[] = [
  { value: 'normaal', label: 'Normaal' },
  { value: 'onrustig', label: 'Onrustig/huilerig' },
  { value: 'ongemakkelijk', label: 'Erg ongemakkelijk' },
  { value: 'suf', label: 'Suf/lethargisch' },
] as const;

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

/* ----------------------------------------
   Datetime-helpers
---------------------------------------- */
function nowLocalDatetime(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return nowLocalDatetime();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

function localInputToIso(input: string): string | null {
  if (!DATETIME_REGEX.test(input)) return null;
  const normalized = input.replace(' ', 'T') + ':00';
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function validateDatetime(input: string): string | null {
  if (!DATETIME_REGEX.test(input)) {
    return 'Gebruik formaat jjjj-mm-dd uu:mm.';
  }
  const iso = localInputToIso(input);
  if (!iso) return 'Geen geldige datum.';
  const date = new Date(iso);
  if (date.getTime() > Date.now() + 60_000) {
    return 'Tijdstip kan niet in de toekomst liggen.';
  }
  return null;
}

/* ----------------------------------------
   Stoplicht-legend modal
---------------------------------------- */
function StoplightLegend({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.legendOverlay}>
        <View style={styles.legendCard}>
          <ScrollView contentContainerStyle={styles.legendScroll}>
            <Text style={styles.legendTitle}>Stoplicht — uitleg</Text>
            <Text style={styles.legendDisclaimer}>
              Dit vervangt geen medisch advies.
            </Text>

            <View style={[styles.legendSection, styles.legendSectionGreen]}>
              <Text style={styles.legendSectionTitle}>
                🟢 Mild — meestal verder doen
              </Text>
              {[
                '1–2 rode vlekjes rond mond door contact met voeding',
                'Kortdurende lichte roodheid',
                'Eenmalig losse stoelgang',
                'Wat meer windjes',
                'Licht veranderd stoelgangpatroon',
                'Klein beetje voeding teruggeven/spugen',
                'Kind eet minder van een nieuw allergeen maar is verder oké',
              ].map(item => (
                <Text key={item} style={styles.legendBullet}>
                  • {item}
                </Text>
              ))}
            </View>

            <View style={[styles.legendSection, styles.legendSectionOrange]}>
              <Text style={styles.legendSectionTitle}>
                🟠 Twijfel — tijdelijk pauzeren + opvolgen
              </Text>
              {[
                'Herhaald braken',
                'Toenemende huiduitslag',
                'Netelroos op meerdere plaatsen',
                'Diarree meerdere keren',
                'Opvallend ongemak/huilen',
                'Symptomen die telkens terugkomen bij hetzelfde allergeen',
              ].map(item => (
                <Text key={item} style={styles.legendBullet}>
                  • {item}
                </Text>
              ))}
            </View>

            <View style={[styles.legendSection, styles.legendSectionRed]}>
              <Text style={styles.legendSectionTitle}>
                🔴 Ernstig — stoppen + medische hulp
              </Text>
              {[
                'Moeite met ademhalen',
                'Zwelling lippen/tong/oogleden',
                'Heesheid/piepend ademhalen',
                'Sufheid/flauwvallen',
                'Ernstige herhaaldelijke braakreacties',
                'Snelle verspreiding van netelroos',
                'Combinatie van meerdere symptomen tegelijk',
              ].map(item => (
                <Text key={item} style={styles.legendBullet}>
                  • {item}
                </Text>
              ))}
            </View>

            <Text style={styles.legendFootnote}>
              Bij twijfel: contacteer je huisarts, kinderarts of Kind &amp;
              Gezin.
            </Text>

            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.legendCloseBtn,
                pressed && styles.btnPressed,
              ]}
            >
              <Text style={styles.legendCloseText}>Sluiten</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/* ----------------------------------------
   SymptomFormScreen
---------------------------------------- */
export function SymptomFormScreen({ navigation, route }: Props) {
  const { show } = useToast();
  const { childId, symptomId } = route.params;
  const isEdit = !!symptomId;

  /* Form state */
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [childName, setChildName] = useState('');
  const [introducedKeys, setIntroducedKeys] = useState<string[]>([]);
  const [linkedAllergen, setLinkedAllergen] = useState<string | null>(null);
  const [severity, setSeverity] = useState<SymptomSeverity | null>(null);
  const [occurredAt, setOccurredAt] = useState(nowLocalDatetime());
  const [timeAfterEating, setTimeAfterEating] =
    useState<TimeAfterEating | null>(null);
  const [duration, setDuration] = useState<SymptomDuration | null>(null);
  const [worsened, setWorsened] = useState<SymptomWorsened | null>(null);
  const [behavior, setBehavior] = useState<SymptomBehavior | null>(null);
  const [notes, setNotes] = useState('');
  const [legendOpen, setLegendOpen] = useState(false);
  const [allergenPickerOpen, setAllergenPickerOpen] = useState(false);

  /* Laad child + introducedKeys + (bij edit) bestaande entry */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [list, doses, ehState] = await Promise.all([
          getChildren(),
          getEhDoses(childId).catch(() => []),
          getEhState(childId).catch(() => null),
        ]);
        if (cancelled) return;
        const target = list.find(c => c.id === childId);
        if (target) setChildName(target.name);

        /* Spiegel van `computeIntroducedKeys()` in
           `js/components/allergenen.js`: doses + pre_introduced +
           known_allergies allemaal selecteerbaar als gelinkt allergeen. */
        const keySet = new Set<string>();
        for (const d of doses) keySet.add(d.allergen_key);
        for (const k of ehState?.allergen_state?.pre_introduced ?? []) {
          keySet.add(k);
        }
        for (const k of ehState?.allergen_state?.known_allergies ?? []) {
          keySet.add(k);
        }
        const keys = Array.from(keySet);
        // Sorteer op flow-volgorde
        keys.sort((a, b) => {
          const oa = ALLERGEN_FLOW.find(x => x.key === a)?.order ?? 99;
          const ob = ALLERGEN_FLOW.find(x => x.key === b)?.order ?? 99;
          return oa - ob;
        });
        setIntroducedKeys(keys);

        if (isEdit && symptomId) {
          const all = await getEhSymptoms(childId, { limit: 200 });
          if (cancelled) return;
          const existing: EhSymptom | undefined = all.find(
            s => s.id === symptomId
          );
          if (!existing) {
            show('Reactie niet gevonden.', 'error');
            navigation.goBack();
            return;
          }
          setSeverity(existing.severity);
          setOccurredAt(isoToLocalInput(existing.occurred_at));
          setNotes(existing.notes ?? '');
          setLinkedAllergen(existing.linked_allergen_key ?? null);
          setTimeAfterEating(existing.time_after_eating ?? null);
          setDuration(existing.duration ?? null);
          setWorsened(existing.worsened ?? null);
          setBehavior(existing.behavior ?? null);
        }
      } catch (err: any) {
        if (!cancelled) {
          show(err.message || 'Kon reactie-data niet laden.', 'error');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [childId, isEdit, symptomId, navigation, show]);

  /* Afgeleid */
  const trimmedDt = occurredAt.trim();
  const dtError = useMemo(() => validateDatetime(trimmedDt), [trimmedDt]);
  const allergenError = !linkedAllergen;
  const severityError = !severity;
  const canSave =
    !dtError &&
    !allergenError &&
    !severityError &&
    notes.length <= 500 &&
    !saving &&
    !loading;

  const handleSave = useCallback(async () => {
    if (!canSave || !severity || !linkedAllergen) return;
    const iso = localInputToIso(trimmedDt);
    if (!iso) {
      show('Tijdstip kon niet geparsed worden.', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        symptom_type: 'anders' as const,
        severity,
        occurred_at: iso,
        notes: notes.trim() ? notes.trim() : null,
        linked_allergen_key: linkedAllergen,
        time_after_eating: timeAfterEating,
        duration,
        worsened,
        behavior,
      };
      if (isEdit && symptomId) {
        await updateEhSymptom(symptomId, payload);
        show('Reactie bijgewerkt.', 'success');
      } else {
        await createEhSymptom({ child_id: childId, ...payload });
        show('Reactie opgeslagen.', 'success');

        /* Auto-trigger pauze-flow — paritair met `js/components/allergenen.js`
           in de website. Bij een nieuwe reactie met matig/heftig + gelinkt
           allergeen pauzeren we de flow en starten we op stap 1. We slaan
           de trigger over als de gebruiker al gepauzeerd is. */
        if (
          (severity === 'matig' || severity === 'heftig') &&
          linkedAllergen &&
          linkedAllergen !== 'onbekend'
        ) {
          try {
            const currentState = await getEhState(childId);
            const allergenState = currentState?.allergen_state;
            const alreadyPaused =
              !!allergenState?.paused && (allergenState?.paused_step || 0) > 0;
            if (!alreadyPaused) {
              await patchEhState(childId, {
                allergen_state: {
                  ...(allergenState ?? {}),
                  paused: true,
                  paused_type: severity === 'matig' ? 'twijfel' : 'ernstig',
                  paused_step: 1,
                  paused_allergen: linkedAllergen,
                },
              });
            }
          } catch (pauseErr) {
            // Stille fallback: gebruiker ziet bij focus-refresh wel de banner,
            // maar de pauze-flow start dan niet automatisch.
            console.warn('Pauze-trigger mislukt:', pauseErr);
          }
        }
      }
      navigation.goBack();
    } catch (err: any) {
      show(err.message || 'Opslaan mislukt.', 'error');
    } finally {
      setSaving(false);
    }
  }, [
    canSave,
    severity,
    linkedAllergen,
    trimmedDt,
    isEdit,
    symptomId,
    childId,
    notes,
    timeAfterEating,
    duration,
    worsened,
    behavior,
    navigation,
    show,
  ]);

  /* Helper voor chip-rij (single-select per groep, klik-nogmaals = uit) */
  function renderChipRow<T extends string>(
    options: readonly ChipOption<T>[],
    selected: T | null,
    onChange: (next: T | null) => void
  ) {
    return (
      <View style={styles.chipRow}>
        {options.map(opt => {
          const active = selected === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(active ? null : opt.value)}
              style={({ pressed }) => [
                styles.chip,
                active && styles.chipActive,
                pressed && styles.btnPressed,
              ]}
            >
              <Text
                style={[styles.chipText, active && styles.chipTextActive]}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  /* Allergenen die getoond worden in de dropdown — enkel geïntroduceerde.
     Geen emoji-iconen: enkel tekst, zoals op de website. */
  const allergenChoices = useMemo(() => {
    return ALLERGEN_FLOW.filter(a => introducedKeys.includes(a.key)).map(a => ({
      key: a.key,
      label: a.label,
    }));
  }, [introducedKeys]);

  const selectedAllergen = useMemo(
    () => allergenChoices.find(a => a.key === linkedAllergen) ?? null,
    [allergenChoices, linkedAllergen]
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <ChevronBack onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>
          {isEdit ? 'Reactie bewerken' : 'Reactie loggen'}
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
            {/* Subtitle / disclaimer */}
            {childName ? (
              <Text style={styles.subtitle}>
                Voor {childName} —{' '}
                <Text style={styles.subtitleDisclaimer}>
                  dit vervangt geen medisch advies.
                </Text>
              </Text>
            ) : (
              <Text style={styles.subtitle}>
                <Text style={styles.subtitleDisclaimer}>
                  Dit vervangt geen medisch advies.
                </Text>
              </Text>
            )}

            {/* Welk allergeen? */}
            <Text style={styles.fieldLabel}>Welk allergeen? *</Text>
            {allergenChoices.length === 0 ? (
              <Text style={styles.emptyHint}>
                Er zijn nog geen allergenen geïntroduceerd voor dit kindje.
                Log eerst een introductie vóór je een reactie registreert.
              </Text>
            ) : (
              <Pressable
                onPress={() => setAllergenPickerOpen(true)}
                disabled={saving}
                style={({ pressed }) => [
                  styles.dropdownTrigger,
                  pressed && styles.btnPressed,
                ]}
              >
                {selectedAllergen ? (
                  <Text style={styles.dropdownValueLabel}>
                    {selectedAllergen.label}
                  </Text>
                ) : (
                  <Text style={styles.dropdownPlaceholder}>
                    Kies een allergeen…
                  </Text>
                )}
                <Feather
                  name="chevron-down"
                  size={18}
                  color={colors.darkLight}
                />
              </Pressable>
            )}

            <Modal
              visible={allergenPickerOpen}
              animationType="fade"
              transparent
              onRequestClose={() => setAllergenPickerOpen(false)}
            >
              <Pressable
                style={styles.dropdownOverlay}
                onPress={() => setAllergenPickerOpen(false)}
              >
                <Pressable style={styles.dropdownSheet} onPress={() => {}}>
                  <Text style={styles.dropdownSheetTitle}>
                    Kies een allergeen
                  </Text>
                  <ScrollView
                    style={styles.dropdownScroll}
                    keyboardShouldPersistTaps="handled"
                  >
                    {allergenChoices.map(item => {
                      const active = linkedAllergen === item.key;
                      return (
                        <Pressable
                          key={item.key}
                          onPress={() => {
                            setLinkedAllergen(item.key);
                            setAllergenPickerOpen(false);
                          }}
                          style={({ pressed }) => [
                            styles.dropdownOption,
                            active && styles.dropdownOptionActive,
                            pressed && styles.btnPressed,
                          ]}
                        >
                          <Text
                            style={[
                              styles.dropdownOptionLabel,
                              active && styles.dropdownOptionLabelActive,
                            ]}
                          >
                            {item.label}
                          </Text>
                          {active ? (
                            <Feather
                              name="check"
                              size={16}
                              color={colors.primary}
                            />
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                  <Pressable
                    onPress={() => setAllergenPickerOpen(false)}
                    style={({ pressed }) => [
                      styles.dropdownCloseBtn,
                      pressed && styles.btnPressed,
                    ]}
                  >
                    <Text style={styles.dropdownCloseText}>Sluiten</Text>
                  </Pressable>
                </Pressable>
              </Pressable>
            </Modal>

            {/* Ernst — stoplicht */}
            <View style={styles.severityHeaderRow}>
              <Text style={styles.fieldLabel}>Ernst *</Text>
              <Pressable onPress={() => setLegendOpen(true)} hitSlop={6}>
                <Text style={styles.legendLink}>Wat betekenen deze? →</Text>
              </Pressable>
            </View>
            <View style={styles.stoplightRow}>
              {SEVERITY_OPTIONS.map(opt => {
                const active = severity === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setSeverity(opt.value)}
                    style={({ pressed }) => [
                      styles.stoplightChip,
                      active && stoplightActiveStyle(opt.value),
                      pressed && styles.btnPressed,
                    ]}
                  >
                    <Text style={styles.stoplightIcon}>{opt.icon}</Text>
                    <Text style={styles.stoplightLabel}>{opt.label}</Text>
                    <Text style={styles.stoplightHint}>{opt.hint}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Tijdstip */}
            <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>
              Wanneer? *
            </Text>
            <TextInput
              style={styles.textInput}
              value={occurredAt}
              onChangeText={setOccurredAt}
              placeholder={nowLocalDatetime()}
              placeholderTextColor={colors.grayLight}
              keyboardType="numbers-and-punctuation"
              maxLength={16}
              autoCorrect={false}
              autoCapitalize="none"
              editable={!saving}
            />
            <Text style={styles.fieldHint}>
              Formaat jjjj-mm-dd uu:mm
              {occurredAt.length > 0 && dtError ? ` · ${dtError}` : ''}
            </Text>

            {/* Optionele context-velden */}
            <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>
              Hoe snel na eten?{' '}
              <Text style={styles.optional}>(optioneel)</Text>
            </Text>
            {renderChipRow(
              TIME_AFTER_EATING_OPTIONS,
              timeAfterEating,
              setTimeAfterEating
            )}

            <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>
              Hoe lang duurde het?{' '}
              <Text style={styles.optional}>(optioneel)</Text>
            </Text>
            {renderChipRow(DURATION_OPTIONS, duration, setDuration)}

            <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>
              Werden symptomen erger?{' '}
              <Text style={styles.optional}>(optioneel)</Text>
            </Text>
            {renderChipRow(WORSENED_OPTIONS, worsened, setWorsened)}

            <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>
              Hoe gedroeg kindje zich?{' '}
              <Text style={styles.optional}>(optioneel)</Text>
            </Text>
            {renderChipRow(BEHAVIOR_OPTIONS, behavior, setBehavior)}

            {/* Notitie */}
            <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>
              Notitie <Text style={styles.optional}>(optioneel)</Text>
            </Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="bv. rode vlekjes op wangen, ongeveer 1u na het eten"
              placeholderTextColor={colors.grayLight}
              multiline
              maxLength={500}
              editable={!saving}
            />
            <Text style={styles.fieldHint}>{notes.length}/500 tekens</Text>

            {/* Save / Annuleren */}
            <View style={styles.actionsRow}>
              <Pressable
                onPress={() => navigation.goBack()}
                style={({ pressed }) => [
                  styles.cancelBtn,
                  pressed && styles.btnPressed,
                ]}
              >
                <Text style={styles.cancelBtnText}>Annuleren</Text>
              </Pressable>
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
                    <Text style={styles.saveBtnText}>Opslaan</Text>
                  </>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      <StoplightLegend
        visible={legendOpen}
        onClose={() => setLegendOpen(false)}
      />
    </SafeAreaView>
  );
}

/* Actieve achtergrond per stoplicht-kleur. */
function stoplightActiveStyle(value: SymptomSeverity) {
  if (value === 'mild') {
    return { borderColor: colors.secondaryDark, backgroundColor: '#e8f3ec' };
  }
  if (value === 'matig') {
    return { borderColor: colors.warning, backgroundColor: '#fdf3cf' };
  }
  return { borderColor: colors.danger, backgroundColor: '#f7e3df' };
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
  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  subtitle: {
    fontSize: 13,
    color: colors.darkLight,
    marginBottom: spacing.lg,
    lineHeight: 18,
  },
  subtitleDisclaimer: {
    fontStyle: 'italic',
    color: colors.gray,
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
  emptyHint: {
    fontSize: 12,
    color: colors.gray,
    fontStyle: 'italic',
    marginBottom: spacing.xs,
    lineHeight: 17,
  },

  /* Allergen-dropdown */
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.light,
    backgroundColor: colors.white,
    ...shadows.sm,
  },
  dropdownValueLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.dark,
  },
  dropdownPlaceholder: {
    fontSize: 14,
    color: colors.grayLight,
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  dropdownSheet: {
    maxHeight: '80%',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    overflow: 'hidden',
    paddingTop: spacing.md,
  },
  dropdownSheetTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.dark,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  dropdownScroll: {
    paddingHorizontal: spacing.md,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: colors.white,
    marginBottom: 4,
  },
  dropdownOptionActive: {
    borderColor: colors.primary,
    backgroundColor: '#fbf0e6',
  },
  dropdownOptionLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.dark,
  },
  dropdownOptionLabelActive: {
    color: colors.primary,
  },
  dropdownCloseBtn: {
    margin: spacing.md,
    paddingVertical: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  dropdownCloseText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },

  /* Stoplicht */
  severityHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  legendLink: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  stoplightRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stoplightChip: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.light,
    backgroundColor: colors.white,
    alignItems: 'center',
    ...shadows.sm,
  },
  stoplightIcon: {
    fontSize: 24,
    marginBottom: 2,
  },
  stoplightLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.dark,
  },
  stoplightHint: {
    fontSize: 10,
    color: colors.gray,
    marginTop: 2,
    textAlign: 'center',
    lineHeight: 13,
  },

  /* Chip-row (4 optionele groepen) */
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
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
    backgroundColor: '#fbf0e6',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.dark,
  },
  chipTextActive: {
    color: colors.primary,
  },

  /* Inputs */
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

  /* Actie-knoppen */
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.light,
    backgroundColor: colors.white,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.dark,
  },
  saveBtn: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
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

  /* Legend-modal */
  legendOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  legendCard: {
    maxHeight: '90%',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  legendScroll: {
    padding: spacing.lg,
  },
  legendTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.dark,
    marginBottom: 4,
  },
  legendDisclaimer: {
    fontSize: 12,
    fontStyle: 'italic',
    color: colors.gray,
    marginBottom: spacing.md,
  },
  legendSection: {
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  legendSectionGreen: {
    backgroundColor: '#e8f3ec',
  },
  legendSectionOrange: {
    backgroundColor: '#fdf3cf',
  },
  legendSectionRed: {
    backgroundColor: '#f7e3df',
  },
  legendSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.dark,
    marginBottom: spacing.xs,
  },
  legendBullet: {
    fontSize: 12,
    color: colors.dark,
    lineHeight: 18,
  },
  legendFootnote: {
    fontSize: 12,
    color: colors.darkLight,
    fontStyle: 'italic',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  legendCloseBtn: {
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  legendCloseText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
});
