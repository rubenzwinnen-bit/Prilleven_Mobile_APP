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
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, radius, spacing, shadows } from '../constants/theme';
import { useToast } from '../components/Toast';
import { useUser } from '../context/UserContext';
import { useNotifications } from '../context/NotificationContext';
import {
  getRoom,
  relTime,
  followRoom,
  unfollowRoom,
  markRoomRead,
  getIsAdmin,
  pinTopic,
  updateRoom,
  ADMIN_INTRO_MAX,
} from '../services';
import type { AdminIntro, ChatTopic } from '../services';
import type { ChatRoomsStackParamList } from '../navigation/types';

/* Topics sorteren zoals de server: gepind eerst, dan nieuwste activiteit. */
function sortTopics(a: ChatTopic, b: ChatTopic): number {
  if (!!a.is_pinned !== !!b.is_pinned) return a.is_pinned ? -1 : 1;
  const ta = new Date(a.last_reply_at || a.created_at).getTime();
  const tb = new Date(b.last_reply_at || b.created_at).getTime();
  return tb - ta;
}

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
      <View style={styles.introAuthor}>
        <Avatar
          nickname={intro.nickname}
          avatarUrl={intro.avatar_url}
          size={36}
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
          <Text style={styles.introMeta}>
            Welkom · {relTime(intro.updated_at)}
          </Text>
        </View>
      </View>
      <Text style={styles.introBody}>{intro.message}</Text>
    </View>
  );
}

/* Welkomsbericht-sectie: read-only kaart voor iedereen, met admin-controls
   (bewerken/verwijderen/aanmaken) en een inline editor wanneer admin. */
function IntroSection({
  intro,
  isAdmin,
  editing,
  draft,
  saving,
  onDraftChange,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDelete,
}: {
  intro: AdminIntro | null;
  isAdmin: boolean;
  editing: boolean;
  draft: string;
  saving: boolean;
  onDraftChange: (v: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  /* Admin in editor-modus: TextInput + opslaan/annuleren. */
  if (isAdmin && editing) {
    return (
      <View style={styles.introEditor}>
        <Text style={styles.introEditorLabel}>Welkomsbericht</Text>
        <TextInput
          style={styles.introInput}
          value={draft}
          onChangeText={onDraftChange}
          placeholder="Schrijf een welkomsbericht voor deze chatruimte…"
          placeholderTextColor={colors.gray}
          multiline
          maxLength={ADMIN_INTRO_MAX}
          editable={!saving}
        />
        <Text style={styles.introCounter}>
          {draft.length}/{ADMIN_INTRO_MAX}
        </Text>
        <View style={styles.introEditorActions}>
          <Pressable
            onPress={onCancelEdit}
            disabled={saving}
            style={({ pressed }) => [
              styles.introBtn,
              styles.introBtnGhost,
              pressed ? styles.cardPressed : null,
            ]}
          >
            <Text style={styles.introBtnGhostText}>Annuleren</Text>
          </Pressable>
          <Pressable
            onPress={onSave}
            disabled={saving}
            style={({ pressed }) => [
              styles.introBtn,
              styles.introBtnPrimary,
              pressed ? styles.cardPressed : null,
            ]}
          >
            <Text style={styles.introBtnPrimaryText}>
              {saving ? 'Opslaan…' : 'Opslaan'}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  /* Bestaand bericht: kaart + (admin) bewerk/verwijder-knoppen. */
  if (intro) {
    return (
      <View>
        <AdminIntroCard intro={intro} />
        {isAdmin ? (
          <View style={styles.introAdminBar}>
            <Pressable
              onPress={onStartEdit}
              style={({ pressed }) => [
                styles.introLinkBtn,
                pressed ? styles.cardPressed : null,
              ]}
            >
              <Feather name="edit-2" size={14} color={colors.primary} />
              <Text style={styles.introLinkText}>Bewerken</Text>
            </Pressable>
            <Pressable
              onPress={onDelete}
              style={({ pressed }) => [
                styles.introLinkBtn,
                pressed ? styles.cardPressed : null,
              ]}
            >
              <Feather name="trash-2" size={14} color={colors.danger} />
              <Text style={[styles.introLinkText, { color: colors.danger }]}>
                Verwijderen
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  }

  /* Geen bericht + admin: aanmaken-CTA. */
  if (isAdmin) {
    return (
      <Pressable
        onPress={onStartEdit}
        style={({ pressed }) => [
          styles.introAddBtn,
          pressed ? styles.cardPressed : null,
        ]}
      >
        <Feather name="plus" size={16} color={colors.primary} />
        <Text style={styles.introAddText}>Welkomsbericht toevoegen</Text>
      </Pressable>
    );
  }

  return null;
}

export function ChatRoomScreen({ navigation, route }: Props) {
  const { slug, title } = route.params;
  const { show } = useToast();
  const { user } = useUser();
  const { chatroomTopicCounts, refresh } = useNotifications();

  const [intro, setIntro] = useState<AdminIntro | null>(null);
  const [topics, setTopics] = useState<ChatTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isFollowed, setIsFollowed] = useState(false);
  const [following, setFollowing] = useState(false);

  const [isAdmin, setIsAdmin] = useState(false);
  const [pinningId, setPinningId] = useState<string | null>(null);
  const [editingIntro, setEditingIntro] = useState(false);
  const [introDraft, setIntroDraft] = useState('');
  const [savingIntro, setSavingIntro] = useState(false);

  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      try {
        const { room, topics: list } = await getRoom(slug);
        setIntro(room.admin_intro ?? null);
        setTopics(list);
        setIsFollowed(room.is_followed ?? false);
        /* Gevolgde room geopend → last_read_at bijwerken zodat de
           ongelezen-badge op de roomlijst reset (mirror website). */
        if (room.is_followed) markRoomRead(slug);
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
      /* Tellers hertellen bij focus zodat de per-topic badges meteen kloppen.
         We wissen hier NIET alles: een topic-badge wist pas wanneer je dat
         topic effectief opent (markTopicSeen in ChatTopicScreen). */
      refresh();
    }, [load, refresh])
  );

  useEffect(() => {
    getIsAdmin(user).then(setIsAdmin);
  }, [user]);

  /* Admin: topic vastpinnen/losmaken — optimistisch + her-sorteren. */
  const onTogglePin = useCallback(
    async (topicId: string, current: boolean) => {
      if (pinningId) return;
      setPinningId(topicId);
      try {
        const { is_pinned } = await pinTopic(topicId, !current);
        setTopics((prev) =>
          prev
            .map((t) => (t.id === topicId ? { ...t, is_pinned } : t))
            .sort(sortTopics)
        );
        show(is_pinned ? 'Topic vastgepind.' : 'Topic losgemaakt.', 'success');
      } catch (err: any) {
        show(err.message || 'Vastpinnen mislukt.', 'error');
      } finally {
        setPinningId(null);
      }
    },
    [pinningId, show]
  );

  /* Admin: welkomsbericht bewerken/aanmaken. */
  const startEditIntro = useCallback(() => {
    setIntroDraft(intro?.message ?? '');
    setEditingIntro(true);
  }, [intro]);

  const cancelEditIntro = useCallback(() => {
    setEditingIntro(false);
    setIntroDraft('');
  }, []);

  const saveIntro = useCallback(async () => {
    const msg = introDraft.trim();
    if (!msg) {
      show('Welkomsbericht mag niet leeg zijn.', 'error');
      return;
    }
    setSavingIntro(true);
    try {
      const room = await updateRoom(slug, { admin_intro_message: msg });
      setIntro(room.admin_intro ?? null);
      setEditingIntro(false);
      setIntroDraft('');
      show('Welkomsbericht opgeslagen.', 'success');
    } catch (err: any) {
      show(err.message || 'Opslaan mislukt.', 'error');
    } finally {
      setSavingIntro(false);
    }
  }, [introDraft, slug, show]);

  const deleteIntro = useCallback(() => {
    Alert.alert(
      'Welkomsbericht verwijderen',
      'Weet je zeker dat je het welkomsbericht van deze chatruimte wilt verwijderen?',
      [
        { text: 'Annuleren', style: 'cancel' },
        {
          text: 'Verwijderen',
          style: 'destructive',
          onPress: async () => {
            try {
              const room = await updateRoom(slug, { admin_intro_message: null });
              setIntro(room.admin_intro ?? null);
              setEditingIntro(false);
              setIntroDraft('');
              show('Welkomsbericht verwijderd.', 'info');
            } catch (err: any) {
              show(err.message || 'Verwijderen mislukt.', 'error');
            }
          },
        },
      ]
    );
  }, [slug, show]);

  /* Volgen/ontvolgen — optimistisch, met rollback bij fout. */
  const toggleFollow = useCallback(async () => {
    if (following) return;
    const next = !isFollowed;
    setIsFollowed(next);
    setFollowing(true);
    try {
      if (next) {
        await followRoom(slug);
        await markRoomRead(slug);
        show('Je volgt deze chatruimte nu.', 'success');
      } else {
        await unfollowRoom(slug);
        show('Je volgt deze chatruimte niet meer.', 'info');
      }
    } catch (err: any) {
      setIsFollowed(!next);
      show(err.message || 'Volgen mislukt.', 'error');
    } finally {
      setFollowing(false);
    }
  }, [following, isFollowed, slug, show]);

  /* Volg-knop rechts in de header. */
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={toggleFollow}
          disabled={following}
          style={({ pressed }) => [
            styles.followBtn,
            isFollowed ? styles.followBtnActive : null,
            pressed ? styles.followBtnPressed : null,
          ]}
        >
          <Feather
            name={isFollowed ? 'check' : 'plus'}
            size={14}
            color={isFollowed ? colors.white : colors.primary}
          />
          <Text
            style={[
              styles.followBtnText,
              isFollowed ? styles.followBtnTextActive : null,
            ]}
          >
            {isFollowed ? 'Gevolgd' : 'Volg'}
          </Text>
        </Pressable>
      ),
    });
  }, [navigation, isFollowed, following, toggleFollow]);

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
            <IntroSection
              intro={intro}
              isAdmin={isAdmin}
              editing={editingIntro}
              draft={introDraft}
              saving={savingIntro}
              onDraftChange={setIntroDraft}
              onStartEdit={startEditIntro}
              onCancelEdit={cancelEditIntro}
              onSave={saveIntro}
              onDelete={deleteIntro}
            />
          }
          renderItem={({ item }) => {
            const topicCount = chatroomTopicCounts[item.id] ?? 0;
            return (
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
              {topicCount > 0 ? (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>
                    {topicCount > 99 ? '99+' : topicCount}
                  </Text>
                </View>
              ) : null}
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
                {isAdmin ? (
                  <Pressable
                    onPress={() => onTogglePin(item.id, !!item.is_pinned)}
                    disabled={pinningId === item.id}
                    hitSlop={8}
                    style={({ pressed }) => [
                      styles.pinBtn,
                      pressed ? styles.cardPressed : null,
                    ]}
                  >
                    <Feather
                      name="bookmark"
                      size={16}
                      color={item.is_pinned ? colors.primaryDark : colors.gray}
                    />
                  </Pressable>
                ) : null}
              </View>
            </Pressable>
            );
          }}
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
  introBody: {
    fontSize: 14,
    color: colors.dark,
    lineHeight: 21,
    marginTop: spacing.md,
  },
  introAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
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
  notifBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  notifBadgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
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
  pinBtn: {
    marginLeft: spacing.sm,
    padding: 4,
  },

  /* Welkomsbericht — admin-controls + editor */
  introAdminBar: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: -spacing.sm,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xs,
  },
  introLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  introLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  introAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    backgroundColor: colors.light,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  introAddText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  introEditor: {
    backgroundColor: colors.light,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  introEditorLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.dark,
    marginBottom: spacing.sm,
  },
  introInput: {
    backgroundColor: colors.white,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.grayLight,
    padding: spacing.md,
    fontSize: 14,
    color: colors.dark,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  introCounter: {
    fontSize: 11,
    color: colors.gray,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  introEditorActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  introBtn: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  introBtnGhost: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.grayLight,
  },
  introBtnGhostText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.gray,
  },
  introBtnPrimary: {
    backgroundColor: colors.primary,
  },
  introBtnPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
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

  /* Volg-knop (header rechts) */
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  followBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  followBtnPressed: {
    opacity: 0.7,
  },
  followBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  followBtnTextActive: {
    color: colors.white,
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
