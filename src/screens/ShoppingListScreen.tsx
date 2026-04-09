/**
 * SHOPPING LIST SCREEN
 *
 * Visuele boodschappenlijst voor een opgeslagen weekschema.
 *
 * Werking:
 *  1. Eerst kiest de gebruiker welke dagen / eetmomenten meegenomen
 *     worden (alle aangevinkt by default).
 *  2. Klik op "Genereer" → ingrediënten worden samengevoegd uit alle
 *     geselecteerde recepten en getoond als vierkante tegels met
 *     emoji-icoon en hoeveelheid.
 *  3. Tik op een tegel → ingrediënt verhuist naar de "In winkelmandje"
 *     lijst onderaan en wordt rood/doorstreept.
 *  4. Tik op een tegel in het mandje → terug naar de "Nog te kopen"
 *     lijst (voor het geval je per ongeluk klikte).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing, shadows } from '../constants/theme';
import { useToast } from '../components/Toast';
import { getSchedule, getRecipesByIds } from '../lib/store';
import {
  WEEKDAYS,
  SCHEDULE_SLOTS,
  type Weekday,
  type ScheduleSlotId,
} from '../constants/data';
import { getIngredientIcon } from '../constants/ingredientIcons';
import type { Schedule, Recipe } from '../types';

interface AggregatedIngredient {
  key: string;
  name: string;
  icon: string;
  totalAmount: number;
  unit: string;
  isNumeric: boolean;
}

export function ShoppingListScreen({ route, navigation }: any) {
  const { id } = route.params;
  const { show } = useToast();

  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [recipeMap, setRecipeMap] = useState<Map<string, Recipe>>(new Map());
  const [loading, setLoading] = useState(true);

  /* Selectie staat: welke (day, slot)-combinaties zijn aangevinkt? */
  const [selected, setSelected] = useState<Set<string>>(new Set());

  /* Gegenereerde ingrediëntenlijst (alleen ingevuld na "Genereer") */
  const [ingredients, setIngredients] = useState<AggregatedIngredient[] | null>(
    null
  );

  /* Welke ingrediënten zitten al in het mandje? Bewaar de keys. */
  const [inBasket, setInBasket] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const sch = await getSchedule(id);
      if (!sch) {
        show('Weekschema niet gevonden', 'error');
        navigation.goBack();
        return;
      }
      setSchedule(sch);

      /* Verzamel recipe-ids uit het schema */
      const ids = new Set<string>();
      WEEKDAYS.forEach(day => {
        SCHEDULE_SLOTS.forEach(slot => {
          const rid = sch.days?.[day]?.[slot.id];
          if (rid) ids.add(rid);
        });
      });

      const recipes = await getRecipesByIds([...ids]);
      const map = new Map<string, Recipe>();
      recipes.forEach(r => map.set(r.id, r));
      setRecipeMap(map);

      /* Selecteer standaard alle slots die een geldig recept hebben */
      const initial = new Set<string>();
      WEEKDAYS.forEach(day => {
        SCHEDULE_SLOTS.forEach(slot => {
          const rid = sch.days?.[day]?.[slot.id];
          if (rid && map.has(rid)) {
            initial.add(`${day}|${slot.id}`);
          }
        });
      });
      setSelected(initial);
    } catch (err: any) {
      show('Fout: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [id, navigation, show]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleSlot = (day: string, slotId: string) => {
    const key = `${day}|${slotId}`;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleDay = (day: string, on: boolean) => {
    setSelected(prev => {
      const next = new Set(prev);
      SCHEDULE_SLOTS.forEach(slot => {
        const rid = schedule?.days?.[day]?.[slot.id];
        if (rid && recipeMap.has(rid)) {
          const key = `${day}|${slot.id}`;
          if (on) next.add(key);
          else next.delete(key);
        }
      });
      return next;
    });
  };

  const dayState = (day: string): 'all' | 'none' | 'partial' => {
    const slotsWithRecipe = SCHEDULE_SLOTS.filter(slot => {
      const rid = schedule?.days?.[day]?.[slot.id];
      return rid && recipeMap.has(rid);
    });
    if (slotsWithRecipe.length === 0) return 'none';
    const checked = slotsWithRecipe.filter(slot =>
      selected.has(`${day}|${slot.id}`)
    ).length;
    if (checked === 0) return 'none';
    if (checked === slotsWithRecipe.length) return 'all';
    return 'partial';
  };

  const generate = () => {
    if (!schedule) return;
    if (selected.size === 0) {
      show('Selecteer minstens één maaltijd', 'error');
      return;
    }

    /* Tel hoe vaak elk recept voorkomt in de selectie */
    const recipeCounts: Record<string, number> = {};
    selected.forEach(key => {
      const [day, slotId] = key.split('|');
      const rid = schedule.days?.[day]?.[slotId];
      if (rid) {
        recipeCounts[rid] = (recipeCounts[rid] || 0) + 1;
      }
    });

    /* Aggregeer ingrediënten */
    const map = new Map<string, AggregatedIngredient>();
    for (const [recipeId, count] of Object.entries(recipeCounts)) {
      const recipe = recipeMap.get(recipeId);
      if (!recipe) continue;
      (recipe.ingredients || []).forEach(ing => {
        const k = (ing.name || '').toLowerCase().trim();
        if (!k) return;
        if (!map.has(k)) {
          map.set(k, {
            key: k,
            name: ing.name,
            icon: getIngredientIcon(ing.name),
            totalAmount: 0,
            unit: ing.unit || '',
            isNumeric: false,
          });
        }
        const entry = map.get(k)!;
        const amount = parseFloat(ing.amount as any);
        if (!isNaN(amount)) {
          entry.totalAmount += amount * count;
          entry.isNumeric = true;
        }
      });
    }

    const sorted = Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    setIngredients(sorted);
    setInBasket(new Set());
    show(`${sorted.length} ingrediënten op je lijst!`);
  };

  const moveToBasket = (key: string) => {
    setInBasket(prev => new Set(prev).add(key));
  };

  const moveBackToList = (key: string) => {
    setInBasket(prev => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const formatAmount = (n: number) => {
    if (Number.isInteger(n)) return n.toString();
    return n.toFixed(1).replace('.', ',');
  };

  const remainingItems = useMemo(
    () => (ingredients || []).filter(i => !inBasket.has(i.key)),
    [ingredients, inBasket]
  );
  const basketItems = useMemo(
    () => (ingredients || []).filter(i => inBasket.has(i.key)),
    [ingredients, inBasket]
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!schedule) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Terug</Text>
        </Pressable>

        <Text style={styles.title}>🛒 Boodschappenlijst</Text>
        <Text style={styles.subtitle}>{schedule.name}</Text>

        {/* Selectie van dagen / maaltijden */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Selecteer dagen & maaltijden</Text>
          <Text style={styles.helper}>
            Vink hele dagen aan of kies per dag specifieke maaltijden.
          </Text>

          {WEEKDAYS.map(day => {
            const state = dayState(day);
            const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
            return (
              <View key={day} style={styles.dayBlock}>
                <Pressable
                  style={styles.dayHeader}
                  onPress={() => toggleDay(day, state !== 'all')}
                  disabled={state === 'none' && !hasAnyRecipe(schedule, day, recipeMap)}
                >
                  <View
                    style={[
                      styles.checkbox,
                      state === 'all' && styles.checkboxChecked,
                      state === 'partial' && styles.checkboxPartial,
                    ]}
                  >
                    {state === 'all' && <Text style={styles.checkboxMark}>✓</Text>}
                    {state === 'partial' && (
                      <Text style={styles.checkboxMark}>–</Text>
                    )}
                  </View>
                  <Text style={styles.dayLabel}>{dayLabel}</Text>
                </Pressable>

                {SCHEDULE_SLOTS.map(slot => {
                  const rid = schedule.days?.[day]?.[slot.id];
                  const recipe = rid ? recipeMap.get(rid) : null;
                  if (!recipe) return null;
                  const key = `${day}|${slot.id}`;
                  const checked = selected.has(key);
                  return (
                    <Pressable
                      key={slot.id}
                      style={styles.slotRow}
                      onPress={() => toggleSlot(day, slot.id)}
                    >
                      <View
                        style={[
                          styles.checkboxSm,
                          checked && styles.checkboxChecked,
                        ]}
                      >
                        {checked && <Text style={styles.checkboxMark}>✓</Text>}
                      </View>
                      <Text style={styles.slotMoment}>{slot.label}</Text>
                      <Text
                        style={styles.slotRecipeName}
                        numberOfLines={1}
                      >
                        {recipe.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            );
          })}

          <Pressable
            style={[styles.btn, styles.btnPrimary, styles.btnLg]}
            onPress={generate}
          >
            <Text style={styles.btnPrimaryText}>📋 Genereer Boodschappenlijst</Text>
          </Pressable>
        </View>

        {/* Resultaat: ingrediënten als tegels */}
        {ingredients && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Nog te kopen ({remainingItems.length})
              </Text>
              <Text style={styles.helper}>
                Tik op een ingrediënt om het in je winkelmandje te leggen.
              </Text>

              {remainingItems.length === 0 ? (
                <View style={styles.allDoneBox}>
                  <Text style={styles.allDoneIcon}>🎉</Text>
                  <Text style={styles.allDoneText}>Alles in het mandje!</Text>
                </View>
              ) : (
                <View style={styles.tileGrid}>
                  {remainingItems.map(item => (
                    <IngredientTile
                      key={item.key}
                      item={item}
                      inBasket={false}
                      formatAmount={formatAmount}
                      onPress={() => moveToBasket(item.key)}
                    />
                  ))}
                </View>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                In winkelmandje ({basketItems.length})
              </Text>
              {basketItems.length === 0 ? (
                <Text style={styles.helper}>
                  Nog niets in het mandje. Tik hierboven op een ingrediënt
                  om hem hier te plaatsen.
                </Text>
              ) : (
                <>
                  <Text style={styles.helper}>
                    Per ongeluk getikt? Tik nog een keer om hem terug te zetten.
                  </Text>
                  <View style={styles.tileGrid}>
                    {basketItems.map(item => (
                      <IngredientTile
                        key={item.key}
                        item={item}
                        inBasket
                        formatAmount={formatAmount}
                        onPress={() => moveBackToList(item.key)}
                      />
                    ))}
                  </View>
                </>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function hasAnyRecipe(
  schedule: Schedule,
  day: string,
  recipeMap: Map<string, Recipe>
): boolean {
  return SCHEDULE_SLOTS.some(slot => {
    const rid = schedule.days?.[day]?.[slot.id];
    return rid && recipeMap.has(rid);
  });
}

function IngredientTile({
  item,
  inBasket,
  formatAmount,
  onPress,
}: {
  item: AggregatedIngredient;
  inBasket: boolean;
  formatAmount: (n: number) => string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.tile, inBasket && styles.tileBasket]}
      onPress={onPress}
    >
      <Text style={[styles.tileIcon, inBasket && styles.tileIconBasket]}>
        {item.icon}
      </Text>
      <Text
        style={[styles.tileName, inBasket && styles.tileNameBasket]}
        numberOfLines={2}
      >
        {item.name}
      </Text>
      <Text style={[styles.tileAmount, inBasket && styles.tileAmountBasket]}>
        {item.isNumeric
          ? `${formatAmount(item.totalAmount)} ${item.unit}`.trim()
          : item.unit || '—'}
      </Text>
    </Pressable>
  );
}

const TILE_SIZE = '31%';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  backBtn: {
    paddingVertical: 8,
    marginBottom: spacing.sm,
  },
  backText: {
    color: colors.primary,
    fontWeight: '600',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.dark,
    marginBottom: 4,
  },
  subtitle: {
    color: colors.gray,
    marginBottom: spacing.lg,
  },
  section: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.primaryDark,
    marginBottom: spacing.sm,
  },
  helper: {
    fontSize: 13,
    color: colors.gray,
    marginBottom: spacing.md,
  },
  dayBlock: {
    borderWidth: 1,
    borderColor: colors.light,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    gap: 10,
  },
  dayLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.dark,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: spacing.lg,
    gap: 10,
  },
  slotMoment: {
    width: 80,
    fontSize: 11,
    fontWeight: '700',
    color: colors.gray,
    textTransform: 'uppercase',
  },
  slotRecipeName: {
    flex: 1,
    fontSize: 13,
    color: colors.dark,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSm: {
    width: 18,
    height: 18,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
  },
  checkboxPartial: {
    backgroundColor: colors.primaryLight,
  },
  checkboxMark: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  btnLg: {
    paddingVertical: 14,
  },
  btnPrimary: { backgroundColor: colors.primary },
  btnPrimaryText: { color: colors.white, fontWeight: '600', fontSize: 15 },
  /* Tegel grid */
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tile: {
    width: TILE_SIZE,
    aspectRatio: 1,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.light,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileBasket: {
    backgroundColor: 'rgba(192, 57, 43, 0.08)',
    borderColor: colors.danger,
  },
  tileIcon: {
    fontSize: 32,
    marginBottom: 4,
  },
  tileIconBasket: {
    opacity: 0.6,
  },
  tileName: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.dark,
    textAlign: 'center',
  },
  tileNameBasket: {
    color: colors.danger,
    textDecorationLine: 'line-through',
  },
  tileAmount: {
    fontSize: 10,
    color: colors.gray,
    marginTop: 2,
    textAlign: 'center',
  },
  tileAmountBasket: {
    color: colors.danger,
    textDecorationLine: 'line-through',
  },
  allDoneBox: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  allDoneIcon: {
    fontSize: 56,
    marginBottom: spacing.sm,
  },
  allDoneText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.secondaryDark,
  },
});
