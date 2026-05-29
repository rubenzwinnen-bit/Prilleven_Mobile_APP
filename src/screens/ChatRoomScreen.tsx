/**
 * CHATRUIMTE — TOPIC-LIJST
 *
 * Toont één room: optioneel admin-welkomsbericht (read-only) bovenaan,
 * daaronder de topics (gepind eerst). "Nieuw topic" opent het formulier.
 * Tap op een topic → ChatTopic (body + replies).
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, radius, spacing, shadows } from '../constants/theme';
import { useToast } from '../components/Toast';
import { getRoom, relTime } from '../services';
import type { AdminIntro, ChatTopic } from '../services';
import type { ChatRoomsStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<ChatRoomsStackParamList, 'ChatRoom'>;

/* Mini-avatar — foto of gekleurde initiaal-bol (mirror Timeline). */
function Avatar({
  nickname,
  avatarUrl,
  size = 32,
}: {
  nickname: string | null;
  avatarUrl: string | null;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [avatarUrl]);
  const initial = (nickname || '?').trim().charAt(0).toUpperCase() || '?';
  const showImage = !!avatarUrl && !failed;
  return (
    <View
      style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
    >
      {showImage ? (
        <Image
          source={{ uri: avatarUrl as string }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          onError={() => setFailed(true)}
        />
      ) : (
        <Text style={[styles.avatarInitial, { fontSize: size * 0.42 }]}>
          {initial}
        </Text>
      )}
    </View>
  );
}

/* Admin-welkomsbericht (read-only op mobiel). */
function AdminIntroCard({ intro }: { intro: AdminIntro }) {
  return (
    <View style={styles.introCard}>
      <View style={styles.introHead}>
        <Feather name="info" size={15} color={colors.secondaryDark} />
        <Text style={styles.introLabel}>Welkom</Text>
      </View>
      <Text style={styles.introBody}>{intro.message}</Text>
      <View style={styles.introAuthor}>
        <Avatar
          nickname={intro.nickname}
          avatarUrl={intro.avatar_url}
          size={28}
        />
        <View style={styles.introAuthorMeta}>
          <View style={styles.introNickRow}>
            <Text style={styles.introNick} numberOfLines={1}>
              {intro.nickname || 'Team Pril Leven'}
            </Text>
            {intro.author_is_admin ? (
              <View style={styles.adminBadge}>
                <Text style={styles.adminBadgeText}>Admin</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.introMeta}>{relTime(intro.updated_at)}</Text>
        </View>
      </View>
    </View>
  );
}

export function ChatRoomScreen({ navigation, route }: Props) {
  const { slug, title } = route.params;
  const { show } = useToast();

  const [intro, setIntro] = useState<AdminIntro | null>(null);
  const [topics, setTopics] = useState<ChatTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      try {
        const { room, topics: list } = await getRoom(slug);
        setIntro(room.admin_intro ?? null);
        setTopics(list);
      } catch (err: any) {
        show(err.message || 'Topics laden mislukt.', 'error');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [slug, show]
  );

  useFocusEffect(
    useCallback(() => {
      load('refresh');
    }, [load])
  );

  return (
    <View style={styles.safe}>
      {loading ? (
        <ActivityIndicator
          color={colors.primary}
          style={{ marginTop: spacing.xxl }}
        />
      ) : (
        <FlatList
          data={topics}
          keyExtractor={(t) => t.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            intro ? <AdminIntroCard intro={intro} /> : null
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.card,
                pressed ? styles.cardPressed : null,
              ]}
              onPress={() =>
                navigation.navigate('ChatTopic', {
                  topicId: item.id,
                  roomTitle: title,
                })
              }
            >
              {item.is_pinned ? (
                <View style={styles.pinRow}>
                  <Feather
                    name="bookmark"
                    size={12}
                    color={colors.primaryDark}
                  />
                  <Text style={styles.pinText}>Vastgepind</Text>
                </View>
              ) : null}
              <Text style={styles.topicTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.topicSnippet} numberOfLines={2}>
                {item.body}
              </Text>
              <View style={styles.topicFoot}>
                <Avatar nickname={item.nickname} avatarUrl={item.avatar_url} />
                <View style={styles.footMeta}>
                  <View style={styles.footNickRow}>
                    <Text style={styles.footNick} numberOfLines={1}>
                      {item.nickname || 'Onbekend'}
                    </Text>
                    {item.author_is_admin ? (
                      <View style={styles.adminBadge}>
                        <Text style={styles.adminBadgeText}>Admin</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.footTime}>
                    {relTime(item.last_reply_at || item.created_at)}
                  </Text>
                </View>
                <View style={styles.replyCountChip}>
                  <Feather
                    name="message-circle"
                    size={13}
                    color={colors.gray}
                  />
                  <Text style={styles.replyCountText}>
                    {item.replies_count}
                  </Text>
                </View>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="message-square" size={36} color={colors.grayLight} />
              <Text style={styles.emptyText}>
                Nog geen topics — start het eerste gesprek!
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load('refresh')}
              tintColor={colors.primary}
            />
          }
        />
      )}

      {/* Nieuw-topic CTA */}
      <Pressable
        style={styles.fab}
        onPress={() => navigation.navigate('ChatTopicForm', { slug })}
      >
        <Feather name="plus" size={20} color={colors.white} />
        <Text style={styles.fabText}>Nieuw topic</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  listContent: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: 96,
  },

  /* Admin-intro */
  introCard: {
    backgroundColor: colors.light,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  introHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.xs,
  },
  introLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.secondaryDark,
    letterSpacing: 0.3,
  },
  introBody: {
    fontSize: 14,
    color: colors.dark,
    lineHeight: 21,
  },
  introAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  introAuthorMeta: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  introNickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  introNick: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.dark,
    flexShrink: 1,
  },
  introMeta: {
    fontSize: 11,
    color: colors.gray,
    marginTop: 1,
  },

  /* Topic-card */
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  cardPressed: {
    opacity: 0.7,
  },
  pinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.xs,
  },
  pinText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  topicTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.dark,
  },
  topicSnippet: {
    fontSize: 14,
    color: colors.gray,
    lineHeight: 20,
    marginTop: 4,
  },
  topicFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  footMeta: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  footNickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  footNick: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.dark,
    flexShrink: 1,
  },
  footTime: {
    fontSize: 11,
    color: colors.gray,
    marginTop: 1,
  },
  adminBadge: {
    backgroundColor: colors.secondary,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  adminBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.white,
  },
  replyCountChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  replyCountText: {
    fontSize: 13,
    color: colors.gray,
    fontWeight: '600',
  },

  /* Avatar */
  avatar: {
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarInitial: {
    color: colors.white,
    fontWeight: '700',
  },

  /* Empty */
  empty: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
    gap: spacing.md,
  },
  emptyText: {
    fontSize: 15,
    color: colors.gray,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },

  /* FAB */
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...shadows.md,
  },
  fabText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
});
