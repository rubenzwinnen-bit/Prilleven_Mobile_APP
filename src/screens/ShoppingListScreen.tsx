/**
 * SHOPPING LIST SELECTION SCREEN
 *
 * Stap 1 van het boodschappenlijst-proces. De gebruiker komt
 * hier terecht via de knop "Genereer boodschappenlijst" onder
 * een opgeslagen weekschema in de Favorieten-tab.
 *
 *  1. Eerst kiest de gebruiker welke dagen / eetmomenten
 *     meegenomen worden (alle aangevinkt by default).
 *  2. Klik op "Genereer" → ingrediënten worden samengevoegd uit
 *     alle geselecteerde recepten en opgeslagen in de
 *     ShoppingListContext (en in AsyncStorage).
 *  3. De app navigeert automatisch naar de "Boodschappenlijst"
 *     tab onderaan, waar de visuele tegels staan.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CommonActions } from '@react-navigation/native';
import { colors, radius, spacing, shadows } from '../constants/theme';
import { useToast } from '../components/Toast';
import { CompactHeader } from '../navigation/RootStack';
import { getSchedule, getRecipesByIds, getIngredientIconMaps } from '../services';
import {
  WEEKDAYS,
  SCHEDULE_SLOTS,
} from '../constants/data';
import { getIngredientIcon, normalizeIngredientName } from '../constants/ingredientIcons';
import {
  useShoppingList,
  type AggregatedIngredient,
} from '../context/ShoppingListContext';
import type { Schedule, Recipe } from '../types';

export function ShoppingListScreen({ route, navigation }: any) {
  const { id, persons: routePersons } = route.params;
  const { show } = useToast();
  const { setList } = useShoppingList();

  const goToLanding = () => navigation.getParent()?.getParent()?.goBack();

  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [recipeMap, setRecipeMap] = useState<Map<string, Recipe>>(new Map());
  const [loading, setLoading] = useState(true);

  /* Selectie staat: welke (day, slot)-combinaties zijn aangevinkt? */
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const sch = await getSchedule(id);
      if (!sch) {
        show('Weekschema niet gevonden', 'error');
        navigation.goBack();
        return;
      }
      setSchedule(sch);

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

  const generate = async () => {
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

    /* Aggregeer ingrediënten met X-vermenigvuldiger voor personen */
    const persons = routePersons || schedule.persons || 4;
    const isActive = schedule.isActive || false;

    /* Haal custom iconen + admin display-names op uit Supabase */
    const { iconUrl: iconMap, displayName: displayNameMap } =
      await getIngredientIconMaps();

    const map = new Map<string, AggregatedIngredient>();
    for (const [recipeId, count] of Object.entries(recipeCounts)) {
      const recipe = recipeMap.get(recipeId);
      if (!recipe) continue;

      // X = ceil(persons / portions) wanneer actief, anders 1
      const X = isActive
        ? Math.max(1, Math.ceil(persons / (recipe.portions || 1)))
        : 1;

      (recipe.ingredients || []).forEach(ing => {
        const normalized = normalizeIngredientName(ing.name);
        if (!normalized) return;
        const unitRaw = (ing.unit || '').toLowerCase().trim();
        // Normaliseer eenheden zodat "g" en "gram", "ml" en "milliliter" etc. samengevoegd worden
        const unitMap: Record<string, string> = {
          'g': 'gram', 'gr': 'gram', 'kg': 'kg',
          'ml': 'ml', 'dl': 'dl', 'cl': 'cl', 'l': 'liter',
          'el': 'eetlepel', 'tl': 'theelepel',
          'stuk': 'stuk', 'stuks': 'stuk',
          'snuf': 'snufje', 'snufje': 'snufje',
          'plak': 'plak', 'plakken': 'plak',
          'teen': 'teen', 'tenen': 'teen',
        };
        const unitLower = unitMap[unitRaw] || unitRaw;
        const k = `${normalized}|${unitLower}`;
        if (!map.has(k)) {
          // Weergavenaam: admin-bewerkbaar via Supabase, anders fallback
          // op de genormaliseerde sleutel met hoofdletter.
          const adminName = displayNameMap.get(normalized);
          const displayName =
            adminName ||
            normalized.charAt(0).toUpperCase() + normalized.slice(1);
          map.set(k, {
            key: k,
            name: displayName,
            icon: getIngredientIcon(ing.name),
            iconUrl: iconMap.get(normalized) || undefined,
            totalAmount: 0,
            unit: ing.unit || '',
            isNumeric: false,
          });
        }
        const entry = map.get(k)!;
        const amount = parseFloat(ing.amount as any);
        if (!isNaN(amount)) {
          entry.totalAmount += amount * X * count;
          entry.isNumeric = true;
        }
      });
    }

    const sorted = Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    /* Persisteer naar context (en AsyncStorage) */
    await setList({
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      generatedAt: Date.now(),
      ingredients: sorted,
      basket: [],
      persons: isActive ? persons : undefined,
    });

    show(`${sorted.length} ingrediënten op je lijst!`);

    /* Navigeer naar de Boodschappenlijst-tab onderaan */
    navigation.dispatch(
      CommonActions.navigate({
        name: 'Boodschappenlijst',
      })
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!schedule) return null;

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <CompactHeader
        onBack={() => navigation.goBack()}
        onHome={goToLanding}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>🛒 Boodschappenlijst</Text>
        <Text style={styles.subtitle}>{schedule.name}</Text>

        <View style={styles.intro}>
          <Text style={styles.introText}>
            📋 Selecteer hieronder welke dagen en maaltijden je wil meenemen.
            Na het genereren verschijnt je volledige boodschappenlijst in de
            tab <Text style={styles.bold}>Boodschappenlijst</Text> onderaan
            het scherm — met visuele tegels die je in je winkelmandje kunt
            slepen.
          </Text>
        </View>

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
  intro: {
    backgroundColor: 'rgba(152, 195, 164, 0.18)',
    borderLeftWidth: 4,
    borderLeftColor: colors.secondaryDark,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  introText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.darkLight,
  },
  bold: {
    fontWeight: '700',
    color: colors.primaryDark,
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
    borderRadius: radius.md,
  },
  btnLg: {
    paddingVertical: 14,
  },
  btnPrimary: { backgroundColor: colors.primary },
  btnPrimaryText: { color: colors.white, fontWeight: '600', fontSize: 15 },
});
