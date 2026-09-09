/**
 * LEARNINGS SCREEN — bibliotheek-overzicht (read-only)
 *
 * Toont alle gepubliceerde learnings (documenten, blogs en video's) die
 * admins via de website beheren. Functies:
 *   - Zoekbalk (titel + beschrijving + tags)
 *   - Type-filter (Alle / Document / Blog / Video)
 *   - Favorieten-filter (toggle)
 *   - Favoriet togglen per kaart (harticoon)
 *   - Tap op een document (pdf) → eigen PDF.js-viewer (LearningPdfScreen,
 *     met bladwijzer-sync en zonder downloadknop, net als de website)
 *   - Tap op blog/video → LearningDetailScreen
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
import { useUser } from '../context/UserContext';
import {
  leesVoortgang,
  getLearningStatus,
  type LearningStatusKey,
} from '../lib/learningProgress';
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

  const { user } = useUser();
  const [items, setItems] = useState<Learning[]>([]);
  /* Afgerond-status staat lokaal (zie lib/learningProgress.ts). Bij elke
     focus opnieuw lezen, want het detailscherm kan hem gewijzigd hebben. */
  const [voortgang, setVoortgang] = useState<
    Record<string, { completed_at: string }>
  >({});
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
      leesVoortgang(user).then(setVoortgang);
    }, [load, user])
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

  /* Tap op een kaart: documenten (pdf) openen in de eigen PDF.js-viewer
     (met bladwijzer-sync); blog/video gaan naar het detailscherm. */
  const onOpen = useCallback(
    (item: Learning) => {
      if (item.kind === 'pdf') {
        navigation.navigate('LearningPdf', { id: item.id, title: item.title });
      } else {
        navigation.navigate('LearningDetail', { id: item.id, title: item.title });
      }
    },
    [navigation]
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
      const status = getLearningStatus(item, voortgang);
      return (
        <Pressable
          onPress={() => onOpen(item)}
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
              <View style={styles.kindRowSpacer} />
              <View style={[styles.statusBadge, STATUS_STYLE[status.key]]}>
                <Text style={[styles.statusText, STATUS_TEXT[status.key]]}>
                  {status.label}
                </Text>
              </View>
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
    [onOpen, onToggleFavorite, pinningId, voortgang]
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
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
          data={filtered}
          keyExtractor={l => l.id}
          renderItem={renderItem}
          ListHeaderComponent={
            items.length > 0 ? (
              <LeertrajectKop
                items={items}
                voortgang={voortgang}
                onGaVerder={onOpen}
              />
            ) : null
          }
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

/* ----------------------------------------
   MIJN LEERTRAJECT
   Eén regel boven de lijst: hoeveel afgerond, hoeveel bezig, en waar je
   verder kunt. "Ga verder met" kiest de recentste bladwijzer — dezelfde
   keuze als `renderLearningPath()` op de website.
---------------------------------------- */
function LeertrajectKop({
  items,
  voortgang,
  onGaVerder,
}: {
  items: Learning[];
  voortgang: Record<string, { completed_at: string }>;
  onGaVerder: (l: Learning) => void;
}) {
  const statussen = items.map(item => ({
    item,
    status: getLearningStatus(item, voortgang),
  }));
  const afgerond = statussen.filter(e => e.status.key === 'completed').length;
  const bezig = statussen
    .filter(e => e.status.key === 'active')
    .sort(
      (a, b) =>
        new Date(b.item.bookmark?.updated_at || 0).getTime() -
        new Date(a.item.bookmark?.updated_at || 0).getTime()
    );
  const verder = bezig[0]?.item || null;

  return (
    <View style={styles.pad}>
      <View style={styles.padHead}>
        <Text style={styles.padTitle}>Mijn leertraject</Text>
        <Text style={styles.padSummary}>
          <Text style={styles.padSummaryNum}>{afgerond}</Text> afgerond ·{' '}
          <Text style={styles.padSummaryNum}>{bezig.length}</Text> bezig
        </Text>
      </View>

      {verder ? (
        <Pressable
          onPress={() => onGaVerder(verder)}
          style={({ pressed }) => [styles.padVerder, pressed && styles.pressed]}
        >
          <View style={styles.padVerderBody}>
            <Text style={styles.padVerderLabel}>Ga verder met</Text>
            <Text style={styles.padVerderTitel} numberOfLines={1}>
              {verder.title}
            </Text>
          </View>
          <Text style={styles.padVerderPijl}>→</Text>
        </Pressable>
      ) : (
        <Text style={styles.padLeeg}>
          Je leertraject begint zodra je ergens bewust verder leest of kijkt.
        </Text>
      )}
    </View>
  );
}

/* Statuskleuren per sleutel — nieuw is neutraal, bezig terracotta (je bent
   er mee bezig), afgerond merkgroen. */
const STATUS_STYLE: Record<LearningStatusKey, { backgroundColor: string }> = {
  new: { backgroundColor: colors.light },
  active: { backgroundColor: 'rgba(201, 137, 102, 0.16)' },
  completed: { backgroundColor: 'rgba(79, 125, 108, 0.16)' },
};

const STATUS_TEXT: Record<LearningStatusKey, { color: string }> = {
  new: { color: colors.gray },
  active: { color: colors.primaryDark },
  completed: { color: colors.greenText },
};

const styles = StyleSheet.create({
  /* Mijn leertraject */
  pad: {
    backgroundColor: 'rgba(79, 125, 108, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(79, 125, 108, 0.14)',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  padHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  padTitle: { fontSize: 15, fontWeight: '700', color: colors.greenText },
  padSummary: { fontSize: 12, color: colors.darkLight },
  padSummaryNum: { fontWeight: '700', color: colors.greenText },
  padVerder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
  },
  padVerderBody: { flex: 1 },
  padVerderLabel: { fontSize: 10, color: colors.gray, textTransform: 'uppercase', letterSpacing: 0.5 },
  padVerderTitel: { fontSize: 14, fontWeight: '700', color: colors.dark },
  padVerderPijl: { fontSize: 17, color: colors.greenText },
  padLeeg: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 18,
    color: colors.darkLight,
  },

  /* Statusbadge op de kaart */
  kindRowSpacer: { flex: 1 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  statusText: { fontSize: 10, fontWeight: '700' },

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
