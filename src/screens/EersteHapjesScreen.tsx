/**
 * EERSTE HAPJES SCREEN
 *
 * Toont per kind een grid van de 9 hoofdallergenen met huidige status
 * en aantal geslaagde doses (0-3). Tik op een tegel → DoseFormScreen
 * om een nieuwe dose te registreren.
 *
 * MVP v2.5.0:
 *   - Read state + doses bij focus
 *   - 9 allergeen-tegels met status-badge (veilig / in-progress / wacht /
 *     allergisch / paused / locked-age)
 *   - Cooldown-banner als laatste dose < 2 dagen geleden
 *
 * Symptomen + pause-flow + setup-flow komen in volgende versies.
 *
 * Entry-point: vanaf ChildrenScreen-kaart, knop "Allergenen".
 * Route: 'EersteHapjes' { childId }.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
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
  formatAge,
  ageInMonths,
  getEhState,
  getEhDoses,
  buildAllergenContext,
  getAllergenStatus,
  successfulDoseCount,
  ALLERGEN_FLOW,
  ALLERGEN_COOLDOWN_DAYS,
  ALLERGEN_TARGET_DOSES,
} from '../services';
import type {
  Child,
  EhState,
  EhDose,
  AllergenStatus,
  AllergenContext,
} from '../services';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'EersteHapjes'>;

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

interface StatusVisual {
  label: string;
  color: string; // text + border color
  bg: string; // background color
  icon: keyof typeof Feather.glyphMap;
}

function statusVisual(status: AllergenStatus): StatusVisual {
  switch (status) {
    case 'veilig':
      return {
        label: 'Veilig',
        color: colors.secondaryDark,
        bg: '#eaf3ed',
        icon: 'check-circle',
      };
    case 'in-progress':
      return {
        label: 'Bezig',
        color: colors.primary,
        bg: '#fbf0e6',
        icon: 'clock',
      };
    case 'allergisch':
      return {
        label: 'Allergisch',
        color: colors.danger,
        bg: '#f7e3df',
        icon: 'alert-triangle',
      };
    case 'paused':
      return {
        label: 'Gepauzeerd',
        color: colors.warning,
        bg: '#fcf3cf',
        icon: 'pause-circle',
      };
    case 'locked-age':
      return {
        label: 'Nog te jong',
        color: colors.gray,
        bg: colors.light,
        icon: 'lock',
      };
    case 'wacht':
    default:
      return {
        label: 'Nog te doen',
        color: colors.gray,
        bg: colors.bg,
        icon: 'circle',
      };
  }
}

export function EersteHapjesScreen({ navigation, route }: Props) {
  const { show } = useToast();
  const { childId } = route.params;

  const [child, setChild] = useState<Child | null>(null);
  const [state, setState] = useState<EhState | null>(null);
  const [doses, setDoses] = useState<EhDose[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(
    async (signal?: { cancelled: boolean }) => {
      try {
        const list = await getChildren();
        if (signal?.cancelled) return;
        const target = list.find(c => c.id === childId);
        if (!target) {
          show('Kind niet gevonden.', 'error');
          navigation.goBack();
          return;
        }
        setChild(target);

        const [s, d] = await Promise.all([
          getEhState(childId).catch(() => null),
          getEhDoses(childId).catch(() => [] as EhDose[]),
        ]);
        if (signal?.cancelled) return;
        setState(s);
        setDoses(d);
      } catch (err: any) {
        if (!signal?.cancelled) {
          show(err.message || 'Kon allergenen niet laden.', 'error');
        }
      } finally {
        if (!signal?.cancelled) setLoading(false);
      }
    },
    [childId, navigation, show]
  );

  useFocusEffect(
    useCallback(() => {
      const signal = { cancelled: false };
      setLoading(true);
      void loadAll(signal);
      return () => {
        signal.cancelled = true;
      };
    }, [loadAll])
  );

  /* Afgeleide context (memo zodat hercomputatie alleen gebeurt bij data-changes). */
  const ctx: AllergenContext | null = useMemo(() => {
    if (!child) return null;
    return buildAllergenContext(doses, state, ageInMonths(child.birthdate));
  }, [child, state, doses]);

  const cooldownActive =
    ctx !== null && ctx.daysSinceLastDose < ALLERGEN_COOLDOWN_DAYS;
  const cooldownDaysLeft = ctx
    ? Math.max(0, ALLERGEN_COOLDOWN_DAYS - ctx.daysSinceLastDose)
    : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <ChevronBack onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Allergenen</Text>
        <View style={{ width: 28 }} />
      </View>

      {loading || !child || !ctx ? (
        <View style={styles.loadingBlock}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Kind-info */}
          <Text style={styles.childName}>{child.name}</Text>
          <Text style={styles.childAge}>{formatAge(child.birthdate)}</Text>

          {/* Pause-banner (read-only voor MVP — flow-management komt later) */}
          {ctx.paused && (
            <View style={[styles.banner, styles.bannerWarning]}>
              <Feather
                name="pause-circle"
                size={18}
                color={colors.warning}
              />
              <Text style={styles.bannerText}>
                De allergeen-flow staat gepauzeerd. Vervolg via de website om
                hem te hervatten.
              </Text>
            </View>
          )}

          {/* Cooldown-banner */}
          {!ctx.paused && cooldownActive && (
            <View style={[styles.banner, styles.bannerInfo]}>
              <Feather name="clock" size={18} color={colors.info} />
              <Text style={styles.bannerText}>
                {cooldownDaysLeft === 1
                  ? 'Nog 1 dag tot een volgende dose.'
                  : `Nog ${cooldownDaysLeft} dagen tot een volgende dose.`}{' '}
                Wacht minstens {ALLERGEN_COOLDOWN_DAYS} dagen tussen twee
                introducties, zodat je een eventuele reactie kan koppelen.
              </Text>
            </View>
          )}

          <Text style={styles.intro}>
            Tik op een allergeen om een nieuwe dose te noteren. Na{' '}
            {ALLERGEN_TARGET_DOSES} geslaagde doses (geen reactie) staat het
            allergeen op "Veilig".
          </Text>

          {/* Grid */}
          <View style={styles.grid}>
            {ALLERGEN_FLOW.map(item => {
              const status = getAllergenStatus(item.key, ctx);
              const visual = statusVisual(status);
              const successCount = successfulDoseCount(doses, item.key);
              const isLocked = status === 'locked-age';
              const onPress = isLocked
                ? undefined
                : () =>
                    navigation.navigate('DoseForm', {
                      childId: child.id,
                      allergenKey: item.key,
                    });

              return (
                <Pressable
                  key={item.key}
                  onPress={onPress}
                  disabled={isLocked}
                  style={({ pressed }) => [
                    styles.card,
                    { backgroundColor: visual.bg, borderColor: visual.color },
                    pressed && styles.btnPressed,
                    isLocked && styles.cardLocked,
                  ]}
                  accessibilityLabel={`${item.label} — status ${visual.label}`}
                >
                  <Text style={styles.cardIcon}>{item.icon}</Text>
                  <Text style={styles.cardLabel}>{item.label}</Text>
                  <View style={styles.cardStatusRow}>
                    <Feather
                      name={visual.icon}
                      size={12}
                      color={visual.color}
                    />
                    <Text
                      style={[styles.cardStatusText, { color: visual.color }]}
                    >
                      {visual.label}
                    </Text>
                  </View>
                  <Text style={styles.cardCount}>
                    {successCount}/{ALLERGEN_TARGET_DOSES} doses
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.footnote}>
            Setup-flow, pauze-beheer en symptoomlog blijven voorlopig op de
            website beschikbaar.
          </Text>
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
  childAge: {
    fontSize: 13,
    color: colors.gray,
    marginTop: 2,
    marginBottom: spacing.lg,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  bannerWarning: {
    backgroundColor: '#fcf3cf',
  },
  bannerInfo: {
    backgroundColor: '#e7f3fb',
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    color: colors.dark,
    lineHeight: 18,
  },
  intro: {
    fontSize: 13,
    color: colors.gray,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  card: {
    width: '31%',
    minWidth: 100,
    flexGrow: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    ...shadows.sm,
  },
  cardLocked: {
    opacity: 0.55,
  },
  cardIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.dark,
    textAlign: 'center',
  },
  cardStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  cardStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardCount: {
    fontSize: 11,
    color: colors.gray,
    marginTop: 2,
  },
  footnote: {
    fontSize: 11,
    color: colors.gray,
    marginTop: spacing.xl,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  btnPressed: {
    opacity: 0.65,
  },
});
