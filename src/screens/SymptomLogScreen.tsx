/**
 * SYMPTOM LOG SCREEN — v2.6.0
 *
 * Lijst van gelogde symptomen voor een specifiek kind. Toont per item
 * het symptoom-icon + label, severity, occurred_at-tijdstip, optioneel
 * gelinkt allergeen en een red-flag indicator als de server `red_flag`
 * heeft gevlagd.
 *
 * Acties:
 *   - + Knop bovenaan → SymptomFormScreen (nieuwe entry)
 *   - Tap op kaart → SymptomFormScreen (edit)
 *   - Lange-druk / verwijder-icoon → delete via Alert-confirm
 *
 * Reload-on-focus zodat na bewerken/aanmaken de lijst direct vers is.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { colors, radius, spacing, shadows } from '../constants/theme';
import { useToast } from '../components/Toast';
import {
  getChildren,
  getEhSymptoms,
  deleteEhSymptom,
  SYMPTOM_SEVERITIES,
  symptomTypeInfo,
  ALLERGEN_FLOW,
} from '../services';
import type { Child, EhSymptom } from '../services';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'SymptomLog'>;

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

/** Formatteer een ISO-timestamp naar "27 mei · 14:32". */
function formatOccurredAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const months = [
    'jan',
    'feb',
    'mrt',
    'apr',
    'mei',
    'jun',
    'jul',
    'aug',
    'sep',
    'okt',
    'nov',
    'dec',
  ];
  const day = d.getDate();
  const month = months[d.getMonth()];
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month} · ${hh}:${mm}`;
}

function allergenLabel(key: string): string {
  const opt = ALLERGEN_FLOW.find(a => a.key === key);
  return opt ? `${opt.icon} ${opt.label}` : key;
}

export function SymptomLogScreen({ navigation, route }: Props) {
  const { show } = useToast();
  const { childId } = route.params;

  const [child, setChild] = useState<Child | null>(null);
  const [symptoms, setSymptoms] = useState<EhSymptom[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      (async () => {
        try {
          const list = await getChildren();
          if (cancelled) return;
          const target = list.find(c => c.id === childId) ?? null;
          if (!target) {
            show('Kind niet gevonden.', 'error');
            navigation.goBack();
            return;
          }
          setChild(target);
          const items = await getEhSymptoms(childId, { limit: 100 });
          if (!cancelled) setSymptoms(items);
        } catch (err: any) {
          if (!cancelled) {
            show(err.message || 'Kon symptomen niet laden.', 'error');
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [childId, navigation, show])
  );

  const handleDelete = useCallback(
    (item: EhSymptom) => {
      const info = symptomTypeInfo(item.symptom_type);
      const label = info?.label ?? item.symptom_type;
      Alert.alert(
        'Symptoom verwijderen?',
        `Wil je dit "${label}"-symptoom uit het log verwijderen? Dit kan niet ongedaan gemaakt worden.`,
        [
          { text: 'Annuleren', style: 'cancel' },
          {
            text: 'Verwijderen',
            style: 'destructive',
            onPress: async () => {
              setDeletingId(item.id);
              try {
                await deleteEhSymptom(item.id);
                setSymptoms(prev => prev.filter(s => s.id !== item.id));
                show('Symptoom verwijderd.', 'success');
              } catch (err: any) {
                show(err.message || 'Verwijderen mislukt.', 'error');
              } finally {
                setDeletingId(null);
              }
            },
          },
        ]
      );
    },
    [show]
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <ChevronBack onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Symptoomlog</Text>
        <Pressable
          onPress={() => navigation.navigate('SymptomForm', { childId })}
          hitSlop={12}
          style={({ pressed }) => [pressed && styles.btnPressed]}
          accessibilityLabel="Symptoom toevoegen"
        >
          <Feather name="plus" size={22} color={colors.primary} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingBlock}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {child && (
            <>
              <Text style={styles.childName}>{child.name}</Text>
              <Text style={styles.intro}>
                Houd opvallende reacties of klachten bij, zodat je later kan
                terugzoeken of een patroon zichtbaar wordt. Bij een rode vlag
                raden we aan contact op te nemen met een arts.
              </Text>
            </>
          )}

          {symptoms.length === 0 ? (
            <View style={styles.emptyBlock}>
              <Feather name="activity" size={28} color={colors.grayLight} />
              <Text style={styles.emptyText}>
                Nog geen symptomen gelogd voor {child?.name ?? 'dit kind'}.
              </Text>
              <Pressable
                onPress={() =>
                  navigation.navigate('SymptomForm', { childId })
                }
                style={({ pressed }) => [
                  styles.addBtnInline,
                  pressed && styles.btnPressed,
                ]}
              >
                <Feather name="plus" size={16} color={colors.white} />
                <Text style={styles.addBtnInlineText}>
                  Eerste symptoom loggen
                </Text>
              </Pressable>
            </View>
          ) : (
            symptoms.map(item => {
              const info = symptomTypeInfo(item.symptom_type);
              const sev = SYMPTOM_SEVERITIES[item.severity];
              return (
                <Pressable
                  key={item.id}
                  onPress={() =>
                    navigation.navigate('SymptomForm', {
                      childId,
                      symptomId: item.id,
                    })
                  }
                  style={({ pressed }) => [
                    styles.card,
                    item.red_flag && styles.cardRedFlag,
                    pressed && styles.btnPressed,
                  ]}
                  accessibilityLabel={`${info?.label ?? item.symptom_type} bewerken`}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardIcon}>{info?.icon ?? '❓'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardLabel}>
                        {info?.label ?? item.symptom_type}
                      </Text>
                      <Text style={styles.cardMeta}>
                        {sev.label} · {formatOccurredAt(item.occurred_at)}
                      </Text>
                    </View>
                    {item.red_flag && (
                      <View style={styles.redFlagBadge}>
                        <Feather
                          name="alert-triangle"
                          size={12}
                          color={colors.danger}
                        />
                        <Text style={styles.redFlagText}>Rode vlag</Text>
                      </View>
                    )}
                    <Pressable
                      onPress={() => handleDelete(item)}
                      disabled={deletingId === item.id}
                      hitSlop={10}
                      style={({ pressed }) => [
                        styles.deleteBtn,
                        pressed && styles.btnPressed,
                        deletingId === item.id && styles.btnDisabled,
                      ]}
                      accessibilityLabel="Symptoom verwijderen"
                    >
                      {deletingId === item.id ? (
                        <ActivityIndicator size="small" color={colors.danger} />
                      ) : (
                        <Feather
                          name="trash-2"
                          size={16}
                          color={colors.danger}
                        />
                      )}
                    </Pressable>
                  </View>

                  {item.linked_allergen && (
                    <Text style={styles.cardDetail}>
                      Gelinkt aan: {allergenLabel(item.linked_allergen)}
                    </Text>
                  )}
                  {item.notes && (
                    <Text style={styles.cardNotes} numberOfLines={3}>
                      {item.notes}
                    </Text>
                  )}
                </Pressable>
              );
            })
          )}
        </ScrollView>
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
  childName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.dark,
  },
  intro: {
    fontSize: 13,
    color: colors.gray,
    lineHeight: 18,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  emptyBlock: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: 14,
    color: colors.gray,
    textAlign: 'center',
  },
  addBtnInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    marginTop: spacing.md,
  },
  addBtnInlineText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.light,
    ...shadows.sm,
  },
  cardRedFlag: {
    borderColor: colors.danger,
    backgroundColor: '#f7e3df',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardIcon: {
    fontSize: 26,
  },
  cardLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.dark,
  },
  cardMeta: {
    fontSize: 12,
    color: colors.gray,
    marginTop: 2,
  },
  redFlagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.white,
    borderRadius: radius.sm,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  redFlagText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.danger,
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  cardDetail: {
    fontSize: 12,
    color: colors.dark,
    marginTop: spacing.sm,
  },
  cardNotes: {
    fontSize: 13,
    color: colors.darkLight,
    marginTop: spacing.xs,
    lineHeight: 18,
  },
  btnPressed: {
    opacity: 0.65,
  },
  btnDisabled: {
    opacity: 0.45,
  },
});
