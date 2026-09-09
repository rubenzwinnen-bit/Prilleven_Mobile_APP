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
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radius, spacing, shadows } from '../constants/theme';
import { useToast } from '../components/Toast';
import { useUser } from '../context/UserContext';
import { CompactHeader } from '../navigation/RootStack';
import { ScheduleTable } from '../components/ScheduleTable';
import { ActiveDayBlocks } from '../components/ActiveDayBlocks';
import { CookingRhythm } from '../components/CookingRhythm';
import { InfoModal } from '../components/InfoModal';
import {
  readCookedMeals,
  cookedKeysForSchedule,
  getCookingRhythmHistory,
} from '../lib/cookingProgress';
import type { CookedMeal } from '../lib/cookingProgress';
import {
  getRecipes,
  saveSchedule,
  getActiveSchedule,
  getAllRatings,
  getFavoriteRecipeIds,
} from '../services';
import {
  createSelectionState,
  recordSelection,
  removeSelection,
  selectRecipeForSlot,
  ensureFavoriteAppears,
  buildSelectionStateFromSchedule,
} from '../lib/scheduleSelection';
import {
  ALLERGENS,
  WEEKDAYS,
  SCHEDULE_SLOTS,
  slotToMealMoment,
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

export function WeekScheduleScreen({ navigation }: any) {
  const { user } = useUser();
  const { show } = useToast();
  const goToLanding = () => navigation.getParent()?.getParent()?.goBack();

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState<ActiveSchedule | null>(null);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [preferFavorites, setPreferFavorites] = useState(false);
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [infoVisible, setInfoVisible] = useState(false);
  /* Cooked it / Pril Ritme — lokaal bijgehouden, zie lib/cookingProgress.ts. */
  const [cookedMeals, setCookedMeals] = useState<CookedMeal[]>([]);
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
      const [r, savedRaw, subtabRaw, presetRaw, active, allRatings, favIds] =
        await Promise.all([
          getRecipes(),
          AsyncStorage.getItem(activeKey),
          AsyncStorage.getItem(subtabKey),
          AsyncStorage.getItem(presetKey),
          getActiveSchedule(user),
          getAllRatings(),
          getFavoriteRecipeIds(user || ''),
        ]);
      setRecipes(r);
      setActiveSchedule(active);
      setRatings(allRatings);
      setFavoriteIds(new Set(favIds));

      if (savedRaw) {
        try {
          const parsed = JSON.parse(savedRaw);
          if (parsed && parsed.days) {
            setSchedule(parsed);
            setExcluded(parsed.excludedAllergens || []);
            setPreferFavorites(Boolean(parsed.preferFavorites));
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

  /* Dit scherm blijft in de tabbalk gemonteerd. Zonder herladen bij focus zou
     de favorietenvoorkeur met een verouderde lijst werken zodra je in de tab
     Recepten een hartje aantikt en terugkomt. */
  useFocusEffect(
    useCallback(() => {
      getFavoriteRecipeIds(user || '')
        .then(ids => setFavoriteIds(new Set(ids)))
        .catch(() => {
          /* Stil: een mislukte verversing mag het scherm niet blokkeren. */
        });

      /* Je vinkt een gerecht af op het receptdetail, dus bij terugkeer moet
         het ritme en het vinkje op de tegel meteen kloppen. */
      readCookedMeals(user).then(setCookedMeals);
    }, [user])
  );

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

    /* Met favorietenvoorkeur bewaken we tegelijk variatie; zonder voorkeur
       blijft de bestaande uniforme random-selectie behouden. */
    const usePreference = preferFavorites && favoriteIds.size > 0;
    const selectionState = createSelectionState(available, usePreference, favoriteIds);

    const days: ActiveSchedule['days'] = {};
    WEEKDAYS.forEach(day => {
      days[day] = {};
      SCHEDULE_SLOTS.forEach(slot => {
        const mealMoment = slotToMealMoment(slot.id);
        const suitable = available.filter(r =>
          (r.mealMoments || []).includes(mealMoment)
        );

        const selection = selectRecipeForSlot(suitable, selectionState);
        days[day][slot.id] = selection.recipe?.id || null;
        recordSelection(selectionState, selection.recipe, selection.usedPreference);
      });
    });

    ensureFavoriteAppears(days, available, selectionState);

    const newSchedule: ActiveSchedule = {
      days,
      excludedAllergens: excluded,
      preferFavorites: usePreference,
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

    const currentId = schedule.days[day]?.[slotId] ?? null;
    const selectionState = buildSelectionStateFromSchedule(
      schedule,
      available,
      recipeMap,
      favoriteIds
    );
    removeSelection(selectionState, currentId);
    const selection = selectRecipeForSlot(suitable, selectionState, currentId);

    const newSchedule = {
      ...schedule,
      days: {
        ...schedule.days,
        [day]: {
          ...schedule.days[day],
          [slotId]: selection.recipe?.id || null,
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
      <CompactHeader
        onBack={goToLanding}
        onInfo={subtab === 'generate' ? () => setInfoVisible(true) : undefined}
      />

      {/* Sub-tabs in de stijl van de favorietenzone */}
      <View style={styles.subtabBar}>
        <Pressable
          style={[styles.subtabCard, subtab === 'active' && styles.subtabCardActive]}
          onPress={() => persistSubtab('active')}
        >
          <Text style={styles.subtabTitle}>Actief weekschema</Text>
          <Text style={styles.subtabHint} numberOfLines={1}>
            {activeSchedule ? activeSchedule.name : 'Nog geen actief schema'}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.subtabCard, subtab === 'generate' && styles.subtabCardActive]}
          onPress={() => persistSubtab('generate')}
        >
          <Text style={styles.subtabTitle}>Genereren</Text>
          <Text style={styles.subtabHint} numberOfLines={1}>
            Nieuw schema samenstellen
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
              {/* Pril Ritme: de lopende week en de drie voorgaande. */}
              <CookingRhythm history={getCookingRhythmHistory(cookedMeals)} />

              {/* Alleen de dagkiezer: de naam van het schema staat al in de
                  subtab-kaart erboven, dus die wordt hier niet herhaald. */}
              <View style={styles.activeToolbar}>
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
              </View>

              <ActiveDayBlocks
                days={getDaysForPreset(preset)}
                daysData={activeSchedule.days}
                recipeMap={recipeMap}
                onPressRecipe={id => navigation.navigate('RecipeDetail', { id })}
                todayDay={todayDay}
                cookedKeys={cookedKeysForSchedule(cookedMeals, activeSchedule.id)}
              />
            </View>
          )
        ) : (
          /* ============ GENEREREN ============ */
          <>
            <View style={styles.controls}>
              <View style={styles.controlsHeader}>
                <Text style={styles.subTitle}>Allergenen uitsluiten</Text>
                <Pressable
                  onPress={() => favoriteIds.size > 0 && setPreferFavorites(v => !v)}
                  disabled={favoriteIds.size === 0}
                  style={[
                    styles.favToggle,
                    preferFavorites && favoriteIds.size > 0 && styles.favToggleActive,
                    favoriteIds.size === 0 && styles.favToggleDisabled,
                  ]}
                >
                  <View
                    style={[
                      styles.favBox,
                      preferFavorites && favoriteIds.size > 0 && styles.favBoxChecked,
                    ]}
                  >
                    {preferFavorites && favoriteIds.size > 0 && (
                      <Text style={styles.favCheck}>✓</Text>
                    )}
                  </View>
                  <Text style={styles.favToggleText}>Gebruik favorieten</Text>
                </Pressable>
              </View>
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
                  style={[styles.btn, styles.btnSecondary, styles.btnLg]}
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
              <ScheduleTable
                days={WEEKDAYS}
                daysData={schedule.days}
                recipeMap={recipeMap}
                ratings={ratings}
                onPressRecipe={id => navigation.navigate('RecipeDetail', { id })}
                onRefreshSlot={refreshSlot}
              />
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

      <InfoModal
        visible={infoVisible}
        onClose={() => setInfoVisible(false)}
        title="Zo werkt het weekschema"
      >
        <Text style={styles.introText}>
          Bewaar je weekschema in <Text style={styles.bold}>Favorieten</Text> en
          genereer er nadien een <Text style={styles.bold}>boodschappenlijst</Text>{' '}
          van. Die verschijnt automatisch in de tab{' '}
          <Text style={styles.bold}>Boodschappenlijst</Text> onderaan.
        </Text>

        <Text style={[styles.introText, { marginTop: spacing.md }]}>
          <Text style={styles.bold}>Allergenen uitsluiten:</Text> vink aan wat je
          wil vermijden. Recepten met die allergenen worden niet gebruikt.
        </Text>

        <Text style={[styles.introText, { marginTop: spacing.md }]}>
          <Text style={styles.bold}>Gebruik favorieten:</Text>{' '}
          {favoriteIds.size > 0
            ? 'favorieten krijgen vaker een plek, terwijl je weekschema gevarieerd blijft.'
            : 'zodra je recepten als favoriet bewaart, kan je ze hier vaker laten terugkomen.'}
        </Text>
      </InfoModal>

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
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 100,
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
  controlsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  favToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(79, 125, 108, 0.35)',
    backgroundColor: colors.white,
  },
  favToggleActive: {
    backgroundColor: 'rgba(79, 125, 108, 0.13)',
    borderColor: 'rgba(79, 125, 108, 0.52)',
  },
  favToggleDisabled: {
    opacity: 0.5,
  },
  favToggleText: {
    color: colors.greenText,
    fontSize: 12,
    fontWeight: '700',
  },
  favBox: {
    width: 15,
    height: 15,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.greenText,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favBoxChecked: {
    backgroundColor: colors.greenText,
  },
  favCheck: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
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
  btnSecondary: { backgroundColor: colors.greenText },
  btnPrimaryText: { color: colors.white, fontWeight: '600' },
  btnOutline: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  btnOutlineText: {
    color: colors.primary,
    fontWeight: '600',
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
  /* ====== Sub-tabs ======
     Zelfde kaartvorm als de tel-tabs in de favorietenzone. Bewuste afwijking
     van de web, waar dit platte teksttabs met een onderlijn zijn. */
  subtabBar: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  subtabCard: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(79, 125, 108, 0.16)',
    borderRadius: 16,
  },
  subtabCardActive: {
    backgroundColor: 'rgba(79, 125, 108, 0.13)',
    borderColor: 'rgba(79, 125, 108, 0.52)',
  },
  subtabTitle: {
    color: colors.greenText,
    fontSize: 15,
    fontWeight: '700',
  },
  subtabHint: {
    marginTop: spacing.xs,
    color: colors.gray,
    fontSize: 12,
  },

  /* ====== Lage titel-/segmentbalk boven het actieve schema ======
     Web-pariteit met .active-schedule-toolbar: geen kaart, geen schaduw,
     geen uitleg — alleen de naam en de dagkiezer. */
  activeToolbar: {
    marginBottom: spacing.lg,
  },

  /* ====== Dagkiezer (Vandaag / Vandaag & morgen / Heel weekschema) ======
     Segmented control: één omlijnde bak met daarin pillen, i.p.v. drie losse
     omrande knoppen. Spiegel van .day-selector-bar / .day-selector-btn. */
  presetBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    padding: 4,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.light,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  presetBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 9,
    backgroundColor: 'transparent',
  },
  presetBtnActive: {
    backgroundColor: colors.greenText,
    shadowColor: colors.greenText,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 2,
  },
  presetBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.greenText,
  },
  presetBtnTextActive: {
    color: colors.white,
  },

  /* ====== Actief weekschema dag-blokken ====== */
  /* Web-pariteit met .active-day-block: een rondom lopende, zachtgroene rand
     in plaats van een dikke linkerbalk. Vandaag valt op doordat die rand
     terracotta wordt — niet doordat er een streep bij komt. */
});
