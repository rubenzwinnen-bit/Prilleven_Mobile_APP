/**
 * CHATRUIMTES — ROOMLIJST
 *
 * Eerste scherm van de Chatruimtes-tab. Toont de vaste rooms (server
 * is leidend; bij fout valt het terug op de lokale ROOMS-constant).
 * Tap op een room → ChatRoom (topics).
 *
 * De rode badge per room toont nieuwe ADMIN-activiteit (nieuwe topics +
 * replies) sinds je de chatruimtes voor het laatst opende — dezelfde bron
 * als de footer-badge (NotificationContext.chatroomRoomCounts). Voor admins
 * tellen alle leden + admin mee. Dit staat los van het "volgen" van een room
 * (die status tonen we nog wel als groene stip).
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, shadows } from '../constants/theme';
import { useToast } from '../components/Toast';
import { listRooms, ROOMS } from '../services';
import type { ChatRoom } from '../services';
import { useNotifications } from '../context/NotificationContext';
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
  const { chatroomRoomCounts, refresh } = useNotifications();
  /* Meteen tonen: de vier ruimtes liggen vast in de app. De server vult
     daarna stil aan met beschrijvingen en de volgstatus. Vroeger stond hier
     een spinner tot de server antwoordde — bij een koude start van de
     chatruimtes-function enkele seconden voor een lijst die er al lag. */
  const [rooms, setRooms] = useState<ChatRoom[]>(FALLBACK_ROOMS);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (mode: 'refresh' | 'silent') => {
      if (mode === 'refresh') setRefreshing(true);
      try {
        const list = await listRooms();
        if (list.length) setRooms(list);
      } catch (err: any) {
        /* Stil bij de achtergrondverversing: de lijst staat er al. */
        if (mode === 'refresh') {
          show(err.message || 'Chatruimtes laden mislukt.', 'error');
        }
      } finally {
        setRefreshing(false);
      }
      /* Notificatie-tellers verversen zodat de per-room badges kloppen. */
      refresh();
    },
    [show, refresh]
  );

  useFocusEffect(
    useCallback(() => {
      load('silent');
    }, [load])
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={rooms}
        /* Slug i.p.v. id: de lokale ruimtes hebben de slug als id, die van de
           server een UUID. Op slug blijven de rijen staan bij de wissel. */
        keyExtractor={(r) => r.slug}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <LinearGradient
            colors={['rgba(79, 125, 108, 0.12)', 'rgba(79, 125, 108, 0.035)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <Text style={styles.eyebrow}>Chatruimtes</Text>
            <Text style={styles.heroTitle}>Waarover wil je praten?</Text>
          </LinearGradient>
        }
        renderItem={({ item }) => {
          const count = chatroomRoomCounts[item.id] ?? 0;
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
                size={20}
                color={colors.greenText}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  /* Kop in dezelfde vorm als "Voor wie?" bij de allergenen. */
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
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 31,
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
  cardPressed: {
    opacity: 0.7,
  },
  cardMeta: {
    flex: 1,
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
    backgroundColor: colors.greenText,
  },
});
