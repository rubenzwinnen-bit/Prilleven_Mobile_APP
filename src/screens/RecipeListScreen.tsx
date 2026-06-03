/**
 * RECIPE LIST SCREEN
 * Overzicht van alle recepten met zoek- en filterfunctionaliteit.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  ScrollView,
  Pressable,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, radius, spacing, shadows } from '../constants/theme';
import { ChevronBack, HEADER_CONTENT_HEIGHT } from '../navigation/RootStack';
import { RecipeCard } from '../components/RecipeCard';
import { useToast } from '../components/Toast';
import {
  getRecipes,
  getAllRatings,
  getFavoriteRecipeIds,
  toggleFavorite,
  KNOWN_ALLERGEN_OPTIONS,
} from '../services';
import { normalizeAllergen } from '../lib/familyLayer';
import { useUser } from '../context/UserContext';
import { MEAL_MOMENTS } from '../constants/data';
import type { Recipe, RatingSummary } from '../types';

export function RecipeListScreen({ navigation }: any) {
  const { user } = useUser();
  const { show } = useToast();

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ratings, setRatings] = useState<Record<string, RatingSummary>>({});
  const [favIds, setFavIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState('');
  const [momentFilter, setMomentFilter] = useState<string[]>([]);
  const [allergenFilter, setAllergenFilter] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filtersActive = momentFilter.length > 0 || allergenFilter.length > 0;

  /* Toggle-helpers: voeg toe of verwijder uit de multi-select-lijst. */
  const toggleMoment = useCallback((id: string) => {
    setMomentFilter(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }, []);
  const toggleAllergen = useCallback((key: string) => {
    setAllergenFilter(prev =>
      prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key]
    );
  }, []);

  /* Helper om naar Landing te gaan (twee niveaus omhoog vanaf RecipesStack). */
  const goToLanding = useCallback(() => {
    navigation.getParent()?.getParent()?.goBack();
  }, [navigation]);

  /* Scroll-positie wordt automatisch bewaard door native-stack —
     de FlatList blijft gemount terwijl we naar RecipeDetail navigeren. */

  const loadData = useCallback(async () => {
    try {
      const [r, rt, favs] = await Promise.all([
        getRecipes(),
        getAllRatings(),
        getFavoriteRecipeIds(user),
      ]);
      setRecipes(r);
      setRatings(rt);
      setFavIds(favs);
    } catch (err: any) {
      show('Fout bij laden: ' + err.message, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, show]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleFav = useCallback(
    async (recipeId: string) => {
      try {
        const isFav = await toggleFavorite(recipeId, user);
        setFavIds(prev =>
          isFav ? [...prev, recipeId] : prev.filter(id => id !== recipeId)
        );
      } catch (err: any) {
        show('Fout: ' + err.message, 'error');
      }
    },
    [user, show]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return recipes.filter(r => {
      if (q && !r.name.toLowerCase().includes(q)) return false;
      /* Eetmomenten: recept moet minstens één geselecteerd moment bevatten. */
      if (
        momentFilter.length > 0 &&
        !momentFilter.some(m => (r.mealMoments || []).includes(m))
      ) {
        return false;
      }
      /* Allergenen wegfilteren: verberg recept als het één van de
         geselecteerde allergenen bevat. Recept-allergenen worden
         genormaliseerd (legacy → canoniek) zodat ze matchen met de 9 keys. */
      if (allergenFilter.length > 0) {
        const recipeAllergens = new Set(
          (r.allergens || []).map(normalizeAllergen)
        );
        if (allergenFilter.some(a => recipeAllergens.has(a))) return false;
      }
      return true;
    });
  }, [recipes, search, momentFilter, allergenFilter]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Recepten laden...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerRow}>
        <ChevronBack onPress={goToLanding} />
        <TextInput
          style={styles.headerSearch}
          placeholder="🔍  Zoek recepten..."
          placeholderTextColor={colors.gray}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        <Pressable
          style={[
            styles.headerFilter,
            (filtersOpen || filtersActive) && styles.headerFilterActive,
          ]}
          onPress={() => setFiltersOpen(v => !v)}
          hitSlop={6}
        >
          <Feather
            name="sliders"
            size={18}
            color={
              filtersOpen || filtersActive ? colors.white : colors.primary
            }
          />
          {filtersActive && !filtersOpen ? (
            <View style={styles.filterDot} />
          ) : null}
        </Pressable>
      </View>

      {filtersOpen ? (
        <View style={styles.filtersPanel}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            <FilterChip
              label="Alle eetmomenten"
              active={momentFilter.length === 0}
              onPress={() => setMomentFilter([])}
            />
            {MEAL_MOMENTS.map(m => (
              <FilterChip
                key={m.id}
                label={m.label}
                active={momentFilter.includes(m.id)}
                onPress={() => toggleMoment(m.id)}
              />
            ))}
          </ScrollView>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            <FilterChip
              label="Geen allergenen filter"
              active={allergenFilter.length === 0}
              onPress={() => setAllergenFilter([])}
            />
            {KNOWN_ALLERGEN_OPTIONS.map(a => (
              <FilterChip
                key={a.key}
                label={`zonder ${a.label}`}
                active={allergenFilter.includes(a.key)}
                onPress={() => toggleAllergen(a.key)}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <FlatList
        data={filtered}
        keyExtractor={r => r.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData();
            }}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyTitle}>Geen recepten gevonden</Text>
            <Text style={styles.emptyText}>Probeer een andere zoekterm of filter.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <RecipeCard
            recipe={item}
            rating={ratings[item.id]}
            isFavorite={favIds.includes(item.id)}
            onPress={() => navigation.navigate('RecipeDetail', { id: item.id })}
            onToggleFavorite={() => handleToggleFav(item.id)}
          />
        )}
      />
    </SafeAreaView>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.gray,
  },
  /* Inline screen-header */
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    height: HEADER_CONTENT_HEIGHT,
    gap: spacing.sm,
    backgroundColor: colors.bg,
  },
  headerSearch: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.light,
    backgroundColor: colors.white,
    fontSize: 13,
    color: colors.dark,
  },
  headerFilter: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.light,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerFilterActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  /* Filterpanel onder de header (chip-rijen, alleen zichtbaar als open) */
  filtersPanel: {
    backgroundColor: colors.white,
    paddingVertical: spacing.xs,
    ...shadows.sm,
  },
  filterDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  chipRow: {
    paddingHorizontal: spacing.lg,
    gap: 6,
    paddingVertical: 4,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.light,
    borderRadius: radius.sm,
    marginRight: 6,
  },
  chipActive: {
    backgroundColor: colors.primary,
  },
  chipText: {
    fontSize: 12,
    color: colors.dark,
    fontWeight: '500',
  },
  chipTextActive: {
    color: colors.white,
  },
  list: {
    padding: spacing.lg,
    paddingBottom: 100,
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
