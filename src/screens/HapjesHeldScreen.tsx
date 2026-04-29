/**
 * HAPJESHELD SCREEN
 *
 * Chat interface voor HapjesHeld 2.0. Praat met de bestaande Vercel
 * RAG backend via services/hapjesheld.ts.
 *
 * Features:
 *   - Bericht-lijst met user (sage) en assistant (lichtgrijs) bubbles
 *   - Input + verstuur knop
 *   - 📷 Foto-knop (galerij of camera) — automatische compressie < 3 MB
 *   - Loading spinner terwijl antwoord geladen wordt
 *   - Conversation ID wordt onthouden binnen 1 sessie
 *   - Foout-afhandeling als chat-bubbel
 *   - Dagelijkse foto-limit (50/user) server-side afgedwongen
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActionSheetIOS,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useHeaderHeight } from '@react-navigation/elements';
import { colors, radius, spacing, shadows } from '../constants/theme';
import {
  sendChatMessage,
  getConversation,
  getProfile,
  type MonthlyUsage,
  type DailyImageUsage,
} from '../services/hapjesheld';
import {
  pickImageFromCamera,
  pickImageFromGallery,
  type PickedImage,
} from '../services/hapjesheld-image';
import type { HapjesHeldStackParamList } from '../navigation/types';
import { useToast } from '../components/Toast';

type Role = 'user' | 'assistant';

interface Message {
  id: string;
  role: Role;
  text: string;
  imageUri?: string;
}

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/* ----------------------------------------
   USAGE BAR
   Compacte maandbarometer bovenaan de chat.
   Toont percentage van AI-budget verbruikt deze maand,
   met kleur-feedback bij 70%+ (warn) en 100% (danger).
---------------------------------------- */
function UsageBar({ usage }: { usage: MonthlyUsage }) {
  const pct = Math.max(0, Math.min(100, Math.round(usage.percent || 0)));
  const reached = pct >= 100;
  const warning = pct >= 70 && !reached;
  const fillColor = reached
    ? colors.danger
    : warning
      ? '#e08e3f' /* terracotta-warning */
      : colors.primary;
  return (
    <View style={usageBarStyles.wrap}>
      <View style={usageBarStyles.header}>
        <Text style={usageBarStyles.label}>AI-gebruik deze maand</Text>
        <Text style={usageBarStyles.pct}>{pct}%</Text>
      </View>
      <View style={usageBarStyles.track}>
        <View
          style={[
            usageBarStyles.fill,
            { width: `${pct}%`, backgroundColor: fillColor },
          ]}
        />
      </View>
      {reached ? (
        <Text style={usageBarStyles.notice}>
          Maandlimiet bereikt — vanaf de 1e van volgende maand kan je weer
          vragen stellen.
        </Text>
      ) : warning ? (
        <Text style={usageBarStyles.noticeWarn}>
          Je nadert de maandlimiet — gebruik je vragen bewust.
        </Text>
      ) : null}
    </View>
  );
}

const usageBarStyles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  label: { fontSize: 12, color: colors.gray, fontWeight: '600' },
  pct: { fontSize: 12, color: colors.gray, fontWeight: '700' },
  track: {
    height: 6,
    backgroundColor: colors.light,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 3 },
  notice: {
    fontSize: 11,
    color: colors.danger,
    marginTop: 4,
    fontWeight: '600',
  },
  noticeWarn: {
    fontSize: 11,
    color: '#a06420',
    marginTop: 4,
  },
});

type Props = NativeStackScreenProps<HapjesHeldStackParamList, 'Chat'>;

export function HapjesHeldScreen({ route }: Props) {
  const initialConversationId = route.params?.conversationId ?? null;
  const headerHeight = useHeaderHeight();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(
    initialConversationId
  );
  const [pendingImage, setPendingImage] = useState<PickedImage | null>(null);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(
    !!initialConversationId
  );
  const [usage, setUsage] = useState<MonthlyUsage | null>(null);
  const [imageUsage, setImageUsage] = useState<DailyImageUsage | null>(null);
  const listRef = useRef<FlatList<Message>>(null);
  const { show: showToast } = useToast();

  /* Quota state — afgeleid van usage voor disable-logica */
  const monthlyReached = !!usage && usage.percent >= 100;
  const noImagesLeft = !!imageUsage && imageUsage.remaining <= 0;

  /* Haal usage op bij mount, zodat barometer + image-counter
     direct juist staan zonder eerst een vraag te moeten sturen. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const profile = await getProfile();
        if (cancelled) return;
        if (profile.usage) setUsage(profile.usage);
        if (profile.imageUsage) setImageUsage(profile.imageUsage);
      } catch {
        // Stille fallback: zonder usage tonen we gewoon niets
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* Laad oude berichten als we met een bestaande conversatie starten */
  useEffect(() => {
    if (!initialConversationId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await getConversation(initialConversationId);
        if (cancelled) return;
        const loaded: Message[] = data.messages
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m) => ({
            id: m.id,
            role: m.role as Role,
            text: m.content,
          }));
        setMessages(loaded);
      } catch (e: any) {
        if (cancelled) return;
        setMessages([
          {
            id: uid(),
            role: 'assistant',
            text: `⚠️ ${e?.message || 'Kon dit gesprek niet laden.'}`,
          },
        ]);
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialConversationId]);

  const scrollToEnd = useCallback(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  }, []);

  /* ---- Foto kiezen ---- */
  const handlePickImage = () => {
    const runGallery = async () => {
      try {
        const img = await pickImageFromGallery();
        if (img) setPendingImage(img);
      } catch (e: any) {
        Alert.alert('Foto', e?.message || 'Kon foto niet laden.');
      }
    };
    const runCamera = async () => {
      try {
        const img = await pickImageFromCamera();
        if (img) setPendingImage(img);
      } catch (e: any) {
        Alert.alert('Foto', e?.message || 'Kon foto niet laden.');
      }
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Annuleer', 'Galerij', 'Camera'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) runGallery();
          if (buttonIndex === 2) runCamera();
        }
      );
    } else if (Platform.OS === 'web') {
      // Web: meteen naar galerij, geen camera in browser
      runGallery();
    } else {
      Alert.alert('Foto toevoegen', 'Kies een bron', [
        { text: 'Annuleer', style: 'cancel' },
        { text: 'Galerij', onPress: runGallery },
        { text: 'Camera', onPress: runCamera },
      ]);
    }
  };

  /* ---- Verstuur bericht ---- */
  const handleSend = async () => {
    const question = input.trim();
    if (!question && !pendingImage) return;
    if (loading) return;

    const effectiveQuestion =
      question ||
      (pendingImage ? 'Wat kan ik met deze ingrediënten maken?' : '');

    const userMsg: Message = {
      id: uid(),
      role: 'user',
      text: question,
      imageUri: pendingImage?.uri,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    const imgToSend = pendingImage;
    setPendingImage(null);
    setLoading(true);
    scrollToEnd();

    try {
      const res = await sendChatMessage({
        question: effectiveQuestion,
        conversation_id: conversationId,
        image_b64: imgToSend?.base64,
        image_mime: imgToSend?.mime,
      });

      if (!conversationId && res.conversation_id) {
        setConversationId(res.conversation_id);
      }

      const asstMsg: Message = {
        id: res.assistant_message_id || uid(),
        role: 'assistant',
        text: res.answer,
      };
      setMessages((prev) => [...prev, asstMsg]);
      scrollToEnd();

      /* Update barometer + image-counter live na elke succesvolle chat */
      if (res.usage) setUsage(res.usage);
      if (res.imageUsage) setImageUsage(res.imageUsage);
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      const msg =
        err instanceof Error
          ? err.message
          : 'Er ging iets mis. Probeer het later opnieuw.';

      if (status === 429) {
        /* Rate-limit / quota / image-limit bereikt: toast i.p.v. chat-bubble.
           De server-message is al netjes Nederlands ("Te veel vragen binnen
           een uur (max 50)..."). Refresh ook de UI-tellers zodat de barometer
           accuraat is na de blokkade. */
        showToast(msg, 'error');
        try {
          const profile = await getProfile();
          if (profile.usage) setUsage(profile.usage);
          if (profile.imageUsage) setImageUsage(profile.imageUsage);
        } catch {
          /* niet kritisch */
        }
      } else {
        const errorMsg: Message = {
          id: uid(),
          role: 'assistant',
          text: `⚠️ ${msg}`,
        };
        setMessages((prev) => [...prev, errorMsg]);
        scrollToEnd();
      }
    } finally {
      setLoading(false);
    }
  };

  /* ---- Render helpers ---- */
  const renderItem = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    return (
      <View
        style={[
          styles.bubble,
          isUser ? styles.userBubble : styles.assistantBubble,
        ]}
      >
        {item.imageUri ? (
          <Image
            source={{ uri: item.imageUri }}
            style={styles.bubbleImage}
            resizeMode="cover"
          />
        ) : null}
        {item.text ? (
          <Text
            style={[
              styles.bubbleText,
              isUser ? styles.userText : styles.assistantText,
            ]}
          >
            {item.text}
          </Text>
        ) : null}
      </View>
    );
  };

  const isEmpty = messages.length === 0 && !loading && !loadingHistory;
  const canSend =
    (!!input.trim() || !!pendingImage) && !loading && !monthlyReached;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
      >
        {/* Maandelijkse AI-budget barometer */}
        {usage ? <UsageBar usage={usage} /> : null}

        {loadingHistory ? (
          <View style={styles.empty}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : isEmpty ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Hallo, ik ben HapjesHeld</Text>
            <Text style={styles.emptySubtitle}>
              Stel me gerust een vraag over kindervoeding. Bijvoorbeeld over
              allergenen, eetgedrag of recepten voor jouw kindje. Je kan ook
              een foto toevoegen van ingrediënten of een etiket.
            </Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            onContentSizeChange={scrollToEnd}
            ListFooterComponent={
              loading ? (
                <View style={[styles.bubble, styles.assistantBubble]}>
                  <ActivityIndicator size="small" color={colors.secondaryDark} />
                </View>
              ) : null
            }
          />
        )}

        {/* Foto preview (als er één geselecteerd is) */}
        {pendingImage ? (
          <View style={styles.previewRow}>
            <Image
              source={{ uri: pendingImage.uri }}
              style={styles.previewImage}
              resizeMode="cover"
            />
            <View style={styles.previewInfo}>
              <Text style={styles.previewText}>Foto geselecteerd</Text>
              <Text style={styles.previewSubtext}>
                {(pendingImage.bytes / 1024 / 1024).toFixed(1)} MB
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setPendingImage(null)}
              style={styles.previewRemove}
              hitSlop={8}
            >
              <Text style={styles.previewRemoveText}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Input bar */}
        <View style={styles.inputRow}>
          <View style={styles.photoButtonWrap}>
            <TouchableOpacity
              style={[
                styles.photoButton,
                noImagesLeft && styles.photoButtonDisabled,
              ]}
              onPress={() => {
                if (noImagesLeft) {
                  showToast(
                    `Je hebt vandaag al ${imageUsage?.limit ?? 50} foto-vragen gesteld. Morgen kan je weer.`,
                    'info'
                  );
                  return;
                }
                handlePickImage();
              }}
              disabled={loading}
              hitSlop={8}
            >
              <Text style={styles.photoIcon}>📷</Text>
            </TouchableOpacity>
            {imageUsage ? (
              <Text
                style={[
                  styles.photoCounter,
                  noImagesLeft && styles.photoCounterDanger,
                ]}
                numberOfLines={1}
              >
                {imageUsage.remaining}/{imageUsage.limit}
              </Text>
            ) : null}
          </View>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={
              monthlyReached
                ? 'Maandlimiet bereikt — terug op de 1e van volgende maand'
                : 'Stel je vraag...'
            }
            placeholderTextColor={colors.gray}
            multiline
            editable={!loading && !monthlyReached}
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!canSend}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.sendText}>→</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: { flex: 1 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.dark,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: 15,
    color: colors.gray,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
  },
  list: {
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  bubble: {
    maxWidth: '85%',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.secondary,
    borderBottomRightRadius: radius.sm,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.light,
    borderBottomLeftRadius: radius.sm,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userText: { color: colors.white },
  assistantText: { color: colors.dark },
  bubbleImage: {
    width: 200,
    height: 200,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  /* Foto preview rij boven input */
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.light,
  },
  previewImage: {
    width: 52,
    height: 52,
    borderRadius: radius.sm,
    marginRight: spacing.md,
  },
  previewInfo: { flex: 1 },
  previewText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.dark,
  },
  previewSubtext: {
    fontSize: 12,
    color: colors.gray,
    marginTop: 2,
  },
  previewRemove: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewRemoveText: {
    fontSize: 14,
    color: colors.dark,
    fontWeight: '700',
    lineHeight: 16,
  },
  /* Input bar */
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.light,
    backgroundColor: colors.white,
  },
  photoButtonWrap: {
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  photoButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoButtonDisabled: {
    opacity: 0.4,
  },
  photoIcon: {
    fontSize: 22,
  },
  photoCounter: {
    fontSize: 10,
    color: colors.gray,
    marginTop: 2,
    fontWeight: '600',
  },
  photoCounterDanger: {
    color: colors.danger,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    fontSize: 15,
    color: colors.dark,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  sendButtonDisabled: {
    backgroundColor: colors.grayLight,
  },
  sendText: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.white,
    marginTop: -2,
  },
});
