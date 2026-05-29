/**
 * LEARNING DETAIL SCREEN — viewer (read-only)
 *
 * Toont één learning afhankelijk van het type:
 *   blog  → HTML-artikel gerenderd in een WebView
 *   video → expo-video speler (signed URL, 4 u TTL)
 *   pdf   → knop die het document opent in de in-app browser (signed URL,
 *           10 min TTL). Dit werkt betrouwbaar op iOS én Android, terwijl
 *           een ingebedde WebView op Android geen PDF's rendert.
 *
 * De gebruiker kan ook hier favoriet togglen. Notities/clips/bookmarks van
 * de website laten we (voorlopig) buiten de mobiele app.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as WebBrowser from 'expo-web-browser';
import { colors, radius, spacing, shadows } from '../constants/theme';
import { useToast } from '../components/Toast';
import {
  getLearning,
  toggleLearningFavorite,
  learningKindIcon,
  learningKindLabel,
} from '../services';
import type { LearningDetail } from '../services';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'LearningDetail'>;

const HEADER_CONTENT_HEIGHT = 42;

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

/** Wikkelt blog-HTML in een leesbaar document met theme-styling. */
function wrapBlogHtml(bodyHtml: string): string {
  return `<!DOCTYPE html><html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<style>
  body {
    font-family: -apple-system, Roboto, system-ui, sans-serif;
    color: ${colors.dark};
    background: ${colors.bg};
    margin: 0;
    padding: 16px;
    font-size: 16px;
    line-height: 1.6;
  }
  h1, h2, h3 { color: ${colors.primaryDark}; line-height: 1.3; }
  a { color: ${colors.primary}; }
  img { max-width: 100%; height: auto; border-radius: 8px; }
  pre, code { white-space: pre-wrap; word-wrap: break-word; }
  iframe, video { max-width: 100%; }
</style>
</head><body>${bodyHtml}</body></html>`;
}

export function LearningDetailScreen({ navigation, route }: Props) {
  const { id, title } = route.params;
  const { show } = useToast();
  const { width } = useWindowDimensions();

  const [learning, setLearning] = useState<LearningDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [favBusy, setFavBusy] = useState(false);
  const [opening, setOpening] = useState(false);

  /* Video-bron: pas bekend na het laden. useVideoPlayer accepteert null en
     herbouwt de speler zodra de signed URL beschikbaar is. */
  const videoUri =
    learning?.kind === 'video' ? learning.signed_url ?? null : null;
  const player = useVideoPlayer(videoUri, p => {
    p.loop = false;
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const data = await getLearning(id);
        if (!cancelled) setLearning(data);
      } catch (err: any) {
        if (!cancelled) {
          show(err.message || 'Kon dit item niet laden.', 'error');
          navigation.goBack();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, navigation, show]);

  const onToggleFavorite = useCallback(async () => {
    if (!learning || favBusy) return;
    setFavBusy(true);
    setLearning(prev =>
      prev ? { ...prev, is_favorite: !prev.is_favorite } : prev
    );
    try {
      const isFav = await toggleLearningFavorite(learning.id);
      setLearning(prev => (prev ? { ...prev, is_favorite: isFav } : prev));
    } catch (err: any) {
      setLearning(prev =>
        prev ? { ...prev, is_favorite: learning.is_favorite } : prev
      );
      show(err.message || 'Favoriet wijzigen mislukt.', 'error');
    } finally {
      setFavBusy(false);
    }
  }, [learning, favBusy, show]);

  const onOpenPdf = useCallback(async () => {
    if (!learning?.signed_url || opening) return;
    setOpening(true);
    try {
      await WebBrowser.openBrowserAsync(learning.signed_url);
    } catch {
      show('Kon het document niet openen.', 'error');
    } finally {
      setOpening(false);
    }
  }, [learning, opening, show]);

  const headerTitle = learning?.title ?? title ?? 'Learning';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <ChevronBack onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle} numberOfLines={1}>
          {headerTitle}
        </Text>
        {learning ? (
          <Pressable
            onPress={onToggleFavorite}
            disabled={favBusy}
            hitSlop={12}
            accessibilityLabel={
              learning.is_favorite
                ? 'Uit favorieten halen'
                : 'Aan favorieten toevoegen'
            }
          >
            <Feather
              name="heart"
              size={20}
              color={learning.is_favorite ? colors.danger : colors.grayLight}
            />
          </Pressable>
        ) : (
          <View style={{ width: 20 }} />
        )}
      </View>

      {loading ? (
        <View style={styles.loadingBlock}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : !learning ? null : learning.kind === 'blog' ? (
        /* BLOG → WebView met body_html */
        <WebView
          originWhitelist={['*']}
          source={{ html: wrapBlogHtml(learning.body_html ?? '') }}
          style={styles.webview}
          showsVerticalScrollIndicator
        />
      ) : learning.kind === 'video' ? (
        /* VIDEO → expo-video speler */
        <ScrollView contentContainerStyle={styles.scroll}>
          <VideoView
            player={player}
            style={[styles.video, { width: width - spacing.lg * 2 }]}
            nativeControls
            allowsFullscreen
            contentFit="contain"
          />
          {learning.description ? (
            <Text style={styles.description}>{learning.description}</Text>
          ) : null}
        </ScrollView>
      ) : (
        /* PDF → open in in-app browser */
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.pdfCard}>
            <Text style={styles.pdfIcon}>{learningKindIcon('pdf')}</Text>
            <Text style={styles.pdfTitle}>{learning.title}</Text>
            <Text style={styles.pdfKind}>{learningKindLabel('pdf')}</Text>
            {learning.description ? (
              <Text style={styles.description}>{learning.description}</Text>
            ) : null}
            <Pressable
              onPress={onOpenPdf}
              disabled={opening || !learning.signed_url}
              style={({ pressed }) => [
                styles.openBtn,
                pressed && styles.pressed,
                (opening || !learning.signed_url) && styles.btnDisabled,
              ]}
            >
              {opening ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Feather name="external-link" size={16} color={colors.white} />
                  <Text style={styles.openBtnText}>Document openen</Text>
                </>
              )}
            </Pressable>
          </View>
        </ScrollView>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    height: HEADER_CONTENT_HEIGHT,
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.dark,
    marginHorizontal: spacing.sm,
  },
  loadingBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webview: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  video: {
    height: 220,
    borderRadius: radius.md,
    backgroundColor: colors.dark,
    alignSelf: 'center',
  },
  description: {
    fontSize: 14,
    color: colors.darkLight,
    lineHeight: 20,
    marginTop: spacing.lg,
  },
  pdfCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.light,
    ...shadows.sm,
  },
  pdfIcon: {
    fontSize: 48,
  },
  pdfTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.dark,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  pdfKind: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.gray,
    marginTop: spacing.xs,
  },
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 12,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xl,
    minWidth: 200,
  },
  openBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.white,
  },
  pressed: {
    opacity: 0.7,
  },
  btnDisabled: {
    opacity: 0.5,
  },
});
