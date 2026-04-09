/**
 * WEEK SCHEDULE SCREEN
 * Genereert een persoonlijk weekschema (5 maaltijden x 7 dagen)
 * met allergenen-filter. Het actieve schema wordt per gebruiker
 * lokaal bewaard, en kan opgeslagen worden in favorieten.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Image,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radius, spacing, shadows } from '../constants/theme';
import { useToast } from '../components/Toast';
import { useUser } from '../context/UserContext';
import { getRecipes, saveSchedule } from '../lib/store';
import {
  ALLERGENS,
  WEEKDAYS,
  SCHEDULE_SLOTS,
  slotToMealMoment,
} from '../constants/data';
import type { Recipe, ActiveSchedule } from '../types';

const ACTIVE_KEY_PREFIX = 'receptenboek_active_schedule_';

export function WeekScheduleScreen({ navigation }: any) {
  const { user } = useUser();
  const { show } = useToast();

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState<ActiveSchedule | null>(null);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [scheduleName, setScheduleName] = useState('');

  const recipeMap = useMemo(
    () => new Map(recipes.map(r => [r.id, r])),
    [recipes]
  );

  const usedAllergens = useMemo(() => {
    const set = new Set<string>();
    recipes.forEach(r => (r.allergens || []).forEach(a => set.add(a)));
    return set;
  }, [recipes]);

  const activeKey = `${ACTIVE_KEY_PREFIX}${user || 'anoniem'}`;

  const load = useCallback(async () => {
    try {
      const [r, savedRaw] = await Promise.all([
        getRecipes(),
        AsyncStorage.getItem(activeKey),
      ]);
      setRecipes(r);
      if (savedRaw) {
        try {
          const parsed = JSON.parse(savedRaw);
          if (parsed && parsed.days) {
            setSchedule(parsed);
            setExcluded(parsed.excludedAllergens || []);
          }
        } catch {
          /* ignore */
        }
      }
    } catch (err: any) {
      show('Fout bij laden: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [activeKey, show]);

  useEffect(() => {
    load();
  }, [load]);

  const persistSchedule = useCallback(
    async (s: ActiveSchedule | null) => {
      if (s) {
        await AsyncStorage.setItem(activeKey, JSON.stringify(s));
      } else {
        await AsyncStorage.removeItem(activeKey);
      }
    },
    [activeKey]
  );

  const generate = () => {
    const available = recipes.filter(
      r => !(r.allergens || []).some(a => excluded.includes(a))
    );

    if (available.length === 0) {
      show('Geen recepten beschikbaar met deze filters!', 'error');
      return;
    }

    const days: ActiveSchedule['days'] = {};
    WEEKDAYS.forEach(day => {
      days[day] = {};
      SCHEDULE_SLOTS.forEach(slot => {
        const mealMoment = slotToMealMoment(slot.id);
        const suitable = available.filter(r =>
          (r.mealMoments || []).includes(mealMoment)
        );
        if (suitable.length > 0) {
          const random = suitable[Math.floor(Math.random() * suitable.length)];
          days[day][slot.id] = random.id;
        } else {
          days[day][slot.id] = null;
        }
      });
    });

    const newSchedule: ActiveSchedule = {
      days,
      excludedAllergens: excluded,
      generatedAt: new Date().toISOString(),
    };
    setSchedule(newSchedule);
    persistSchedule(newSchedule);
    show('Weekschema gegenereerd!');
  };

  const refreshSlot = (day: string, slotId: string) => {
    if (!schedule) return;

    const available = recipes.filter(
      r => !(r.allergens || []).some(a => excluded.includes(a))
    );
    const mealMoment = slotToMealMoment(slotId as any);
    const suitable = available.filter(r =>
      (r.mealMoments || []).includes(mealMoment)
    );

    const currentId = schedule.days[day]?.[slotId];
    const alternatives = suitable.filter(r => r.id !== currentId);
    const pool = alternatives.length > 0 ? alternatives : suitable;

    const newSchedule = {
      ...schedule,
      days: {
        ...schedule.days,
        [day]: {
          ...schedule.days[day],
          [slotId]:
            pool.length > 0
              ? pool[Math.floor(Math.random() * pool.length)].id
              : null,
        },
      },
    };
    setSchedule(newSchedule);
    persistSchedule(newSchedule);
  };

  const handleSave = async () => {
    if (!schedule) return;
    const name =
      scheduleName.trim() ||
      `Weekschema ${new Date().toLocaleDateString('nl-BE')}`;
    try {
      await saveSchedule(user, {
        name,
        days: schedule.days,
        excludedAllergens: schedule.excludedAllergens,
      });
      show('Weekschema opgeslagen in favorieten!');
      setSaveModalVisible(false);
      setScheduleName('');
      navigation.getParent()?.navigate('Favorieten');
    } catch (err: any) {
      show('Fout: ' + err.message, 'error');
    }
  };

  const toggleAllergen = (a: string) => {
    setExcluded(prev =>
      prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (recipes.length === 0) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.emptyIcon}>📅</Text>
        <Text style={styles.emptyTitle}>Geen recepten beschikbaar</Text>
        <Text style={styles.emptyText}>
          Voeg eerst recepten toe via de website om een weekschema te
          kunnen genereren.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Weekschema Generator</Text>

        <View style={styles.controls}>
          <Text style={styles.subTitle}>Allergenen uitsluiten</Text>
          <Text style={styles.helperText}>
            Vink allergenen aan die je wilt uitsluiten. Recepten met deze
            allergenen worden niet gebruikt.
          </Text>
          <View style={styles.allergenRow}>
            {ALLERGENS.filter(a => usedAllergens.has(a)).map(a => {
              const active = excluded.includes(a);
              return (
                <Pressable
                  key={a}
                  onPress={() => toggleAllergen(a)}
                  style={[styles.allergenChip, active && styles.allergenChipActive]}
                >
                  <Text
                    style={[
                      styles.allergenChipText,
                      active && styles.allergenChipTextActive,
                    ]}
                  >
                    {active ? '✓ ' : ''}
                    {a}
                  </Text>
                </Pressable>
              );
            })}
            {usedAllergens.size === 0 && (
              <Text style={styles.helperText}>
                Geen allergenen gevonden in de recepten.
              </Text>
            )}
          </View>

          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.btn, styles.btnPrimary, styles.btnLg]}
              onPress={generate}
            >
              <Text style={styles.btnPrimaryText}>🎲 Genereer Weekschema</Text>
            </Pressable>
            {schedule && (
              <Pressable
                style={[styles.btn, styles.btnSecondary]}
                onPress={() => setSaveModalVisible(true)}
              >
                <Text style={styles.btnPrimaryText}>💾 Opslaan</Text>
              </Pressable>
            )}
          </View>
        </View>

        {schedule ? (
          <View>
            {WEEKDAYS.map(day => {
              const dayData = schedule.days[day] || {};
              const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
              return (
                <View key={day} style={styles.dayBlock}>
                  <Text style={styles.dayTitle}>{dayLabel}</Text>
                  {SCHEDULE_SLOTS.map(slot => {
                    const recipeId = dayData[slot.id];
                    const recipe = recipeId ? recipeMap.get(recipeId) : null;
                    return (
                      <View key={slot.id} style={styles.slotRow}>
                        <Text style={styles.slotLabel}>{slot.label}</Text>
                        <Pressable
                          style={styles.slotContent}
                          onPress={() =>
                            recipe &&
                            navigation.navigate('RecipeDetail', { id: recipe.id })
                          }
                        >
                          {recipe ? (
                            <View style={styles.recipeChip}>
                              {recipe.image ? (
                                <Image
                                  source={{ uri: recipe.image }}
                                  style={styles.recipeChipImg}
                                />
                              ) : (
                                <View
                                  style={[
                                    styles.recipeChipImg,
                                    styles.recipeChipPlaceholder,
                                  ]}
                                >
                                  <Text style={{ fontSize: 18 }}>🍽️</Text>
                                </View>
                              )}
                              <Text
                                style={styles.recipeChipName}
                                numberOfLines={2}
                              >
                                {recipe.name}
                              </Text>
                            </View>
                          ) : (
                            <Text style={styles.slotEmpty}>Geen recept</Text>
                          )}
                        </Pressable>
                        <Pressable
                          style={styles.refreshBtn}
                          onPress={() => refreshSlot(day, slot.id)}
                          hitSlop={6}
                        >
                          <Text style={styles.refreshBtnText}>↻</Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📅</Text>
            <Text style={styles.emptyTitle}>Klik op "Genereer"</Text>
            <Text style={styles.emptyText}>
              Er wordt automatisch een weekmenu samengesteld op basis van je
              recepten.
            </Text>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={saveModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSaveModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Weekschema opslaan</Text>
            <Text style={styles.modalSub}>Geef dit schema een naam:</Text>
            <TextInput
              value={scheduleName}
              onChangeText={setScheduleName}
              placeholder={`Weekschema ${new Date().toLocaleDateString('nl-BE')}`}
              placeholderTextColor={colors.gray}
              style={styles.modalInput}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.btn, styles.btnOutline]}
                onPress={() => setSaveModalVisible(false)}
              >
                <Text style={styles.btnOutlineText}>Annuleren</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.btnPrimary]}
                onPress={handleSave}
              >
                <Text style={styles.btnPrimaryText}>Opslaan</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  scroll: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.dark,
    marginBottom: spacing.md,
  },
  controls: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  subTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.dark,
    marginBottom: spacing.sm,
  },
  helperText: {
    fontSize: 13,
    color: colors.gray,
    marginBottom: spacing.md,
  },
  allergenRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.md,
  },
  allergenChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.light,
    borderRadius: radius.sm,
  },
  allergenChipActive: {
    backgroundColor: colors.primary,
  },
  allergenChipText: {
    fontSize: 13,
    color: colors.dark,
  },
  allergenChipTextActive: {
    color: colors.white,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  btnLg: {
    paddingVertical: 14,
    paddingHorizontal: 22,
  },
  btnPrimary: { backgroundColor: colors.primary },
  btnSecondary: { backgroundColor: colors.secondary },
  btnPrimaryText: { color: colors.white, fontWeight: '600' },
  btnOutline: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  btnOutlineText: {
    color: colors.primary,
    fontWeight: '600',
  },
  dayBlock: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  dayTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primaryDark,
    marginBottom: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: colors.light,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  slotLabel: {
    width: 90,
    fontSize: 11,
    fontWeight: '700',
    color: colors.gray,
    textTransform: 'uppercase',
  },
  slotContent: {
    flex: 1,
  },
  slotEmpty: {
    fontSize: 13,
    color: colors.grayLight,
    fontStyle: 'italic',
  },
  recipeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recipeChipImg: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: colors.light,
  },
  recipeChipPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipeChipName: {
    flex: 1,
    fontSize: 13,
    color: colors.dark,
    fontWeight: '500',
  },
  refreshBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.light,
    borderRadius: 16,
  },
  refreshBtnText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '700',
  },
  empty: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: spacing.md,
    opacity: 0.4,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.darkLight,
    marginBottom: spacing.sm,
  },
  emptyText: {
    color: colors.gray,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modal: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 420,
    ...shadows.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  modalSub: {
    color: colors.gray,
    marginBottom: spacing.md,
  },
  modalInput: {
    borderWidth: 2,
    borderColor: colors.light,
    borderRadius: radius.sm,
    padding: spacing.md,
    fontSize: 14,
    marginBottom: spacing.lg,
    color: colors.dark,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'flex-end',
  },
});
