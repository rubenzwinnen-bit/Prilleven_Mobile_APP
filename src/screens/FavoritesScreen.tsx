/**
 * FAVORITES SCREEN
 * Toont de favoriete recepten en de opgeslagen weekschema's.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Pressable,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { InfoModal } from '../components/InfoModal';
import { ScheduleTable } from '../components/ScheduleTable';
import { useFocusEffect } from '@react-navigation/native';
import { colors, radius, spacing, shadows } from '../constants/theme';
import { RecipeCard } from '../components/RecipeCard';
import { useToast } from '../components/Toast';
import { useUser } from '../context/UserContext';
import { CompactHeader } from '../navigation/RootStack';
import {
  getFavoriteRecipes,
  getAllRatings,
  getSavedSchedules,
  getRecipesByIds,
  toggleFavorite,
  deleteSchedule,
  setActiveSchedule,
  deactivateSchedule,
} from '../services';
import { WEEKDAYS } from '../constants/data';
import type { Recipe, RatingSummary, Schedule } from '../types';

/* Spiegel van formatDateShort in js/utils.js op de website. */
function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('nl-BE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function FavoritesScreen({ navigation }: any) {
  const { user } = useUser();
  const { show } = useToast();
  const goToLanding = () => navigation.getParent()?.getParent()?.goBack();

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ratings, setRatings] = useState<Record<string, RatingSummary>>({});
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [expandedSchedules, setExpandedSchedules] = useState<Set<string>>(new Set());
  const [scheduleRecipes, setScheduleRecipes] = useState<Map<string, Recipe>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  /* Web-parity: twee panelen achter tel-tabs, recepten staan vooraan. */
  const [tab, setTab] = useState<'recipes' | 'schedules'>('recipes');
  const [infoVisible, setInfoVisible] = useState(false);

  const load = useCallback(async () => {
    try {
      const [favs, rt, schs] = await Promise.all([
        getFavoriteRecipes(user),
        getAllRatings(),
        getSavedSchedules(user),
      ]);
      setRecipes(favs);
      setRatings(rt);
      setSchedules(schs);

      // Haal receptnamen op voor alle schema's
      const allIds = new Set<string>();
      schs.forEach(s => {
        Object.values(s.days || {}).forEach(slots => {
          Object.values(slots || {}).forEach(rid => {
            if (rid) allIds.add(rid);
          });
        });
      });
      if (allIds.size > 0) {
        const recs = await getRecipesByIds([...allIds]);
        setScheduleRecipes(new Map(recs.map(r => [r.id, r])));
      }
    } catch (err: any) {
      show('Fout: ' + err.message, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, show]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleUnfavorite = useCallback(
    async (id: string) => {
      try {
        await toggleFavorite(id, user);
        setRecipes(prev => prev.filter(r => r.id !== id));
        show('Verwijderd uit favorieten');
      } catch (err: any) {
        show('Fout: ' + err.message, 'error');
      }
    },
    [user, show]
  );

  const handleActivateSchedule = useCallback(
    (scheduleId: string, currentPersons?: number) => {
      Alert.prompt(
        'Activeren',
        'Voor hoeveel personen wil je dit weekschema activeren?',
        [
          { text: 'Annuleren', style: 'cancel' },
          {
            text: 'Activeren',
            onPress: async (input?: string) => {
              const persons = parseInt(input || '4');
              if (!persons || persons < 1) {
                show('Voer een geldig aantal personen in (minimaal 1)', 'error');
                return;
              }
              try {
                await setActiveSchedule(scheduleId, persons);
                show(`Weekschema geactiveerd voor ${persons} personen!`);
                load();
              } catch (err: any) {
                show('Fout: ' + err.message, 'error');
              }
            },
          },
        ],
        'plain-text',
        String(currentPersons || 4)
      );
    },
    [show, load]
  );

  const handleDeactivateSchedule = useCallback(
    async (scheduleId: string) => {
      try {
        await deactivateSchedule(scheduleId);
        show('Weekschema gedeactiveerd');
        load();
      } catch (err: any) {
        show('Fout: ' + err.message, 'error');
      }
    },
    [show, load]
  );

  const handleDeleteSchedule = useCallback(
    (id: string, name: string) => {
      Alert.alert(
        'Weekschema verwijderen?',
        `"${name}" wordt definitief verwijderd.`,
        [
          { text: 'Annuleren', style: 'cancel' },
          {
            text: 'Verwijderen',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteSchedule(id);
                setSchedules(prev => prev.filter(s => s.id !== id));
                show('Weekschema verwijderd');
              } catch (err: any) {
                show('Fout: ' + err.message, 'error');
              }
            },
          },
        ]
      );
    },
    [show]
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <CompactHeader
        onBack={goToLanding}
        onInfo={tab === 'schedules' ? () => setInfoVisible(true) : undefined}
      />

      <InfoModal
        visible={infoVisible}
        onClose={() => setInfoVisible(false)}
        title="Boodschappenlijst uit een weekschema"
      >
        <Text style={styles.explainerText}>
          Per opgeslagen weekschema kan je een boodschappenlijst genereren. Kies
          welke dagen en maaltijden je wil meenemen, en de app maakt automatisch
          een lijst met alle benodigde ingrediënten. Die verschijnt vervolgens in
          de tab <Text style={styles.bold}>Boodschappenlijst</Text> onderaan.
        </Text>
      </InfoModal>
      <FlatList
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
        removeClippedSubviews
        data={tab === 'recipes' ? recipes : []}
        keyExtractor={r => r.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View>
            <LinearGradient
              colors={['rgba(79, 125, 108, 0.12)', 'rgba(79, 125, 108, 0.035)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.hero}
            >
              <Text style={styles.eyebrow}>Voor later bewaard</Text>
              <Text style={styles.heroTitle}>Jouw favorieten</Text>
              <View style={styles.summary}>
                <Pressable
                  onPress={() => setTab('recipes')}
                  style={[
                    styles.summaryItem,
                    tab === 'recipes' && styles.summaryItemActive,
                  ]}
                >
                  <Text style={styles.summaryCount}>{recipes.length}</Text>
                  <Text style={styles.summaryLabel}>
                    {recipes.length === 1 ? 'recept' : 'recepten'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setTab('schedules')}
                  style={[
                    styles.summaryItem,
                    tab === 'schedules' && styles.summaryItemActive,
                  ]}
                >
                  <Text style={styles.summaryCount}>{schedules.length}</Text>
                  <Text style={styles.summaryLabel}>
                    {schedules.length === 1 ? 'weekschema' : "weekschema's"}
                  </Text>
                </Pressable>
              </View>
            </LinearGradient>

            {tab === 'schedules' && (
            <View>
            {schedules.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyLabel}>Nog leeg</Text>
                <Text style={styles.emptyStateTitle}>
                  Geen opgeslagen weekschema's
                </Text>
                <Text style={styles.emptyStateText}>
                  Sla een weekschema op en je kunt het hier later opnieuw
                  activeren.
                </Text>
              </View>
            ) : (
              schedules.map(s => (
                <View
                  key={s.id}
                  style={[
                    styles.scheduleCard,
                    s.isActive && styles.scheduleCardActive,
                  ]}
                >
                  <View style={styles.scheduleHeader}>
                    <View style={styles.scheduleHeading}>
                      <View style={styles.scheduleLabelRow}>
                        <Text style={styles.scheduleLabel}>Weekschema</Text>
                        {s.isActive && (
                          <View style={styles.activeBadge}>
                            <Text style={styles.activeBadgeText}>Actief</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.scheduleName}>{s.name}</Text>
                      <Text style={styles.scheduleDate}>
                        {s.createdAt
                          ? `Opgeslagen ${formatDateShort(s.createdAt)}`
                          : 'Opgeslagen'}
                      </Text>
                    </View>
                    <View style={styles.personsPill}>
                      <Text style={styles.personsPillText}>
                        {s.persons || 4} personen
                      </Text>
                    </View>
                  </View>

                  <View style={styles.scheduleActions}>
                    <View style={styles.mainActions}>
                      {s.isActive ? (
                        <Pressable
                          style={[styles.action, styles.actionPrimary]}
                          onPress={() =>
                            navigation.navigate('ShoppingList', {
                              id: s.id,
                              persons: s.persons,
                            })
                          }
                        >
                          <Text style={styles.actionPrimaryText}>
                            Boodschappenlijst
                          </Text>
                        </Pressable>
                      ) : (
                        <Pressable
                          style={[styles.action, styles.actionPrimary]}
                          onPress={() => handleActivateSchedule(s.id, s.persons)}
                        >
                          <Text style={styles.actionPrimaryText}>Activeren</Text>
                        </Pressable>
                      )}

                      <Pressable
                        style={[styles.action, styles.actionSecondary]}
                        onPress={() =>
                          setExpandedSchedules(prev => {
                            const next = new Set(prev);
                            if (next.has(s.id)) next.delete(s.id);
                            else next.add(s.id);
                            return next;
                          })
                        }
                      >
                        <Text style={styles.actionSecondaryText}>
                          {expandedSchedules.has(s.id)
                            ? 'Details verbergen'
                            : 'Details bekijken'}
                        </Text>
                      </Pressable>

                      {s.isActive && (
                        <Pressable
                          style={[styles.action, styles.actionSecondary]}
                          onPress={() => handleDeactivateSchedule(s.id)}
                        >
                          <Text style={styles.actionSecondaryText}>
                            Deactiveren
                          </Text>
                        </Pressable>
                      )}
                    </View>

                    <Pressable
                      style={styles.deleteAction}
                      onPress={() => handleDeleteSchedule(s.id, s.name)}
                    >
                      <Text style={styles.deleteActionText}>Verwijderen</Text>
                    </Pressable>
                  </View>

                  {expandedSchedules.has(s.id) && (
                    <View style={styles.scheduleDetail}>
                      <ScheduleTable
                        days={WEEKDAYS}
                        daysData={s.days || {}}
                        recipeMap={scheduleRecipes}
                        onPressRecipe={id =>
                          navigation.navigate('RecipeDetail', { id })
                        }
                      />
                    </View>
                  )}
                </View>
              ))
            )}
            </View>
            )}
          </View>
        }
        ListEmptyComponent={
          tab === 'recipes' ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyLabel}>Nog leeg</Text>
              <Text style={styles.emptyStateTitle}>Geen favoriete recepten</Text>
              <Text style={styles.emptyStateText}>
                Bewaar een recept vanuit het receptenboek en je vindt het hier
                meteen terug.
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <RecipeCard
            recipe={item}
            rating={ratings[item.id]}
            isFavorite
            onPress={() => navigation.navigate('RecipeDetail', { id: item.id })}
            onToggleFavorite={() => handleUnfavorite(item.id)}
          />
        )}
      />
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
  },
  list: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  /* Hero + tel-tabs, gespiegeld van .favorites-hero / .favorites-summary */
  hero: {
    padding: spacing.lg,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(79, 125, 108, 0.18)',
    marginBottom: spacing.lg,
  },
  eyebrow: {
    color: colors.greenText,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroTitle: {
    marginTop: spacing.xs,
    color: colors.greenText,
    fontSize: 30,
    fontWeight: '700',
    lineHeight: 34,
  },
  summary: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  summaryItem: {
    flex: 1,
    padding: spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(79, 125, 108, 0.16)',
    borderRadius: 16,
  },
  summaryItemActive: {
    backgroundColor: 'rgba(79, 125, 108, 0.13)',
    borderColor: 'rgba(79, 125, 108, 0.52)',
  },
  summaryCount: {
    color: colors.greenText,
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 28,
  },
  summaryLabel: {
    marginTop: spacing.xs,
    color: colors.gray,
    fontSize: 12,
  },
  /* Lege staat, gespiegeld van .favorites-empty-state */
  emptyState: {
    padding: spacing.xl,
    alignItems: 'center',
    backgroundColor: 'rgba(79, 125, 108, 0.045)',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(79, 125, 108, 0.28)',
    borderRadius: 18,
  },
  emptyLabel: {
    color: colors.greenText,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  emptyStateTitle: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    color: colors.dark,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyStateText: {
    color: colors.gray,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  explainerText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.darkLight,
  },
  bold: {
    fontWeight: '700',
    color: colors.primaryDark,
  },
  /* Opgeslagen weekschema, gespiegeld van .saved-schedule-card */
  scheduleCard: {
    backgroundColor: colors.white,
    borderRadius: 22,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(79, 125, 108, 0.17)',
    ...shadows.sm,
  },
  scheduleCardActive: {
    borderColor: 'rgba(79, 125, 108, 0.5)',
  },
  scheduleHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  scheduleHeading: {
    flex: 1,
  },
  scheduleLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scheduleLabel: {
    color: colors.greenText,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  activeBadge: {
    backgroundColor: colors.greenText,
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: 999,
  },
  activeBadgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '600',
  },
  scheduleName: {
    marginTop: 5,
    marginBottom: 3,
    fontSize: 20,
    fontWeight: '700',
    color: colors.dark,
    lineHeight: 25,
  },
  scheduleDate: {
    fontSize: 12,
    color: colors.gray,
  },
  personsPill: {
    paddingVertical: 6,
    paddingHorizontal: 11,
    backgroundColor: colors.bg,
    borderRadius: 999,
  },
  personsPillText: {
    color: colors.gray,
    fontSize: 11.5,
    fontWeight: '700',
  },
  /* Actierij, gespiegeld van .saved-schedule-actions */
  scheduleActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.light,
  },
  mainActions: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  action: {
    minHeight: 38,
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 9,
    borderWidth: 1,
    justifyContent: 'center',
  },
  actionPrimary: {
    backgroundColor: colors.greenText,
    borderColor: colors.greenText,
  },
  actionPrimaryText: {
    color: colors.white,
    fontSize: 12.5,
    fontWeight: '700',
  },
  actionSecondary: {
    backgroundColor: colors.white,
    borderColor: 'rgba(79, 125, 108, 0.35)',
  },
  actionSecondaryText: {
    color: colors.greenText,
    fontSize: 12.5,
    fontWeight: '700',
  },
  deleteAction: {
    minHeight: 38,
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 9,
    justifyContent: 'center',
  },
  deleteActionText: {
    color: '#a7372c',
    fontSize: 12.5,
    fontWeight: '700',
  },
  scheduleDetail: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.light,
    paddingTop: spacing.md,
  },
});
