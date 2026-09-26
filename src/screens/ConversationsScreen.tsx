/**
 * CONVERSATIONS SCREEN
 *
 * Lijst van alle HapjesHeld-gesprekken van de ingelogde gebruiker.
 * Gedeeld met de website via dezelfde Supabase database.
 *
 * Acties:
 *   - Tap een gesprek  → open Chat met die conversation_id
 *   - "Nieuw gesprek"  → open Chat zonder id (start vers)
 *   - Potlood          → eigen titel geven (zelfde titel als op de website)
 *   - "Selecteer" (header) of lang drukken → selectiemodus: gesprekken
 *     aanvinken, "Alles selecteren", en in één keer verwijderen
 *
 * Opbouw in de stijl van de andere vernieuwde schermen: hero-kaart met groen
 * verloop, witte kaarten met zachtgroene rand. Gegroepeerd per periode.
 */

import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  ActivityIndicator,
  RefreshControl,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, spacing, shadows } from '../constants/theme';
import { useToast } from '../components/Toast';
import { RenameModal } from '../components/RenameModal';
import {
  listConversations,
  deleteConversation,
  renameConversation,
  CONVERSATION_TITLE_MAX,
  type ConversationSummary,
} from '../services/hapjesheld';
import type { HapjesHeldStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<HapjesHeldStackParamList, 'Conversations'>;

function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'net';
  if (diffMin < 60) return `${diffMin} min geleden`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} u geleden`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `${diffDays} dag${diffDays > 1 ? 'en' : ''} geleden`;
  // Oudere: toon datum kort
  return d.toLocaleDateString('nl-BE', {
    day: 'numeric',
    month: 'short',
    year:
      d.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
}

/* Groepen zoals in een berichtenapp. De lijst komt van de server al gesorteerd
   op updated_at (nieuwste eerst), dus de volgorde binnen een groep klopt. */
function groupByPeriod(list: ConversationSummary[]) {
  const startVandaag = new Date();
  startVandaag.setHours(0, 0, 0, 0);
  const vandaag = startVandaag.getTime();
  const week = vandaag - 6 * 24 * 60 * 60 * 1000;
  const groepen: { title: string; data: ConversationSummary[] }[] = [
    { title: 'Vandaag', data: [] },
    { title: 'Afgelopen week', data: [] },
    { title: 'Eerder', data: [] },
  ];
  for (const c of list) {
    const t = new Date(c.updated_at).getTime();
    groepen[t >= vandaag ? 0 : t >= week ? 1 : 2].data.push(c);
  }
  return groepen.filter((g) => g.data.length > 0);
}

export function ConversationsScreen({ navigation }: Props) {
  const { show } = useToast();
  const [conversations, setConversations] = useState<ConversationSummary[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /* null = gewone modus; anders de aangevinkte gesprekken. */
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [deleting, setDeleting] = useState(false);
  /* Gesprek waarvan het hernoem-venster openstaat. */
  const [renaming, setRenaming] = useState<ConversationSummary | null>(null);
  const selecting = selected !== null;
  /* Alleen de eerste keer een spinner; daarna stil herladen. */
  const eersteKeerRef = useRef(true);

  const load = useCallback(async () => {
    try {
      setError(null);
      const list = await listConversations();
      setConversations(list);
    } catch (e: any) {
      if (eersteKeerRef.current) {
        setError(e?.message || 'Kon gesprekken niet laden.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      eersteKeerRef.current = false;
    }
  }, []);

  /* Bij elke navigatie naar deze screen opnieuw laden
     zodat nieuwe gesprekken van de website ook verschijnen. */
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  /* Selecteer/Klaar rechts in de stack-header. */
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        conversations.length > 0 ? (
          <Pressable
            onPress={() => setSelected(selecting ? null : new Set())}
            hitSlop={10}
          >
            <Text style={styles.headerAction}>
              {selecting ? 'Klaar' : 'Selecteer'}
            </Text>
          </Pressable>
        ) : null,
    });
  }, [navigation, selecting, conversations.length]);

  const sections = useMemo(() => groupByPeriod(conversations), [conversations]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allSelected =
    selecting && selected.size === conversations.length && conversations.length > 0;

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(conversations.map((c) => c.id)));

  const deleteSelected = () => {
    if (!selected || selected.size === 0) return;
    const ids = [...selected];
    const n = ids.length;
    Alert.alert(
      n === 1 ? 'Gesprek verwijderen?' : `${n} gesprekken verwijderen?`,
      'Dit kan niet ongedaan gemaakt worden, ook niet op de website.',
      [
        { text: 'Annuleer', style: 'cancel' },
        {
          text: 'Verwijder',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            const results = await Promise.allSettled(ids.map(deleteConversation));
            const gelukt = new Set(
              ids.filter((_, i) => results[i].status === 'fulfilled')
            );
            setConversations((prev) => prev.filter((c) => !gelukt.has(c.id)));
            setDeleting(false);
            const mislukt = n - gelukt.size;
            if (mislukt > 0) {
              /* Wat niet lukte blijft aangevinkt, zodat je opnieuw kan proberen. */
              setSelected(new Set(ids.filter((id) => !gelukt.has(id))));
              show(
                mislukt === 1
                  ? 'Eén gesprek kon niet verwijderd worden.'
                  : `${mislukt} gesprekken konden niet verwijderd worden.`,
                'error'
              );
            } else {
              setSelected(null);
              show(n === 1 ? 'Gesprek verwijderd' : `${n} gesprekken verwijderd`);
            }
          },
        },
      ]
    );
  };

  const saveTitle = async (title: string) => {
    if (!renaming) return;
    try {
      const saved = await renameConversation(renaming.id, title);
      setConversations((prev) =>
        prev.map((c) => (c.id === renaming.id ? { ...c, title: saved } : c))
      );
      setRenaming(null);
    } catch (e: any) {
      show(e?.message || 'Titel opslaan mislukt.', 'error');
    }
  };

  const renderItem = ({ item }: { item: ConversationSummary }) => {
    const checked = selecting && selected.has(item.id);
    return (
      <Pressable
        onPress={() =>
          selecting
            ? toggle(item.id)
            : navigation.navigate('Chat', { conversationId: item.id })
        }
        onLongPress={() => {
          if (!selecting) setSelected(new Set([item.id]));
        }}
        style={({ pressed }) => [
          styles.card,
          checked && styles.cardChecked,
          pressed && styles.pressed,
        ]}
        accessibilityRole={selecting ? 'checkbox' : 'button'}
        accessibilityState={selecting ? { checked } : undefined}
      >
        {selecting ? (
          <View style={[styles.check, checked && styles.checkOn]}>
            {checked ? (
              <Feather name="check" size={16} color={colors.white} />
            ) : null}
          </View>
        ) : (
          <View style={styles.icon}>
            <Feather name="message-circle" size={18} color={colors.greenText} />
          </View>
        )}
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {item.title || 'Nieuw gesprek'}
          </Text>
          <Text style={styles.cardDate}>{formatRelativeDate(item.updated_at)}</Text>
        </View>
        {!selecting ? (
          <Pressable
            onPress={() => setRenaming(item)}
            hitSlop={8}
            style={({ pressed }) => [styles.renameBtn, pressed && styles.pressed]}
            accessibilityLabel="Titel wijzigen"
          >
            <Feather name="edit-2" size={16} color={colors.greenText} />
          </Pressable>
        ) : null}
      </Pressable>
    );
  };

  const hero = (
    <LinearGradient
      colors={['rgba(79, 125, 108, 0.12)', 'rgba(79, 125, 108, 0.035)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      <Text style={styles.eyebrow}>HapjesHeld</Text>
      <Text style={styles.heroTitle}>Jouw gesprekken</Text>
      {conversations.length > 0 ? (
        <Text style={styles.heroCount}>
          {conversations.length === 1
            ? '1 gesprek'
            : `${conversations.length} gesprekken`}
        </Text>
      ) : null}
      {!selecting ? (
        <Pressable
          onPress={() => navigation.navigate('Chat')}
          style={({ pressed }) => [styles.newButton, pressed && styles.pressed]}
        >
          <Feather name="plus" size={18} color={colors.white} />
          <Text style={styles.newButtonText}>Nieuw gesprek</Text>
        </Pressable>
      ) : null}
    </LinearGradient>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <RenameModal
        visible={renaming !== null}
        title="Titel van het gesprek"
        initialValue={renaming?.title || ''}
        maxLength={CONVERSATION_TITLE_MAX}
        onSubmit={saveTitle}
        onClose={() => setRenaming(null)}
      />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            onPress={() => {
              setLoading(true);
              eersteKeerRef.current = true;
              load();
            }}
            style={styles.retryBtn}
          >
            <Text style={styles.retryText}>Opnieuw proberen</Text>
          </Pressable>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(c) => c.id}
          renderItem={renderItem}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionTitle}>{section.title}</Text>
          )}
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={hero}
          ListEmptyComponent={
            <View style={styles.emptyBlock}>
              <Feather name="message-circle" size={28} color={colors.grayLight} />
              <Text style={styles.emptyTitle}>Nog geen gesprekken</Text>
              <Text style={styles.emptySubtitle}>
                Start je eerste gesprek met HapjesHeld via de knop hierboven.
              </Text>
            </View>
          }
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        />
      )}

      {/* Actiebalk in selectiemodus */}
      {selecting ? (
        <View style={styles.actionBar}>
          <Pressable onPress={toggleAll} hitSlop={8} style={styles.selectAll}>
            <Text style={styles.selectAllText}>
              {allSelected ? 'Niets selecteren' : 'Alles selecteren'}
            </Text>
          </Pressable>
          <Pressable
            onPress={deleteSelected}
            disabled={selected.size === 0 || deleting}
            style={({ pressed }) => [
              styles.deleteButton,
              (selected.size === 0 || deleting) && styles.deleteDisabled,
              pressed && styles.pressed,
            ]}
          >
            {deleting ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <Feather name="trash-2" size={16} color={colors.white} />
                <Text style={styles.deleteText}>
                  Verwijder{selected.size > 0 ? ` (${selected.size})` : ''}
                </Text>
              </>
            )}
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  headerAction: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.greenText,
  },
  list: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  /* Kop in dezelfde vorm als de kind-picker en de chatruimtes. */
  hero: {
    padding: spacing.lg,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(79, 125, 108, 0.18)',
    marginBottom: spacing.sm,
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
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 31,
  },
  heroCount: {
    marginTop: 2,
    fontSize: 13,
    color: colors.gray,
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    marginTop: spacing.lg,
    paddingVertical: 12,
    borderRadius: radius.md,
    ...shadows.sm,
  },
  newButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.gray,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(79, 125, 108, 0.16)',
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  cardChecked: {
    borderColor: colors.greenText,
    backgroundColor: 'rgba(79, 125, 108, 0.06)',
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(79, 125, 108, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    marginHorizontal: 6,
    borderWidth: 2,
    borderColor: colors.grayLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: {
    backgroundColor: colors.greenText,
    borderColor: colors.greenText,
  },
  cardBody: { flex: 1 },
  renameBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(79, 125, 108, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.dark,
    lineHeight: 20,
  },
  cardDate: {
    fontSize: 12,
    color: colors.gray,
    marginTop: 3,
  },
  pressed: { opacity: 0.65 },
  emptyBlock: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.dark,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.gray,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  retryText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.light,
    backgroundColor: colors.white,
  },
  selectAll: { paddingVertical: spacing.sm },
  selectAllText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.greenText,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 130,
    justifyContent: 'center',
    backgroundColor: colors.danger,
    paddingVertical: 11,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  deleteDisabled: { opacity: 0.4 },
  deleteText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
});
