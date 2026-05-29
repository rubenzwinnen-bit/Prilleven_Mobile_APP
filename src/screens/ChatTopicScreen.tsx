/**
 * CHATRUIMTE — TOPIC + REACTIES
 *
 * Toont de volledige topic-body bovenaan + reactie-lijst. Onderaan een
 * reactie-composer. Eigen topic/reactie kan bewerkt (binnen 15 min) of
 * verwijderd worden; admins kunnen alles verwijderen.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, radius, spacing, shadows } from '../constants/theme';
import { useToast } from '../components/Toast';
import { useUser } from '../context/UserContext';
import {
  getTopic,
  updateReply,
  deleteReply,
  deleteTopic,
  followTopic,
  unfollowTopic,
  markTopicRead,
  pinTopic,
  getIsAdmin,
  getCurrentUserId,
  isWithinEditWindow,
  relTime,
} from '../services';
import type { ChatTopic, ChatReply } from '../services';
/* createReply + REPLY_BODY_MAX rechtstreeks uit de module: hun namen
   botsen met community.ts in de barrel (zie services/index.ts). */
import { createReply, REPLY_BODY_MAX } from '../services/chatRooms';
import type { ChatRoomsStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<ChatRoomsStackParamList, 'ChatTopic'>;

/* Mini-avatar (mirror Timeline). */
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

/* ----------------------------------------
   ReplyRow — eigen inline edit + delete
---------------------------------------- */
function ReplyRow({
  reply,
  currentUserId,
  onUpdated,
  onDeleted,
}: {
  reply: ChatReply;
  currentUserId: string | null;
  onUpdated: (r: ChatReply) => void;
  onDeleted: (id: string) => void;
}) {
  const { show } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(reply.body);
  const [busy, setBusy] = useState(false);

  const isOwner = !!currentUserId && reply.user_id === currentUserId;
  const canEdit = isOwner && isWithinEditWindow(reply.created_at);

  const onSave = useCallback(async () => {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      const updated = await updateReply(reply.id, body);
      onUpdated(updated);
      setEditing(false);
    } catch (err: any) {
      show(err.message || 'Bewerken mislukt.', 'error');
    } finally {
      setBusy(false);
    }
  }, [draft, busy, reply.id, onUpdated, show]);

  const onDelete = useCallback(() => {
    Alert.alert('Reactie verwijderen', 'Weet je het zeker?', [
      { text: 'Annuleren', style: 'cancel' },
      {
        text: 'Verwijderen',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteReply(reply.id);
            onDeleted(reply.id);
          } catch (err: any) {
            show(err.message || 'Verwijderen mislukt.', 'error');
          }
        },
      },
    ]);
  }, [reply.id, onDeleted, show]);

  return (
    <View style={styles.replyRow}>
      <Avatar nickname={reply.nickname} avatarUrl={reply.avatar_url} size={30} />
      <View style={styles.replyBubble}>
        <View style={styles.replyHead}>
          <Text style={styles.replyNick} numberOfLines={1}>
            {reply.nickname || 'Onbekend'}
          </Text>
          {reply.author_is_admin ? (
            <View style={styles.adminBadge}>
              <Text style={styles.adminBadgeText}>Admin</Text>
            </View>
          ) : null}
          <Text style={styles.replyTime}>
            {relTime(reply.created_at)}
            {reply.edited_at ? ' · bewerkt' : ''}
          </Text>
        </View>

        {editing ? (
          <View>
            <TextInput
              style={styles.editInput}
              value={draft}
              onChangeText={setDraft}
              maxLength={REPLY_BODY_MAX}
              multiline
              autoFocus
            />
            <View style={styles.editActions}>
              <Pressable
                onPress={() => {
                  setDraft(reply.body);
                  setEditing(false);
                }}
                hitSlop={8}
              >
                <Text style={styles.editCancel}>Annuleren</Text>
              </Pressable>
              <Pressable
                onPress={onSave}
                disabled={!draft.trim() || busy}
                hitSlop={8}
              >
                <Text
                  style={[
                    styles.editSave,
                    !draft.trim() || busy ? styles.editSaveDisabled : null,
                  ]}
                >
                  Opslaan
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <Text style={styles.replyBody}>{reply.body}</Text>
            {isOwner ? (
              <View style={styles.ownActions}>
                {canEdit ? (
                  <Pressable
                    onPress={() => setEditing(true)}
                    style={styles.ownAction}
                    hitSlop={6}
                  >
                    <Feather name="edit-2" size={13} color={colors.gray} />
                    <Text style={styles.ownActionText}>Bewerken</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={onDelete}
                  style={styles.ownAction}
                  hitSlop={6}
                >
                  <Feather name="trash-2" size={13} color={colors.danger} />
                  <Text style={[styles.ownActionText, { color: colors.danger }]}>
                    Verwijderen
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

/* ----------------------------------------
   TopicHeader — body + eigen edit/delete
---------------------------------------- */
function TopicHeader({
  topic,
  currentUserId,
  isAdmin,
  pinning,
  onEdit,
  onDelete,
  onTogglePin,
}: {
  topic: ChatTopic;
  currentUserId: string | null;
  isAdmin: boolean;
  pinning: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
}) {
  const isOwner = !!currentUserId && topic.user_id === currentUserId;
  const canEdit = isOwner && isWithinEditWindow(topic.created_at);

  return (
    <View style={styles.topicCard}>
      {topic.is_pinned ? (
        <View style={styles.pinRow}>
          <Feather name="bookmark" size={12} color={colors.primaryDark} />
          <Text style={styles.pinText}>Vastgepind</Text>
        </View>
      ) : null}
      <Text style={styles.topicTitle}>{topic.title}</Text>
      <View style={styles.topicHead}>
        <Avatar nickname={topic.nickname} avatarUrl={topic.avatar_url} />
        <View style={styles.topicMeta}>
          <View style={styles.nickRow}>
            <Text style={styles.nick} numberOfLines={1}>
              {topic.nickname || 'Onbekend'}
            </Text>
            {topic.author_is_admin ? (
              <View style={styles.adminBadge}>
                <Text style={styles.adminBadgeText}>Admin</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.time}>
            {relTime(topic.created_at)}
            {topic.edited_at ? ' · bewerkt' : ''}
          </Text>
        </View>
      </View>
      <Text style={styles.topicBody}>{topic.body}</Text>

      {isOwner || isAdmin ? (
        <View style={styles.ownActions}>
          {canEdit ? (
            <Pressable onPress={onEdit} style={styles.ownAction} hitSlop={6}>
              <Feather name="edit-2" size={14} color={colors.gray} />
              <Text style={styles.ownActionText}>Bewerken</Text>
            </Pressable>
          ) : null}
          {isAdmin ? (
            <Pressable
              onPress={onTogglePin}
              disabled={pinning}
              style={styles.ownAction}
              hitSlop={6}
            >
              <Feather
                name="bookmark"
                size={14}
                color={topic.is_pinned ? colors.primaryDark : colors.gray}
              />
              <Text
                style={[
                  styles.ownActionText,
                  topic.is_pinned ? { color: colors.primaryDark } : null,
                ]}
              >
                {topic.is_pinned ? 'Losmaken' : 'Vastpinnen'}
              </Text>
            </Pressable>
          ) : null}
          {isOwner ? (
            <Pressable onPress={onDelete} style={styles.ownAction} hitSlop={6}>
              <Feather name="trash-2" size={14} color={colors.danger} />
              <Text style={[styles.ownActionText, { color: colors.danger }]}>
                Verwijderen
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={styles.repliesDivider}>
        <Text style={styles.repliesLabel}>
          {topic.replies_count}{' '}
          {topic.replies_count === 1 ? 'reactie' : 'reacties'}
        </Text>
      </View>
    </View>
  );
}

/* ----------------------------------------
   ChatTopicScreen
---------------------------------------- */
export function ChatTopicScreen({ navigation, route }: Props) {
  const { topicId } = route.params;
  const { user } = useUser();
  const { show } = useToast();
  /* Werkelijke header-hoogte zodat de composer exact boven het toetsenbord
     uitlijnt (i.p.v. een hardcoded offset). */
  const headerHeight = useHeaderHeight();

  const [topic, setTopic] = useState<ChatTopic | null>(null);
  const [replies, setReplies] = useState<ChatReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [isFollowed, setIsFollowed] = useState(false);
  const [following, setFollowing] = useState(false);
  const [pinning, setPinning] = useState(false);

  const [replyBody, setReplyBody] = useState('');
  const [posting, setPosting] = useState(false);

  const firstLoad = useRef(true);

  const load = useCallback(async () => {
    try {
      const { topic: t, replies: r } = await getTopic(topicId);
      setTopic(t);
      setReplies(r);
      setIsFollowed(t.is_followed ?? false);
      /* Gevolgd topic geopend → last_read_at bijwerken zodat de tijdlijn-
         badge reset (mirror website). */
      if (t.is_followed) markTopicRead(topicId);
    } catch (err: any) {
      show(err.message || 'Topic laden mislukt.', 'error');
    } finally {
      setLoading(false);
    }
  }, [topicId, show]);

  useEffect(() => {
    getCurrentUserId().then(setUserId);
    getIsAdmin(user).then(setIsAdmin);
  }, [user]);

  /* Eerste focus toont spinner; latere focus herlaadt stil (na edit). */
  useFocusEffect(
    useCallback(() => {
      if (firstLoad.current) {
        setLoading(true);
        firstLoad.current = false;
      }
      load();
    }, [load])
  );

  const onSendReply = useCallback(async () => {
    const body = replyBody.trim();
    if (!body || posting) return;
    setPosting(true);
    try {
      const reply = await createReply(topicId, body);
      setReplies((prev) => [...prev, reply]);
      setReplyBody('');
      setTopic((t) =>
        t ? { ...t, replies_count: t.replies_count + 1 } : t
      );
    } catch (err: any) {
      show(err.message || 'Reactie plaatsen mislukt.', 'error');
    } finally {
      setPosting(false);
    }
  }, [replyBody, posting, topicId, show]);

  const onReplyUpdated = useCallback((updated: ChatReply) => {
    setReplies((prev) =>
      prev.map((r) => (r.id === updated.id ? updated : r))
    );
  }, []);

  const onReplyDeleted = useCallback((id: string) => {
    setReplies((prev) => prev.filter((r) => r.id !== id));
    setTopic((t) =>
      t ? { ...t, replies_count: Math.max(0, t.replies_count - 1) } : t
    );
  }, []);

  const onDeleteTopic = useCallback(() => {
    Alert.alert(
      'Topic verwijderen',
      'Het topic en alle reacties worden verwijderd. Doorgaan?',
      [
        { text: 'Annuleren', style: 'cancel' },
        {
          text: 'Verwijderen',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTopic(topicId);
              show('Topic verwijderd.', 'success');
              navigation.goBack();
            } catch (err: any) {
              show(err.message || 'Verwijderen mislukt.', 'error');
            }
          },
        },
      ]
    );
  }, [topicId, navigation, show]);

  const onEditTopic = useCallback(() => {
    if (!topic) return;
    navigation.navigate('ChatTopicForm', {
      slug: '',
      topicId: topic.id,
      initialTitle: topic.title,
      initialBody: topic.body,
    });
  }, [topic, navigation]);

  /* Topic volgen/ontvolgen — optimistisch met rollback. Een gevolgd topic
     verschijnt op de tijdlijn (mirror website). */
  const toggleFollow = useCallback(async () => {
    if (following) return;
    const next = !isFollowed;
    setIsFollowed(next);
    setFollowing(true);
    try {
      if (next) {
        await followTopic(topicId);
        await markTopicRead(topicId);
        show('Je volgt dit topic nu — het verschijnt op je tijdlijn.', 'success');
      } else {
        await unfollowTopic(topicId);
        show('Je volgt dit topic niet meer.', 'info');
      }
    } catch (err: any) {
      setIsFollowed(!next);
      show(err.message || 'Volgen mislukt.', 'error');
    } finally {
      setFollowing(false);
    }
  }, [following, isFollowed, topicId, show]);

  /* Vastpinnen/losmaken (admin) — optimistisch met rollback. */
  const onTogglePin = useCallback(async () => {
    if (!topic || pinning) return;
    const next = !topic.is_pinned;
    setTopic((t) => (t ? { ...t, is_pinned: next } : t));
    setPinning(true);
    try {
      const res = await pinTopic(topicId, next);
      setTopic((t) => (t ? { ...t, is_pinned: res.is_pinned } : t));
      show(res.is_pinned ? 'Topic vastgepind.' : 'Topic losgemaakt.', 'success');
    } catch (err: any) {
      setTopic((t) => (t ? { ...t, is_pinned: !next } : t));
      show(err.message || 'Vastpinnen mislukt.', 'error');
    } finally {
      setPinning(false);
    }
  }, [topic, pinning, topicId, show]);

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

  if (loading || !topic) {
    return (
      <View style={styles.safe}>
        <ActivityIndicator
          color={colors.primary}
          style={{ marginTop: spacing.xxl }}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.safe}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight}
    >
      <FlatList
        data={replies}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <TopicHeader
            topic={topic}
            currentUserId={userId}
            isAdmin={isAdmin}
            pinning={pinning}
            onEdit={onEditTopic}
            onDelete={onDeleteTopic}
            onTogglePin={onTogglePin}
          />
        }
        renderItem={({ item }) => (
          <ReplyRow
            reply={item}
            currentUserId={userId}
            onUpdated={onReplyUpdated}
            onDeleted={onReplyDeleted}
          />
        )}
        ListEmptyComponent={
          <Text style={styles.repliesEmpty}>
            Nog geen reacties — wees de eerste!
          </Text>
        }
      />

      {/* Reply-composer */}
      <View style={styles.composer}>
        <TextInput
          style={styles.replyInput}
          placeholder="Schrijf een reactie…"
          placeholderTextColor={colors.gray}
          value={replyBody}
          onChangeText={setReplyBody}
          maxLength={REPLY_BODY_MAX}
          multiline
        />
        <Pressable
          onPress={onSendReply}
          disabled={!replyBody.trim() || posting}
          style={[
            styles.sendBtn,
            !replyBody.trim() || posting ? styles.sendBtnDisabled : null,
          ]}
          hitSlop={8}
        >
          {posting ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <Feather name="send" size={16} color={colors.white} />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  listContent: {
    padding: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
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

  /* Vastgepind-badge */
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

  /* Topic-card */
  topicCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  topicTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.dark,
    marginBottom: spacing.sm,
  },
  topicHead: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topicMeta: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  nickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  nick: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.dark,
    flexShrink: 1,
  },
  time: {
    fontSize: 12,
    color: colors.gray,
    marginTop: 1,
  },
  topicBody: {
    fontSize: 15,
    color: colors.dark,
    lineHeight: 22,
    marginTop: spacing.md,
  },
  repliesDivider: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.light,
    paddingTop: spacing.sm,
  },
  repliesLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.gray,
  },

  /* Reply */
  replyRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  replyBubble: {
    flex: 1,
    marginLeft: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radius.sm,
    padding: spacing.sm,
    ...shadows.sm,
  },
  replyHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 2,
  },
  replyNick: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.dark,
    flexShrink: 1,
  },
  replyTime: {
    fontSize: 11,
    color: colors.gray,
  },
  replyBody: {
    fontSize: 14,
    color: colors.dark,
    lineHeight: 20,
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
  repliesEmpty: {
    fontSize: 14,
    color: colors.gray,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: spacing.md,
  },

  /* Eigen acties (edit/delete) */
  ownActions: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  ownAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ownActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.gray,
  },

  /* Inline edit */
  editInput: {
    fontSize: 14,
    color: colors.dark,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    padding: spacing.sm,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  editCancel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray,
  },
  editSave: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  editSaveDisabled: {
    opacity: 0.5,
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

  /* Composer */
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.light,
  },
  replyInput: {
    flex: 1,
    fontSize: 14,
    color: colors.dark,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    maxHeight: 120,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
});
