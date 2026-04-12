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
import { useFocusEffect } from '@react-navigation/native';
import { colors, radius, spacing, shadows } from '../constants/theme';
import { RecipeCard } from '../components/RecipeCard';
import { useToast } from '../components/Toast';
import { useUser } from '../context/UserContext';
import { UsernameHeader } from '../components/UsernameHeader';
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
import { WEEKDAYS, SCHEDULE_SLOTS, getSlotLabel } from '../constants/data';
import type { Recipe, RatingSummary, Schedule } from '../types';

export function FavoritesScreen({ navigation }: any) {
  const { user } = useUser();
  const { show } = useToast();

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ratings, setRatings] = useState<Record<string, RatingSummary>>({});
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [expandedSchedules, setExpandedSchedules] = useState<Set<string>>(new Set());
  const [scheduleRecipeNames, setScheduleRecipeNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
        const nameMap: Record<string, string> = {};
        recs.forEach(r => { nameMap[r.id] = r.name; });
        setScheduleRecipeNames(nameMap);
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
    <SafeAreaView style={styles.container} edges={['top']}>
      <UsernameHeader subtitle="Favorieten" />
      <FlatList
        data={recipes}
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
            <Text style={styles.heading}>Opgeslagen weekschema's</Text>
            <View style={styles.explainer}>
              <Text style={styles.explainerText}>
                💡 <Text style={styles.bold}>Tip:</Text> per opgeslagen
                weekschema kan je een boodschappenlijst genereren. Kies welke
                dagen en maaltijden je wil meenemen, en de app maakt automatisch
                een lijst met alle benodigde ingrediënten. Die verschijnt
                vervolgens in de tab{' '}
                <Text style={styles.bold}>Boodschappenlijst</Text> onderaan.
              </Text>
            </View>
            {schedules.length === 0 ? (
              <Text style={styles.muted}>
                Nog geen weekschema's. Genereer er een via de Weekschema-tab.
              </Text>
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
                    <View style={{ flex: 1 }}>
                      <Text style={styles.scheduleName}>{s.name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={styles.scheduleDate}>
                          {s.createdAt
                            ? new Date(s.createdAt).toLocaleDateString('nl-BE')
                            : ''}
                        </Text>
                        {s.isActive && (
                          <View style={styles.activeBadge}>
                            <Text style={styles.activeBadgeText}>
                              Actief · {s.persons || 4} personen
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                  <View style={styles.scheduleActions}>
                    {s.isActive ? (
                      <Pressable
                        style={[styles.btn, styles.btnOutline]}
                        onPress={() => handleDeactivateSchedule(s.id)}
                      >
                        <Text style={styles.btnOutlineText}>Deactiveren</Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        style={[styles.btn, styles.btnSecondary]}
                        onPress={() => handleActivateSchedule(s.id, s.persons)}
                      >
                        <Text style={styles.btnPrimaryText}>Activeren</Text>
                      </Pressable>
                    )}
                    <Pressable
                      style={[styles.btn, styles.btnOutline]}
                      onPress={() =>
                        setExpandedSchedules(prev => {
                          const next = new Set(prev);
                          if (next.has(s.id)) next.delete(s.id);
                          else next.add(s.id);
                          return next;
                        })
                      }
                    >
                      <Text style={styles.btnOutlineText}>
                        {expandedSchedules.has(s.id) ? 'Verbergen' : 'Details'}
                      </Text>
                    </Pressable>
                    {s.isActive && (
                      <Pressable
                        style={[styles.btn, styles.btnPrimary]}
                        onPress={() =>
                          navigation.navigate('ShoppingList', {
                            id: s.id,
                            persons: s.persons,
                          })
                        }
                      >
                        <Text style={styles.btnPrimaryText}>
                          🛒 Boodschappenlijst
                        </Text>
                      </Pressable>
                    )}
                    <Pressable
                      style={[styles.btn, styles.btnDanger]}
                      onPress={() => handleDeleteSchedule(s.id, s.name)}
                    >
                      <Text style={styles.btnPrimaryText}>Verwijderen</Text>
                    </Pressable>
                  </View>
                  {expandedSchedules.has(s.id) && (
                    <View style={styles.scheduleDetail}>
                      {WEEKDAYS.map(day => {
                        const slots = SCHEDULE_SLOTS.filter(
                          slot => s.days?.[day]?.[slot.id]
                        );
                        if (slots.length === 0) return null;
                        const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
                        return (
                          <View key={day} style={styles.detailDay}>
                            <Text style={styles.detailDayLabel}>{dayLabel}</Text>
                            {slots.map(slot => {
                              const rid = s.days[day][slot.id]!;
                              const recipeName = scheduleRecipeNames[rid] || '...';
                              return (
                                <Pressable
                                  key={slot.id}
                                  style={styles.detailSlot}
                                  onPress={() => navigation.navigate('RecipeDetail', { id: rid })}
                                >
                                  <Text style={styles.detailSlotLabel}>
                                    {getSlotLabel(slot.id)}
                                  </Text>
                                  <Text style={styles.detailRecipeName} numberOfLines={1}>
                                    {recipeName}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              ))
            )}

            <Text style={[styles.heading, { marginTop: spacing.xl }]}>
              Favoriete recepten
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🤍</Text>
            <Text style={styles.emptyTitle}>Nog geen favorieten</Text>
            <Text style={styles.emptyText}>
              Tik op het hartje bij een recept om het hier te bewaren.
            </Text>
          </View>
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
  heading: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.dark,
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 3,
    borderBottomColor: colors.primary,
    alignSelf: 'flex-start',
  },
  muted: {
    color: colors.gray,
    fontStyle: 'italic',
    marginBottom: spacing.md,
  },
  explainer: {
    backgroundColor: 'rgba(152, 195, 164, 0.18)',
    borderLeftWidth: 4,
    borderLeftColor: colors.secondaryDark,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
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
  scheduleCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
    ...shadows.sm,
  },
  scheduleCardActive: {
    borderColor: colors.secondary,
  },
  activeBadge: {
    backgroundColor: colors.secondary,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  activeBadgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '600',
  },
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  scheduleName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.dark,
    flex: 1,
  },
  scheduleDate: {
    fontSize: 12,
    color: colors.gray,
  },
  scheduleActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  btnPrimary: {
    backgroundColor: colors.primary,
  },
  btnSecondary: {
    backgroundColor: colors.secondary,
  },
  btnDanger: {
    backgroundColor: colors.danger,
  },
  btnOutline: {
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: 'transparent',
  },
  btnOutlineText: {
    color: colors.primary,
    fontWeight: '600',
  },
  btnPrimaryText: {
    color: colors.white,
    fontWeight: '600',
  },
  scheduleDetail: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.light,
    paddingTop: spacing.md,
  },
  detailDay: {
    marginBottom: spacing.sm,
  },
  detailDayLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryDark,
    marginBottom: 4,
  },
  detailSlot: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingLeft: spacing.sm,
    gap: spacing.sm,
  },
  detailSlotLabel: {
    width: 80,
    fontSize: 11,
    fontWeight: '600',
    color: colors.gray,
    textTransform: 'uppercase',
  },
  detailRecipeName: {
    flex: 1,
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
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
});
