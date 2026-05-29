/**
 * CHATRUIMTES — ROOMLIJST
 *
 * Eerste scherm van de Chatruimtes-tab. Toont de vaste rooms (server
 * is leidend; bij fout valt het terug op de lokale ROOMS-constant).
 * Tap op een room → ChatRoom (topics).
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, radius, spacing, shadows } from '../constants/theme';
import { useToast } from '../components/Toast';
import { listRooms, getUnread, ROOMS } from '../services';
import type { ChatRoom } from '../services';
import type { ChatRoomsStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<ChatRoomsStackParamList, 'RoomList'>;

/* Fallback-rooms uit de lokale constant zodat de lijst nooit leeg is. */
const FALLBACK_ROOMS: ChatRoom[] = ROOMS.map((r, i) => ({
  id: r.slug,
  slug: r.slug,
  title: r.title,
  description: null,
  sort_order: i,
}));

export function ChatRoomsListScreen({ navigation }: Props) {
  const { show } = useToast();
  const [rooms, setRooms] = useState<ChatRoom[]>(FALLBACK_ROOMS);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const loadedOnce = useRef(false);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' | 'silent') => {
      if (mode === 'refresh') setRefreshing(true);
      else if (mode === 'initial') setLoading(true);
      try {
        const [list, counts] = await Promise.all([listRooms(), getUnread()]);
        if (list.length) setRooms(list);
        setUnread(counts.rooms);
      } catch (err: any) {
        show(err.message || 'Chatruimtes laden mislukt.', 'error');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [show]
  );

  /* Eerste focus toont de centrale spinner; daarna stil herladen zodat
     de pull-to-refresh-cirkel niet blijft hangen bij terugkeer. */
  useFocusEffect(
    useCallback(() => {
      load(loadedOnce.current ? 'silent' : 'initial');
      loadedOnce.current = true;
    }, [load])
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chatruimtes</Text>
        <Text style={styles.headerSub}>
          Praat met andere ouders per thema
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator
          color={colors.primary}
          style={{ marginTop: spacing.xxl }}
        />
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const count = unread[item.id] ?? 0;
            return (
              <Pressable
                style={({ pressed }) => [
                  styles.card,
                  pressed ? styles.cardPressed : null,
                ]}
                onPress={() =>
                  navigation.navigate('ChatRoom', {
                    slug: item.slug,
                    title: item.title,
                  })
                }
              >
                <View style={styles.cardMeta}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {item.description ? (
                    <Text style={styles.cardDesc} numberOfLines={2}>
                      {item.description}
                    </Text>
                  ) : null}
                </View>
                {count > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {count > 99 ? '99+' : count}
                    </Text>
                  </View>
                ) : item.is_followed ? (
                  <View style={styles.followedDot} />
                ) : null}
                <Feather
                  name="chevron-right"
                  size={22}
                  color={colors.grayLight}
                />
              </Pressable>
            );
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load('refresh')}
              tintColor={colors.primary}
            />
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.dark,
  },
  headerSub: {
    fontSize: 14,
    color: colors.gray,
    marginTop: 2,
  },
  listContent: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  cardPressed: {
    opacity: 0.7,
  },
  cardMeta: {
    flex: 1,
    marginRight: spacing.md,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.dark,
  },
  cardDesc: {
    fontSize: 13,
    color: colors.gray,
    marginTop: 2,
    lineHeight: 18,
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginRight: spacing.xs,
  },
  badgeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  followedDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: colors.secondary,
    marginRight: spacing.sm,
  },
});
