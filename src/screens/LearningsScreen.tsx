/**
 * LEARNINGS SCREEN — bibliotheek-overzicht (read-only)
 *
 * Toont alle gepubliceerde learnings (documenten, blogs en video's) die
 * admins via de website beheren. Functies:
 *   - Zoekbalk (titel + beschrijving + tags)
 *   - Type-filter (Alle / Document / Blog / Video)
 *   - Favorieten-filter (toggle)
 *   - Favoriet togglen per kaart (harticoon)
 *   - Tap op kaart → LearningDetailScreen
 *
 * Eén fetch op focus; filteren gebeurt client-side op de geladen lijst.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  Image,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { colors, radius, spacing, shadows } from '../constants/theme';
import { useToast } from '../components/Toast';
import {
  getLearnings,
  toggleLearningFavorite,
  learningKindIcon,
  learningKindLabel,
  formatDuration,
} from '../services';
import type { Learning, LearningKind } from '../services';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Learnings'>;

const HEADER_CONTENT_HEIGHT = 42;

type KindFilter = 'all' | LearningKind;

const KIND_FILTERS: { key: KindFilter; label: string }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'blog', label: 'Blog' },
  { key: 'pdf', label: 'Document' },
  { key: 'video', label: 'Video' },
];

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

export function LearningsScreen({ navigation }: Props) {
  const { show } = useToast();

  const [items, setItems] = useState<Learning[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [pinningId, setPinningId] = useState<string | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const list = await getLearnings();
        setItems(list);
      } catch (err: any) {
        show(err.message || 'Kon learnings niet laden.', 'error');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [show]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onToggleFavorite = useCallback(
    async (item: Learning) => {
      if (pinningId === item.id) return;
      setPinningId(item.id);
      /* Optimistic toggle. */
      setItems(prev =>
        prev.map(l =>
          l.id === item.id ? { ...l, is_favorite: !l.is_favorite } : l
        )
      );
      try {
        const isFav = await toggleLearningFavorite(item.id);
        setItems(prev =>
          prev.map(l => (l.id === item.id ? { ...l, is_favorite: isFav } : l))
        );
      } catch (err: any) {
        /* Rollback. */
        setItems(prev =>
          prev.map(l =>
            l.id === item.id ? { ...l, is_favorite: item.is_favorite } : l
          )
        );
        show(err.message || 'Favoriet wijzigen mislukt.', 'error');
      } finally {
        setPinningId(null);
      }
    },
    [pinningId, show]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(l => {
      if (kindFilter !== 'all' && l.kind !== kindFilter) return false;
      if (favoritesOnly && !l.is_favorite) return false;
      if (!q) return true;
      const haystack = [
        l.title,
        l.description ?? '',
        ...(l.tags || []),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [items, query, kindFilter, favoritesOnly]);

  const renderItem = useCallback(
    ({ item }: { item: Learning }) => {
      const duration = formatDuration(item.duration_sec);
      return (
        <Pressable
          onPress={() =>
            navigation.navigate('LearningDetail', {
              id: item.id,
              title: item.title,
            })
          }
          style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          accessibilityLabel={`${item.title} openen`}
        >
          <View style={styles.thumbWrap}>
            {item.thumbnail_url ? (
              <Image
                source={{ uri: item.thumbnail_url }}
                style={styles.thumb}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.thumb, styles.thumbPlaceholder]}>
                <Text style={styles.thumbIcon}>
                  {learningKindIcon(item.kind)}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.cardBody}>
            <View style={styles.kindRow}>
              <View style={styles.kindBadge}>
                <Text style={styles.kindBadgeText}>
                  {learningKindIcon(item.kind)} {learningKindLabel(item.kind)}
                </Text>
              </View>
              {duration ? (
                <Text style={styles.duration}>{duration}</Text>
              ) : null}
            </View>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.title}
            </Text>
            {item.description ? (
              <Text style={styles.cardDesc} numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}
          </View>

          <Pressable
            onPress={() => onToggleFavorite(item)}
            disabled={pinningId === item.id}
            hitSlop={10}
            style={({ pressed }) => [styles.favBtn, pressed && styles.pressed]}
            accessibilityLabel={
              item.is_favorite ? 'Uit favorieten halen' : 'Aan favorieten toevoegen'
            }
          >
            <Feather
              name="heart"
              size={20}
              color={item.is_favorite ? colors.danger : colors.grayLight}
              style={item.is_favorite ? styles.heartFilled : undefined}
            />
          </Pressable>
        </Pressable>
      );
    },
    [navigation, onToggleFavorite, pinningId]
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <ChevronBack onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Learnings</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Zoekbalk */}
      <View style={styles.searchWrap}>
        <Feather name="search" size={16} color={colors.gray} />
        <TextInput
          style={styles.searchInput}
          placeholder="Zoek op titel, beschrijving of tag…"
          placeholderTextColor={colors.gray}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Feather name="x" size={16} color={colors.gray} />
          </Pressable>
        )}
      </View>

      {/* Filters */}
      <View style={styles.filterRow}>
        {KIND_FILTERS.map(f => {
          const active = kindFilter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setKindFilter(f.key)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => setFavoritesOnly(v => !v)}
          style={[styles.chip, favoritesOnly && styles.chipActive]}
          accessibilityLabel="Filter favorieten"
        >
          <Feather
            name="heart"
            size={13}
            color={favoritesOnly ? colors.white : colors.gray}
          />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingBlock}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={l => l.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyBlock}>
              <Feather name="book-open" size={28} color={colors.grayLight} />
              <Text style={styles.emptyText}>
                {items.length === 0
                  ? 'Er zijn nog geen learnings beschikbaar.'
                  : 'Geen learnings gevonden voor deze filter.'}
              </Text>
            </View>
          }
        />
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
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.light,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.dark,
    padding: 0,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.light,
    backgroundColor: colors.white,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray,
  },
  chipTextActive: {
    color: colors.white,
  },
  loadingBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.light,
    ...shadows.sm,
  },
  pressed: {
    opacity: 0.7,
  },
  thumbWrap: {
    marginRight: spacing.md,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: radius.sm,
  },
  thumbPlaceholder: {
    backgroundColor: colors.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbIcon: {
    fontSize: 28,
  },
  cardBody: {
    flex: 1,
  },
  kindRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  kindBadge: {
    backgroundColor: colors.light,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  kindBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.darkLight,
  },
  duration: {
    fontSize: 11,
    color: colors.gray,
    fontWeight: '600',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.dark,
  },
  cardDesc: {
    fontSize: 12,
    color: colors.gray,
    marginTop: 2,
    lineHeight: 16,
  },
  favBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
  },
  heartFilled: {
    /* Feather heart is een outline; gevuld effect simuleren we met kleur. */
  },
  emptyBlock: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: 14,
    color: colors.gray,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
});
