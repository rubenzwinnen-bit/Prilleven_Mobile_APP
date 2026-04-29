/**
 * CONVERSATIONS SCREEN
 *
 * Lijst van alle HapjesHeld-gesprekken van de ingelogde gebruiker.
 * Gedeeld met de website via dezelfde Supabase database.
 *
 * Acties:
 *   - Tap een gesprek  → open Chat met die conversation_id
 *   - "Nieuw gesprek"  → open Chat zonder id (start vers)
 *   - Swipe (toekomst) → gesprek hernoemen of verwijderen
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, radius, spacing, shadows } from '../constants/theme';
import {
  listConversations,
  deleteConversation,
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

export function ConversationsScreen({ navigation }: Props) {
  const [conversations, setConversations] = useState<ConversationSummary[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const list = await listConversations();
      setConversations(list);
    } catch (e: any) {
      setError(e?.message || 'Kon gesprekken niet laden.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  /* Bij elke navigatie naar deze screen opnieuw laden
     zodat nieuwe gesprekken van de website ook verschijnen. */
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const openNew = () => navigation.navigate('Chat');

  const openConversation = (id: string) =>
    navigation.navigate('Chat', { conversationId: id });

  const confirmDelete = (item: ConversationSummary) => {
    Alert.alert(
      'Gesprek verwijderen?',
      item.title || 'Dit gesprek zal permanent worden verwijderd.',
      [
        { text: 'Annuleer', style: 'cancel' },
        {
          text: 'Verwijder',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteConversation(item.id);
              setConversations((prev) => prev.filter((c) => c.id !== item.id));
            } catch (e: any) {
              Alert.alert('Fout', e?.message || 'Verwijderen mislukt.');
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: ConversationSummary }) => (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      onPress={() => openConversation(item.id)}
      onLongPress={() => confirmDelete(item)}
    >
      <View style={styles.rowContent}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {item.title || 'Nieuw gesprek'}
        </Text>
        <Text style={styles.rowDate}>{formatRelativeDate(item.updated_at)}</Text>
      </View>
      <Text style={styles.rowChevron}>›</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Nieuw gesprek knop */}
      <TouchableOpacity
        style={styles.newButton}
        activeOpacity={0.85}
        onPress={openNew}
      >
        <Text style={styles.newButtonIcon}>＋</Text>
        <Text style={styles.newButtonText}>Nieuw gesprek</Text>
      </TouchableOpacity>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
          <TouchableOpacity onPress={load} style={styles.retryBtn}>
            <Text style={styles.retryText}>Opnieuw proberen</Text>
          </TouchableOpacity>
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Nog geen gesprekken</Text>
          <Text style={styles.emptySubtitle}>
            Start je eerste gesprek met HapjesHeld via de knop hierboven.
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(c) => c.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
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
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    ...shadows.sm,
  },
  newButtonIcon: {
    color: colors.white,
    fontSize: 22,
    fontWeight: '700',
    marginRight: spacing.sm,
    marginTop: -2,
  },
  newButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  rowContent: { flex: 1 },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.dark,
    marginBottom: 2,
  },
  rowDate: {
    fontSize: 12,
    color: colors.gray,
  },
  rowChevron: {
    fontSize: 22,
    color: colors.grayLight,
    marginLeft: spacing.sm,
    fontWeight: '300',
  },
  separator: { height: spacing.sm },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.dark,
    marginBottom: spacing.sm,
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
});
