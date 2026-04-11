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
  toggleFavorite,
  deleteSchedule,
} from '../services';
import type { Recipe, RatingSummary, Schedule } from '../types';

export function FavoritesScreen({ navigation }: any) {
  const { user } = useUser();
  const { show } = useToast();

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ratings, setRatings] = useState<Record<string, RatingSummary>>({});
  const [schedules, setSchedules] = useState<Schedule[]>([]);
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
                <View key={s.id} style={styles.scheduleCard}>
                  <View style={styles.scheduleHeader}>
                    <Text style={styles.scheduleName}>{s.name}</Text>
                    <Text style={styles.scheduleDate}>
                      {s.createdAt
                        ? new Date(s.createdAt).toLocaleDateString('nl-BE')
                        : ''}
                    </Text>
                  </View>
                  <View style={styles.scheduleActions}>
                    <Pressable
                      style={[styles.btn, styles.btnPrimary]}
                      onPress={() =>
                        navigation.navigate('ShoppingList', { id: s.id })
                      }
                    >
                      <Text style={styles.btnPrimaryText}>
                        🛒 Genereer boodschappenlijst
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.btn, styles.btnDanger]}
                      onPress={() => handleDeleteSchedule(s.id, s.name)}
                    >
                      <Text style={styles.btnPrimaryText}>Verwijderen</Text>
                    </Pressable>
                  </View>
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
    ...shadows.sm,
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
  btnDanger: {
    backgroundColor: colors.danger,
  },
  btnPrimaryText: {
    color: colors.white,
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
});
