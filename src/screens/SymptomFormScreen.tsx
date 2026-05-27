/**
 * SYMPTOM FORM SCREEN — v2.6.0
 *
 * Modal-style scherm om een symptoom te loggen of te bewerken. Route-
 * params: { childId, symptomId? }. Als `symptomId` ontbreekt wordt het
 * een nieuwe entry.
 *
 * Velden:
 *   - symptom_type (16 chips)
 *   - severity (mild / matig / heftig)
 *   - occurred_at (default = nu, ISO timestamp)
 *   - linked_allergen (optioneel — 9 allergenen + "geen")
 *   - notes (max 500)
 *
 * Red-flag-banner: zodra (type, severity) een red-flag triggert tonen we
 * een prominente waarschuwing met advies om contact op te nemen met een
 * arts. Server bevestigt dit nadien via `red_flag: boolean` op de respons.
 *
 * Op succes: `navigation.goBack()` → SymptomLogScreen herlaadt via
 * useFocusEffect en toont de bijgewerkte entry.
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
  SYMPTOM_TYPES,
  SYMPTOM_SEVERITIES,
  ALLERGEN_FLOW,
  createEhSymptom,
  updateEhSymptom,
  getEhSymptoms,
  isRedFlag,
} from '../services';
import type {
  SymptomType,
  SymptomSeverity,
  EhSymptom,
} from '../services';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'SymptomForm'>;

const HEADER_CONTENT_HEIGHT = 42;
const DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}$/;

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

/** Vorm "jjjj-mm-dd uu:mm" (lokale tijdzone) voor de huidige tijd. */
function nowLocalDatetime(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

/** Vorm ISO-timestamp → "jjjj-mm-dd uu:mm" voor display. */
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

/** "jjjj-mm-dd uu:mm" (lokaal) → ISO-string. */
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

export function SymptomFormScreen({ navigation, route }: Props) {
  const { show } = useToast();
  const { childId, symptomId } = route.params;
  const isEdit = !!symptomId;

  /* Form state */
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [symptomType, setSymptomType] = useState<SymptomType>('huid');
  const [severity, setSeverity] = useState<SymptomSeverity>('mild');
  const [occurredAt, setOccurredAt] = useState(nowLocalDatetime());
  const [notes, setNotes] = useState('');
  const [linkedAllergen, setLinkedAllergen] = useState<string | null>(null);

  /* Bij edit: bestaande symptoom-data inladen */
  useEffect(() => {
    if (!isEdit || !symptomId) return;
    let cancelled = false;
    (async () => {
      try {
        const all = await getEhSymptoms(childId, { limit: 200 });
        if (cancelled) return;
        const existing: EhSymptom | undefined = all.find(
          s => s.id === symptomId
        );
        if (!existing) {
          show('Symptoom niet gevonden.', 'error');
          navigation.goBack();
          return;
        }
        setSymptomType(existing.symptom_type);
        setSeverity(existing.severity);
        setOccurredAt(isoToLocalInput(existing.occurred_at));
        setNotes(existing.notes ?? '');
        setLinkedAllergen(existing.linked_allergen ?? null);
      } catch (err: any) {
        if (!cancelled) {
          show(err.message || 'Kon symptoom niet laden.', 'error');
          navigation.goBack();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEdit, symptomId, childId, navigation, show]);

  /* Afgeleid */
  const trimmedDt = occurredAt.trim();
  const dtError = useMemo(() => validateDatetime(trimmedDt), [trimmedDt]);
  const redFlag = useMemo(
    () => isRedFlag(symptomType, severity),
    [symptomType, severity]
  );

  const canSave =
    !dtError && notes.length <= 500 && !saving && !loading;

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    const iso = localInputToIso(trimmedDt);
    if (!iso) {
      show('Tijdstip kon niet geparsed worden.', 'error');
      return;
    }
    setSaving(true);
    try {
      if (isEdit && symptomId) {
        await updateEhSymptom(symptomId, {
          symptom_type: symptomType,
          severity,
          occurred_at: iso,
          notes: notes.trim() ? notes.trim() : null,
          linked_allergen: linkedAllergen,
        });
        show('Symptoom bijgewerkt.', 'success');
      } else {
        await createEhSymptom({
          child_id: childId,
          symptom_type: symptomType,
          severity,
          occurred_at: iso,
          notes: notes.trim() ? notes.trim() : null,
          linked_allergen: linkedAllergen,
        });
        show('Symptoom opgeslagen.', 'success');
      }
      navigation.goBack();
    } catch (err: any) {
      show(err.message || 'Opslaan mislukt.', 'error');
    } finally {
      setSaving(false);
    }
  }, [
    canSave,
    trimmedDt,
    isEdit,
    symptomId,
    childId,
    symptomType,
    severity,
    notes,
    linkedAllergen,
    navigation,
    show,
  ]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <ChevronBack onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>
          {isEdit ? 'Symptoom bewerken' : 'Symptoom loggen'}
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
            {/* Red-flag banner */}
            {redFlag && (
              <View style={styles.redFlagBanner}>
                <Feather
                  name="alert-triangle"
                  size={20}
                  color={colors.danger}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.redFlagTitle}>Mogelijke rode vlag</Text>
                  <Text style={styles.redFlagBody}>
                    Bij dit type symptoom op dit niveau raden we sterk aan om
                    dezelfde dag nog contact op te nemen met een arts of (bij
                    ademnood/zwelling) het noodnummer te bellen.
                  </Text>
                </View>
              </View>
            )}

            {/* Symptoom-type */}
            <Text style={styles.fieldLabel}>Welk symptoom? *</Text>
            <View style={styles.chipGrid}>
              {SYMPTOM_TYPES.map(item => {
                const active = symptomType === item.key;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => setSymptomType(item.key)}
                    style={({ pressed }) => [
                      styles.typeChip,
                      active && styles.typeChipActive,
                      pressed && styles.btnPressed,
                    ]}
                    accessibilityLabel={item.label}
                  >
                    <Text style={styles.typeChipIcon}>{item.icon}</Text>
                    <Text
                      style={[
                        styles.typeChipLabel,
                        active && styles.typeChipLabelActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Severity */}
            <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>
              Hoe heftig? *
            </Text>
            <View style={styles.severityCol}>
              {(['mild', 'matig', 'heftig'] as const).map(level => {
                const info = SYMPTOM_SEVERITIES[level];
                const active = severity === level;
                return (
                  <Pressable
                    key={level}
                    onPress={() => setSeverity(level)}
                    style={({ pressed }) => [
                      styles.severityCard,
                      active && styles.severityCardActive,
                      pressed && styles.btnPressed,
                    ]}
                  >
                    <View style={styles.severityRow}>
                      <View
                        style={[
                          styles.radio,
                          active && styles.radioActive,
                        ]}
                      >
                        {active && <View style={styles.radioDot} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.severityLabel,
                            active && styles.severityLabelActive,
                          ]}
                        >
                          {info.label}
                        </Text>
                        <Text style={styles.severityDescription}>
                          {info.description}
                        </Text>
                      </View>
                    </View>
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

            {/* Gelinkt allergeen */}
            <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>
              Gelinkt aan een allergeen?
            </Text>
            <View style={styles.allergenGrid}>
              <Pressable
                onPress={() => setLinkedAllergen(null)}
                style={({ pressed }) => [
                  styles.allergenChip,
                  linkedAllergen === null && styles.allergenChipActive,
                  pressed && styles.btnPressed,
                ]}
              >
                <Text
                  style={[
                    styles.allergenChipLabel,
                    linkedAllergen === null && styles.allergenChipLabelActive,
                  ]}
                >
                  Geen
                </Text>
              </Pressable>
              {ALLERGEN_FLOW.map(item => {
                const active = linkedAllergen === item.key;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => setLinkedAllergen(item.key)}
                    style={({ pressed }) => [
                      styles.allergenChip,
                      active && styles.allergenChipActive,
                      pressed && styles.btnPressed,
                    ]}
                  >
                    <Text style={styles.allergenChipIcon}>{item.icon}</Text>
                    <Text
                      style={[
                        styles.allergenChipLabel,
                        active && styles.allergenChipLabelActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Notities */}
            <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>
              Notities
            </Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Bv. begon ongeveer 30 min na het eten, hield 2 uur aan."
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
                    {isEdit ? 'Opslaan' : 'Symptoom loggen'}
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
  redFlagBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: '#f7e3df',
    borderWidth: 1,
    borderColor: colors.danger,
    marginBottom: spacing.lg,
  },
  redFlagTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.danger,
    marginBottom: 2,
  },
  redFlagBody: {
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
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  typeChip: {
    width: '31%',
    flexGrow: 1,
    minWidth: 90,
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.light,
    backgroundColor: colors.white,
    alignItems: 'center',
  },
  typeChipActive: {
    borderColor: colors.primary,
    backgroundColor: '#fbf0e6',
  },
  typeChipIcon: {
    fontSize: 22,
    marginBottom: 2,
  },
  typeChipLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.dark,
    textAlign: 'center',
  },
  typeChipLabelActive: {
    color: colors.primary,
  },
  severityCol: {
    gap: spacing.sm,
  },
  severityCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.light,
    padding: spacing.md,
    ...shadows.sm,
  },
  severityCardActive: {
    borderColor: colors.primary,
    backgroundColor: '#fbf0e6',
  },
  severityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.grayLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    borderColor: colors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  severityLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.dark,
  },
  severityLabelActive: {
    color: colors.primary,
  },
  severityDescription: {
    fontSize: 12,
    color: colors.gray,
    marginTop: 2,
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
  allergenGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  allergenChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.light,
    backgroundColor: colors.white,
  },
  allergenChipActive: {
    borderColor: colors.primary,
    backgroundColor: '#fbf0e6',
  },
  allergenChipIcon: {
    fontSize: 14,
  },
  allergenChipLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.dark,
  },
  allergenChipLabelActive: {
    color: colors.primary,
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
