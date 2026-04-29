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
import { CompactHeader } from '../navigation/RootStack';
import { Stars } from '../components/Stars';
import { getRecipes, saveSchedule, getActiveSchedule, getAllRatings } from '../services';
import {
  ALLERGENS,
  WEEKDAYS,
  SCHEDULE_SLOTS,
  slotToMealMoment,
  getSlotLabel,
} from '../constants/data';
import type { Recipe, ActiveSchedule, Schedule, RatingSummary } from '../types';

const ACTIVE_KEY_PREFIX = 'receptenboek_active_schedule_';
const SUBTAB_KEY_PREFIX = 'receptenboek_schedule_subtab_';
const PRESET_KEY_PREFIX = 'receptenboek_active_preset_';

type Subtab = 'active' | 'generate';
type Preset = 'today' | 'today-tomorrow' | 'week';

function getTodayWeekdayIndex(): number {
  // JS getDay(): Sun=0..Sat=6, WEEKDAYS: maandag=0..zondag=6
  return (new Date().getDay() + 6) % 7;
}

function getDaysForPreset(preset: Preset): readonly string[] {
  const today = getTodayWeekdayIndex();
  if (preset === 'today') return [WEEKDAYS[today]];
  if (preset === 'today-tomorrow') {
    return [WEEKDAYS[today], WEEKDAYS[(today + 1) % 7]];
  }
  return Array.from({ length: 7 }, (_, i) => WEEKDAYS[(today + i) % 7]);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function WeekScheduleScreen({ navigation }: any) {
  const { user } = useUser();
  const { show } = useToast();
  const goToLanding = () => navigation.getParent()?.getParent()?.goBack();

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState<ActiveSchedule | null>(null);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [scheduleName, setScheduleName] = useState('');

  /* Sub-tab + preset (persistent per gebruiker) */
  const [subtab, setSubtab] = useState<Subtab>('active');
  const [preset, setPreset] = useState<Preset>('today');

  /* Het actieve weekschema uit de DB (via Favorieten geactiveerd)
     + ratings om sterren bij elk gerecht te tonen. */
  const [activeSchedule, setActiveSchedule] = useState<Schedule | null>(null);
  const [ratings, setRatings] = useState<Record<string, RatingSummary>>({});

  const recipeMap = useMemo(
    () => new Map(recipes.map(r => [r.id, r])),
    [recipes]
  );

  const usedAllergens = useMemo(() => {
    const set = new Set<string>();
    recipes.forEach(r => (r.allergens || []).forEach(a => set.add(a)));
    return set;
  }, [recipes]);

  const userKey = user || 'anoniem';
  const activeKey = `${ACTIVE_KEY_PREFIX}${userKey}`;
  const subtabKey = `${SUBTAB_KEY_PREFIX}${userKey}`;
  const presetKey = `${PRESET_KEY_PREFIX}${userKey}`;

  const load = useCallback(async () => {
    try {
      const [r, savedRaw, subtabRaw, presetRaw, active, allRatings] = await Promise.all([
        getRecipes(),
        AsyncStorage.getItem(activeKey),
        AsyncStorage.getItem(subtabKey),
        AsyncStorage.getItem(presetKey),
        getActiveSchedule(user),
        getAllRatings(),
      ]);
      setRecipes(r);
      setActiveSchedule(active);
      setRatings(allRatings);

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

      if (subtabRaw === 'active' || subtabRaw === 'generate') {
        setSubtab(subtabRaw);
      }
      if (presetRaw === 'today' || presetRaw === 'today-tomorrow' || presetRaw === 'week') {
        setPreset(presetRaw);
      }
    } catch (err: any) {
      show('Fout bij laden: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [activeKey, subtabKey, presetKey, user, show]);

  const persistSubtab = useCallback(
    (s: Subtab) => {
      setSubtab(s);
      AsyncStorage.setItem(subtabKey, s).catch(() => {});
    },
    [subtabKey]
  );

  const persistPreset = useCallback(
    (p: Preset) => {
      setPreset(p);
      AsyncStorage.setItem(presetKey, p).catch(() => {});
    },
    [presetKey]
  );

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

  const todayDay = WEEKDAYS[getTodayWeekdayIndex()];

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <CompactHeader onBack={goToLanding} />

      {/* Sub-tab bar */}
      <View style={styles.subtabBar}>
        <Pressable
          style={[styles.subtabBtn, subtab === 'active' && styles.subtabBtnActive]}
          onPress={() => persistSubtab('active')}
        >
          <Text
            style={[
              styles.subtabBtnText,
              subtab === 'active' && styles.subtabBtnTextActive,
            ]}
          >
            Actief weekschema
          </Text>
        </Pressable>
        <Pressable
          style={[styles.subtabBtn, subtab === 'generate' && styles.subtabBtnActive]}
          onPress={() => persistSubtab('generate')}
        >
          <Text
            style={[
              styles.subtabBtnText,
              subtab === 'generate' && styles.subtabBtnTextActive,
            ]}
          >
            Genereren
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {subtab === 'active' ? (
          /* ============ ACTIEF WEEKSCHEMA ============ */
          !activeSchedule ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📅</Text>
              <Text style={styles.emptyTitle}>Nog geen actief weekschema</Text>
              <Text style={styles.emptyText}>
                Genereer eerst een weekschema in het tabblad{' '}
                <Text style={styles.bold}>Genereren</Text>, sla het op in
                Favorieten en activeer het daar.
              </Text>
              <Pressable
                style={[styles.btn, styles.btnPrimary, { marginTop: spacing.lg }]}
                onPress={() => persistSubtab('generate')}
              >
                <Text style={styles.btnPrimaryText}>Ga naar Genereren</Text>
              </Pressable>
            </View>
          ) : (
            <View>
              <Text style={styles.title} numberOfLines={2}>
                {activeSchedule.name || 'Actief weekschema'}
              </Text>

              {/* Preset-bar */}
              <View style={styles.presetBar}>
                <Pressable
                  style={[styles.presetBtn, preset === 'today' && styles.presetBtnActive]}
                  onPress={() => persistPreset('today')}
                >
                  <Text
                    style={[
                      styles.presetBtnText,
                      preset === 'today' && styles.presetBtnTextActive,
                    ]}
                  >
                    Vandaag
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.presetBtn,
                    preset === 'today-tomorrow' && styles.presetBtnActive,
                  ]}
                  onPress={() => persistPreset('today-tomorrow')}
                >
                  <Text
                    style={[
                      styles.presetBtnText,
                      preset === 'today-tomorrow' && styles.presetBtnTextActive,
                    ]}
                  >
                    Vandaag & morgen
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.presetBtn, preset === 'week' && styles.presetBtnActive]}
                  onPress={() => persistPreset('week')}
                >
                  <Text
                    style={[
                      styles.presetBtnText,
                      preset === 'week' && styles.presetBtnTextActive,
                    ]}
                  >
                    Heel weekschema
                  </Text>
                </Pressable>
              </View>

              {getDaysForPreset(preset).map(day => {
                const dayData = activeSchedule.days[day] || {};
                const isToday = day === todayDay;
                return (
                  <View
                    key={day}
                    style={[styles.activeDayBlock, isToday && styles.activeDayBlockToday]}
                  >
                    <View style={styles.activeDayHeader}>
                      <Text style={styles.activeDayHeaderText}>{capitalize(day)}</Text>
                      {isToday ? (
                        <View style={styles.activeDayBadge}>
                          <Text style={styles.activeDayBadgeText}>VANDAAG</Text>
                        </View>
                      ) : null}
                    </View>
                    {SCHEDULE_SLOTS.map(slot => {
                      const recipeId = dayData[slot.id];
                      const recipe = recipeId ? recipeMap.get(recipeId) : null;
                      const userRating =
                        recipeId && ratings[recipeId]?.average ? ratings[recipeId].average : 0;
                      return (
                        <View key={slot.id} style={styles.activeRow}>
                          <Text style={styles.activeRowSlot}>
                            {getSlotLabel(slot.id)}
                          </Text>
                          {recipe ? (
                            <Pressable
                              style={styles.activeRowRecipe}
                              onPress={() =>
                                navigation.navigate('RecipeDetail', { id: recipe.id })
                              }
                            >
                              <Text style={styles.activeRowName} numberOfLines={1}>
                                {recipe.name}
                              </Text>
                              {userRating > 0 ? (
                                <Stars rating={userRating} size={12} />
                              ) : null}
                            </Pressable>
                          ) : (
                            <Text style={styles.activeRowEmpty}>—</Text>
                          )}
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          )
        ) : (
          /* ============ GENEREREN ============ */
          <>
            <Text style={styles.title}>Weekschema Generator</Text>
            <View style={styles.intro}>
              <Text style={styles.introText}>
                💡 Bewaar je weekschema in <Text style={styles.bold}>Favorieten</Text> en
                genereer er nadien een <Text style={styles.bold}>boodschappenlijst</Text> van.
                Die verschijnt automatisch in de tab{' '}
                <Text style={styles.bold}>Boodschappenlijst</Text> onderaan.
              </Text>
            </View>

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
          </>
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

  /* ====== Sub-tab bar ====== */
  subtabBar: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.light,
  },
  subtabBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  subtabBtnActive: {
    borderBottomColor: colors.primary,
  },
  subtabBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray,
  },
  subtabBtnTextActive: {
    color: colors.primary,
  },

  /* ====== Preset bar (Vandaag / Vandaag & morgen / Heel weekschema) ====== */
  presetBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.lg,
  },
  presetBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
  },
  presetBtnActive: {
    backgroundColor: colors.primary,
  },
  presetBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  presetBtnTextActive: {
    color: colors.white,
  },

  /* ====== Actief weekschema dag-blokken ====== */
  activeDayBlock: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  activeDayBlockToday: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  activeDayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: colors.light,
  },
  activeDayHeaderText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  activeDayBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  activeDayBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: spacing.sm,
  },
  activeRowSlot: {
    width: 90,
    fontSize: 11,
    fontWeight: '700',
    color: colors.gray,
    textTransform: 'uppercase',
  },
  activeRowRecipe: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeRowName: {
    flex: 1,
    fontSize: 14,
    color: colors.dark,
    fontWeight: '500',
  },
  activeRowEmpty: {
    flex: 1,
    color: colors.grayLight,
    fontStyle: 'italic',
  },
});
