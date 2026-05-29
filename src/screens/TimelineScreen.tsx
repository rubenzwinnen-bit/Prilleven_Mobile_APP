/**
 * TIMELINE SCREEN — community-tijdlijn (MVP)
 *
 * Tweede footer-tab op de landing. Toont de community-feed:
 *   - posts lezen (cursor-paginatie via `before`)
 *   - liken (optimistic toggle)
 *   - reacties inline uitklappen (lazy-load) + plaatsen
 *   - tekst-post plaatsen (alleen admins, net als de webversie)
 *
 * Buiten scope (latere iteratie): foto's, polls, reply-likes,
 * edit/delete, rapporteren, notificaties, chatroom-topics in de feed.
 *
 * Signed avatar_url/image_url hebben 1u TTL → bij stale beeld de feed
 * opnieuw laden (pull-to-refresh).
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
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors, radius, spacing, shadows } from '../constants/theme';
import { useUser } from '../context/UserContext';
import { useToast } from '../components/Toast';
import {
  listPosts,
  createPost,
  togglePostLike,
  listReplies,
  createReply,
  editPost,
  deletePost,
  editReply,
  getIsAdmin,
  getCurrentUserId,
  categoryInfo,
  POST_BODY_MAX,
  REPLY_BODY_MAX,
  relTime,
} from '../services';
/* community.deleteReply botst met chatRooms.deleteReply in de barrel. */
import { deleteReply } from '../services/community';
import type { CommunityPost, CommunityReply } from '../services';

const PAGE_SIZE = 20;

/* ----------------------------------------
   Mini-avatar — foto of gekleurde initiaal-bol
---------------------------------------- */
function PostAvatar({
  nickname,
  avatarUrl,
  size = 40,
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
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      {showImage ? (
        <Image
          source={{ uri: avatarUrl as string }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          onError={() => setFailed(true)}
        />
      ) : (
        <Text style={[styles.avatarInitial, { fontSize: size * 0.4 }]}>
          {initial}
        </Text>
      )}
    </View>
  );
}

/* ----------------------------------------
   ReplyRow
---------------------------------------- */
function ReplyRow({
  reply,
  currentUserId,
  onUpdated,
  onDeleted,
}: {
  reply: CommunityReply;
  currentUserId: string | null;
  onUpdated: (reply: CommunityReply) => void;
  onDeleted: (replyId: string) => void;
}) {
  const { show } = useToast();
  const isOwner = !!currentUserId && reply.user_id === currentUserId;

  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(reply.body);
  const [saving, setSaving] = useState(false);

  const onStartEdit = useCallback(() => {
    setEditText(reply.body);
    setEditing(true);
  }, [reply.body]);

  const onSaveEdit = useCallback(async () => {
    const text = editText.trim();
    if (!text || saving) return;
    setSaving(true);
    try {
      const updated = await editReply(reply.id, text);
      onUpdated(updated);
      setEditing(false);
    } catch (err: any) {
      show(err.message || 'Bewerken mislukt.', 'error');
    } finally {
      setSaving(false);
    }
  }, [editText, saving, reply.id, onUpdated, show]);

  const onDelete = useCallback(() => {
    Alert.alert(
      'Reactie verwijderen',
      'Weet je zeker dat je deze reactie wilt verwijderen?',
      [
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
      ]
    );
  }, [reply.id, onDeleted, show]);

  return (
    <View style={styles.replyRow}>
      <PostAvatar
        nickname={reply.nickname}
        avatarUrl={reply.avatar_url}
        size={30}
      />
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
          {isOwner && !editing ? (
            <View style={styles.ownerActions}>
              <Pressable onPress={onStartEdit} hitSlop={8}>
                <Feather name="edit-2" size={13} color={colors.gray} />
              </Pressable>
              <Pressable onPress={onDelete} hitSlop={8}>
                <Feather name="trash-2" size={13} color={colors.gray} />
              </Pressable>
            </View>
          ) : null}
        </View>

        {editing ? (
          <View style={styles.editWrap}>
            <TextInput
              style={styles.editInput}
              value={editText}
              onChangeText={setEditText}
              maxLength={REPLY_BODY_MAX}
              multiline
              autoFocus
            />
            <View style={styles.editBtnRow}>
              <Pressable
                onPress={() => setEditing(false)}
                style={styles.editCancelBtn}
                hitSlop={6}
              >
                <Text style={styles.editCancelText}>Annuleren</Text>
              </Pressable>
              <Pressable
                onPress={onSaveEdit}
                disabled={!editText.trim() || saving}
                style={[
                  styles.editSaveBtn,
                  !editText.trim() || saving ? styles.editSaveBtnDisabled : null,
                ]}
                hitSlop={6}
              >
                {saving ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.editSaveText}>Bewaren</Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : (
          <Text style={styles.replyBody}>{reply.body}</Text>
        )}
      </View>
    </View>
  );
}

/* ----------------------------------------
   PostCard — eigen like- + replies-state
---------------------------------------- */
function PostCard({
  post,
  currentUserId,
  onPostUpdated,
  onPostDeleted,
}: {
  post: CommunityPost;
  currentUserId: string | null;
  onPostUpdated: (post: CommunityPost) => void;
  onPostDeleted: (postId: string) => void;
}) {
  const { show } = useToast();

  const [liked, setLiked] = useState(post.liked_by_me);
  const [likeCount, setLikeCount] = useState(post.likes_count);
  const [liking, setLiking] = useState(false);

  const [repliesOpen, setRepliesOpen] = useState(false);
  const [repliesLoaded, setRepliesLoaded] = useState(false);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [replies, setReplies] = useState<CommunityReply[]>([]);
  const [replyCount, setReplyCount] = useState(post.replies_count);

  const [replyBody, setReplyBody] = useState('');
  const [replyPosting, setReplyPosting] = useState(false);

  const [imageFailed, setImageFailed] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(post.body);
  const [savingEdit, setSavingEdit] = useState(false);

  const isOwner = !!currentUserId && post.user_id === currentUserId;
  const cat = categoryInfo(post.category);

  const onStartEdit = useCallback(() => {
    setEditText(post.body);
    setEditing(true);
  }, [post.body]);

  const onSaveEdit = useCallback(async () => {
    const text = editText.trim();
    if (!text || savingEdit) return;
    setSavingEdit(true);
    try {
      const updated = await editPost(post.id, text);
      onPostUpdated(updated);
      setEditing(false);
    } catch (err: any) {
      show(err.message || 'Bewerken mislukt.', 'error');
    } finally {
      setSavingEdit(false);
    }
  }, [editText, savingEdit, post.id, onPostUpdated, show]);

  const onDelete = useCallback(() => {
    Alert.alert(
      'Bericht verwijderen',
      'Weet je zeker dat je dit bericht wilt verwijderen? Dit kan niet ongedaan worden gemaakt.',
      [
        { text: 'Annuleren', style: 'cancel' },
        {
          text: 'Verwijderen',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePost(post.id);
              onPostDeleted(post.id);
            } catch (err: any) {
              show(err.message || 'Verwijderen mislukt.', 'error');
            }
          },
        },
      ]
    );
  }, [post.id, onPostDeleted, show]);

  const onReplyUpdated = useCallback((updated: CommunityReply) => {
    setReplies((prev) =>
      prev.map((r) => (r.id === updated.id ? updated : r))
    );
  }, []);

  const onReplyDeleted = useCallback((replyId: string) => {
    setReplies((prev) => prev.filter((r) => r.id !== replyId));
    setReplyCount((c) => Math.max(0, c - 1));
  }, []);

  const onToggleLike = useCallback(async () => {
    if (liking) return;
    setLiking(true);
    // optimistic
    const prevLiked = liked;
    const prevCount = likeCount;
    setLiked(!prevLiked);
    setLikeCount(prevCount + (prevLiked ? -1 : 1));
    try {
      const res = await togglePostLike(post.id);
      setLiked(res.liked);
      setLikeCount(res.count);
    } catch (err: any) {
      // rollback
      setLiked(prevLiked);
      setLikeCount(prevCount);
      show(err.message || 'Liken mislukt.', 'error');
    } finally {
      setLiking(false);
    }
  }, [liking, liked, likeCount, post.id, show]);

  const onToggleReplies = useCallback(async () => {
    const next = !repliesOpen;
    setRepliesOpen(next);
    if (next && !repliesLoaded) {
      setRepliesLoading(true);
      try {
        const list = await listReplies(post.id);
        setReplies(list);
        setReplyCount(list.length);
        setRepliesLoaded(true);
      } catch (err: any) {
        show(err.message || 'Reacties laden mislukt.', 'error');
        setRepliesOpen(false);
      } finally {
        setRepliesLoading(false);
      }
    }
  }, [repliesOpen, repliesLoaded, post.id, show]);

  const onSendReply = useCallback(async () => {
    const body = replyBody.trim();
    if (!body || replyPosting) return;
    setReplyPosting(true);
    try {
      const reply = await createReply(post.id, body);
      setReplies((prev) => [...prev, reply]);
      setReplyCount((c) => c + 1);
      setReplyBody('');
    } catch (err: any) {
      show(err.message || 'Reactie plaatsen mislukt.', 'error');
    } finally {
      setReplyPosting(false);
    }
  }, [replyBody, replyPosting, post.id, show]);

  const showImage = !!post.image_url && !imageFailed;

  return (
    <View style={styles.card}>
      {post.is_pinned ? (
        <View style={styles.pinRow}>
          <Feather name="bookmark" size={13} color={colors.primaryDark} />
          <Text style={styles.pinText}>Mededeling</Text>
        </View>
      ) : null}

      {/* Header */}
      <View style={styles.cardHead}>
        <PostAvatar nickname={post.nickname} avatarUrl={post.avatar_url} />
        <View style={styles.headMeta}>
          <View style={styles.nickRow}>
            <Text style={styles.nick} numberOfLines={1}>
              {post.nickname || 'Onbekend'}
            </Text>
            {post.author_is_admin ? (
              <View style={styles.adminBadge}>
                <Text style={styles.adminBadgeText}>Admin</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.time}>
            {relTime(post.created_at)}
            {post.edited_at ? ' · bewerkt' : ''}
          </Text>
        </View>
        {post.category && post.category !== 'algemeen' ? (
          <View style={styles.catChip}>
            <Text style={styles.catChipText}>
              {cat.emoji} {cat.label}
            </Text>
          </View>
        ) : null}
        {isOwner && !editing ? (
          <View style={styles.ownerActions}>
            <Pressable onPress={onStartEdit} hitSlop={8}>
              <Feather name="edit-2" size={16} color={colors.gray} />
            </Pressable>
            <Pressable onPress={onDelete} hitSlop={8}>
              <Feather name="trash-2" size={16} color={colors.gray} />
            </Pressable>
          </View>
        ) : null}
      </View>

      {/* Body / edit-modus */}
      {editing ? (
        <View style={styles.editWrap}>
          <TextInput
            style={styles.editInput}
            value={editText}
            onChangeText={setEditText}
            maxLength={POST_BODY_MAX}
            multiline
            autoFocus
          />
          <View style={styles.editBtnRow}>
            <Pressable
              onPress={() => setEditing(false)}
              style={styles.editCancelBtn}
              hitSlop={6}
            >
              <Text style={styles.editCancelText}>Annuleren</Text>
            </Pressable>
            <Pressable
              onPress={onSaveEdit}
              disabled={!editText.trim() || savingEdit}
              style={[
                styles.editSaveBtn,
                !editText.trim() || savingEdit
                  ? styles.editSaveBtnDisabled
                  : null,
              ]}
              hitSlop={6}
            >
              {savingEdit ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.editSaveText}>Bewaren</Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : post.body ? (
        <Text style={styles.body}>{post.body}</Text>
      ) : null}

      {/* Foto */}
      {showImage ? (
        <Image
          source={{ uri: post.image_url as string }}
          style={styles.postImage}
          resizeMode="cover"
          onError={() => setImageFailed(true)}
        />
      ) : null}

      {/* Acties */}
      <View style={styles.actions}>
        <Pressable
          onPress={onToggleLike}
          style={styles.actionBtn}
          hitSlop={8}
        >
          <Feather
            name="heart"
            size={18}
            color={liked ? colors.danger : colors.gray}
          />
          <Text
            style={[
              styles.actionText,
              liked ? { color: colors.danger } : null,
            ]}
          >
            {likeCount}
          </Text>
        </Pressable>

        <Pressable
          onPress={onToggleReplies}
          style={styles.actionBtn}
          hitSlop={8}
        >
          <Feather name="message-circle" size={18} color={colors.gray} />
          <Text style={styles.actionText}>
            {replyCount} {replyCount === 1 ? 'reactie' : 'reacties'}
          </Text>
        </Pressable>
      </View>

      {/* Replies */}
      {repliesOpen ? (
        <View style={styles.repliesWrap}>
          {repliesLoading ? (
            <ActivityIndicator
              color={colors.primary}
              style={{ marginVertical: spacing.md }}
            />
          ) : replies.length === 0 ? (
            <Text style={styles.repliesEmpty}>
              Nog geen reacties — wees de eerste!
            </Text>
          ) : (
            replies.map((r) => (
              <ReplyRow
                key={r.id}
                reply={r}
                currentUserId={currentUserId}
                onUpdated={onReplyUpdated}
                onDeleted={onReplyDeleted}
              />
            ))
          )}

          {/* Reply-composer */}
          <View style={styles.replyComposer}>
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
              disabled={!replyBody.trim() || replyPosting}
              style={[
                styles.sendBtn,
                !replyBody.trim() || replyPosting
                  ? styles.sendBtnDisabled
                  : null,
              ]}
              hitSlop={8}
            >
              {replyPosting ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Feather name="send" size={16} color={colors.white} />
              )}
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

/* ----------------------------------------
   Admin-composer (ListHeaderComponent)
---------------------------------------- */
function Composer({ onPosted }: { onPosted: (post: CommunityPost) => void }) {
  const { show } = useToast();
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);

  const onSubmit = useCallback(async () => {
    const text = body.trim();
    if (!text || posting) return;
    setPosting(true);
    try {
      const post = await createPost({ body: text });
      onPosted(post);
      setBody('');
      show('Post geplaatst.', 'success');
    } catch (err: any) {
      show(err.message || 'Plaatsen mislukt.', 'error');
    } finally {
      setPosting(false);
    }
  }, [body, posting, onPosted, show]);

  return (
    <View style={styles.composer}>
      <TextInput
        style={styles.composerInput}
        placeholder="Schrijf een bericht voor de community…"
        placeholderTextColor={colors.gray}
        value={body}
        onChangeText={setBody}
        maxLength={POST_BODY_MAX}
        multiline
      />
      <Pressable
        onPress={onSubmit}
        disabled={!body.trim() || posting}
        style={[
          styles.postBtn,
          !body.trim() || posting ? styles.postBtnDisabled : null,
        ]}
      >
        {posting ? (
          <ActivityIndicator color={colors.white} size="small" />
        ) : (
          <Text style={styles.postBtnText}>Plaats</Text>
        )}
      </Pressable>
    </View>
  );
}

/* ----------------------------------------
   TimelineScreen
---------------------------------------- */
export function TimelineScreen() {
  const { user } = useUser();
  const { show } = useToast();

  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  /* Cursor = created_at van de laatste niet-gepinde community-post. */
  const cursorRef = useRef<string | null>(null);

  const computeCursor = useCallback((list: CommunityPost[]) => {
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      if (p.source_type === 'community' && !p.is_pinned) {
        return p.created_at;
      }
    }
    return null;
  }, []);

  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      try {
        const list = await listPosts({ limit: PAGE_SIZE });
        const community = list.filter((p) => p.source_type === 'community');
        setPosts(community);
        cursorRef.current = computeCursor(list);
        setHasMore(list.length >= PAGE_SIZE);
      } catch (err: any) {
        show(err.message || 'Tijdlijn laden mislukt.', 'error');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [computeCursor, show]
  );

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || loading || refreshing) return;
    const before = cursorRef.current;
    if (!before) {
      setHasMore(false);
      return;
    }
    setLoadingMore(true);
    try {
      const list = await listPosts({ limit: PAGE_SIZE, before });
      const community = list.filter((p) => p.source_type === 'community');
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...community.filter((p) => !seen.has(p.id))];
      });
      const nextCursor = computeCursor(list);
      cursorRef.current = nextCursor;
      setHasMore(list.length >= PAGE_SIZE && !!nextCursor);
    } catch (err: any) {
      show(err.message || 'Meer laden mislukt.', 'error');
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, loading, refreshing, computeCursor, show]);

  /* Eerste load + admin-check + eigen user-id (voor edit/delete-rechten). */
  useEffect(() => {
    load('initial');
    getIsAdmin(user).then(setIsAdmin);
    getCurrentUserId().then(setCurrentUserId);
  }, [load, user]);

  /* Verse feed bij elke focus (bv. terugkeer uit andere tab). */
  useFocusEffect(
    useCallback(() => {
      load('refresh');
    }, [load])
  );

  const onPosted = useCallback((post: CommunityPost) => {
    setPosts((prev) => [post, ...prev]);
  }, []);

  const onPostUpdated = useCallback((updated: CommunityPost) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === updated.id ? updated : p))
    );
  }, []);

  const onPostDeleted = useCallback((postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {loading ? (
          <ActivityIndicator
            color={colors.primary}
            style={{ marginTop: spacing.xxl }}
          />
        ) : (
          <FlatList
            data={posts}
            keyExtractor={(p) => p.id}
            renderItem={({ item }) => (
              <PostCard
                post={item}
                currentUserId={currentUserId}
                onPostUpdated={onPostUpdated}
                onPostDeleted={onPostDeleted}
              />
            )}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={
              isAdmin ? <Composer onPosted={onPosted} /> : null
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Feather
                  name="message-square"
                  size={36}
                  color={colors.grayLight}
                />
                <Text style={styles.emptyText}>
                  Nog geen berichten in de tijdlijn.
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
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
            ListFooterComponent={
              loadingMore ? (
                <ActivityIndicator
                  color={colors.primary}
                  style={{ marginVertical: spacing.lg }}
                />
              ) : null
            }
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    paddingBottom: spacing.xxl,
  },

  /* Composer */
  composer: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  composerInput: {
    fontSize: 15,
    color: colors.dark,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  postBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  postBtnDisabled: {
    opacity: 0.5,
  },
  postBtnText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },

  /* Card */
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  pinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.sm,
  },
  pinText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headMeta: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  nickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  nick: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.dark,
    flexShrink: 1,
  },
  time: {
    fontSize: 12,
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
  catChip: {
    backgroundColor: colors.light,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  catChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.darkLight,
  },
  body: {
    fontSize: 15,
    color: colors.dark,
    lineHeight: 22,
    marginTop: spacing.sm,
  },
  postImage: {
    width: '100%',
    height: 220,
    borderRadius: radius.sm,
    marginTop: spacing.sm,
    backgroundColor: colors.light,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.md,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    fontSize: 13,
    color: colors.gray,
    fontWeight: '600',
  },

  /* Eigenaar-acties (bewerken / verwijderen) */
  ownerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginLeft: spacing.sm,
  },

  /* Inline edit-modus (post + reply) */
  editWrap: {
    marginTop: spacing.sm,
  },
  editInput: {
    fontSize: 15,
    color: colors.dark,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  editBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  editCancelBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  editCancelText: {
    fontSize: 14,
    color: colors.gray,
    fontWeight: '600',
  },
  editSaveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  editSaveBtnDisabled: {
    opacity: 0.5,
  },
  editSaveText: {
    fontSize: 14,
    color: colors.white,
    fontWeight: '700',
  },

  /* Replies */
  repliesWrap: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.light,
    paddingTop: spacing.md,
  },
  repliesEmpty: {
    fontSize: 13,
    color: colors.gray,
    fontStyle: 'italic',
    marginBottom: spacing.sm,
  },
  replyRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  replyBubble: {
    flex: 1,
    marginLeft: spacing.sm,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    padding: spacing.sm,
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
  replyComposer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  replyInput: {
    flex: 1,
    fontSize: 14,
    color: colors.dark,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    maxHeight: 100,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
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

  /* Empty */
  empty: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
    gap: spacing.md,
  },
  emptyText: {
    fontSize: 15,
    color: colors.gray,
  },
});
