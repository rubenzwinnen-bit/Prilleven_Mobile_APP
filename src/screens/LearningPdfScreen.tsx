/**
 * LEARNING PDF SCREEN — eigen PDF.js-viewer in een WebView
 *
 * Vervangt de in-app systeembrowser voor documenten (pdf). Reden:
 *   1. Bladwijzer-sync — we kunnen de huidige pagina uitlezen én naar een
 *      bewaarde pagina springen. Zet je op de website een bladwijzer op
 *      pagina X, dan opent dit scherm meteen op pagina X (en omgekeerd).
 *   2. Download verbergen — net als de website tonen we geen downloadknop.
 *
 * Werking: pdf.js (CDN, UMD-build) rendert alle pagina's als canvassen in
 * een scrollbare WebView. De pagina-tracker post elke pagina-wissel terug
 * via `window.ReactNativeWebView.postMessage`; wij debouncen het bewaren
 * (1500 ms, identiek aan de website) en bewaren ook bij verlaten.
 *
 * Bron van de bladwijzer: GET/PUT /api/learnings/:id/bookmark { position:
 * { page_nr } } — gedeeld met de website.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { WebView } from 'react-native-webview';
import { colors, spacing } from '../constants/theme';
import { useToast } from '../components/Toast';
import { getLearning, getLearningBookmark, putLearningBookmark } from '../services';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'LearningPdf'>;

const HEADER_CONTENT_HEIGHT = 42;
const SAVE_DEBOUNCE_MS = 1500;

/* pdf.js UMD-build (CDN). Stabiele versie met losse worker. */
const PDFJS_LIB =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

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

/** Bouwt de PDF.js-viewer-HTML met de signed URL + start-pagina ingebed. */
function buildViewerHtml(pdfUrl: string, startPage: number): string {
  const url = JSON.stringify(pdfUrl);
  const start = Number.isFinite(startPage) && startPage > 0 ? startPage : 1;
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=3" />
<style>
  html, body { margin: 0; padding: 0; background: #525659; }
  #viewer { padding: 8px 0; }
  canvas.page { display: block; margin: 0 auto 8px; background: #fff;
    box-shadow: 0 1px 4px rgba(0,0,0,0.4); }
  #status { color: #fff; font-family: -apple-system, Roboto, sans-serif;
    text-align: center; padding: 28px 16px; font-size: 15px; }
</style>
</head>
<body>
<div id="status">Document laden…</div>
<div id="viewer"></div>
<script src="${PDFJS_LIB}"></script>
<script>
  var PDF_URL = ${url};
  var START_PAGE = ${start};
  function post(m){ if(window.ReactNativeWebView){ window.ReactNativeWebView.postMessage(JSON.stringify(m)); } }
  try { pdfjsLib.GlobalWorkerOptions.workerSrc = ${JSON.stringify(PDFJS_WORKER)}; } catch(e){}

  (async function(){
    try {
      var pdf = await pdfjsLib.getDocument(PDF_URL).promise;
      var viewer = document.getElementById('viewer');
      var status = document.getElementById('status');
      status.style.display = 'none';
      var dpr = window.devicePixelRatio || 1;
      var cw = document.body.clientWidth;
      var canvases = [];
      for (var n = 1; n <= pdf.numPages; n++){
        var page = await pdf.getPage(n);
        var base = page.getViewport({ scale: 1 });
        var fit = cw / base.width;
        var vp = page.getViewport({ scale: fit * dpr });
        var canvas = document.createElement('canvas');
        canvas.className = 'page';
        canvas.width = vp.width;
        canvas.height = vp.height;
        canvas.style.width = cw + 'px';
        canvas.style.height = (vp.height / dpr) + 'px';
        canvas.setAttribute('data-page', String(n));
        viewer.appendChild(canvas);
        await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
        canvases.push(canvas);
      }
      post({ type: 'loaded', pages: pdf.numPages });

      if (START_PAGE > 1 && canvases[START_PAGE - 1]) {
        canvases[START_PAGE - 1].scrollIntoView();
      }

      var cur = START_PAGE || 1;
      var t;
      function detect(){
        var mid = window.scrollY + window.innerHeight / 2;
        var best = 1, bestDist = Infinity;
        for (var i = 0; i < canvases.length; i++){
          var c = canvases[i];
          var center = c.offsetTop + c.offsetHeight / 2;
          var d = Math.abs(center - mid);
          if (d < bestDist){ bestDist = d; best = parseInt(c.getAttribute('data-page'), 10); }
        }
        if (best !== cur){ cur = best; post({ type: 'page', page: best }); }
      }
      window.addEventListener('scroll', function(){
        clearTimeout(t); t = setTimeout(detect, 250);
      });
    } catch (e){
      var s = document.getElementById('status');
      s.style.display = 'block';
      s.textContent = 'Kon het document niet laden.';
      post({ type: 'error', message: String((e && e.message) || e) });
    }
  })();
</script>
</body>
</html>`;
}

export function LearningPdfScreen({ navigation, route }: Props) {
  const { id, title } = route.params;
  const { show } = useToast();

  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  /* Laatst gerapporteerde pagina + debounce-timer voor het bewaren. */
  const pageRef = useRef<number>(1);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef<number>(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        /* Detail (signed_url) + bladwijzer parallel ophalen. */
        const [detail, bookmark] = await Promise.all([
          getLearning(id),
          getLearningBookmark(id).catch(() => null),
        ]);
        if (cancelled) return;
        if (!detail.signed_url) {
          show('Dit document is momenteel niet beschikbaar.', 'error');
          navigation.goBack();
          return;
        }
        const startPage = bookmark?.page_nr ?? 1;
        pageRef.current = startPage;
        lastSaved.current = startPage;
        setHtml(buildViewerHtml(detail.signed_url, startPage));
      } catch (err: any) {
        if (!cancelled) {
          show(err.message || 'Kon dit document niet laden.', 'error');
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

  /* Bewaart de huidige pagina (alleen als ze afwijkt van wat we al bewaarden). */
  const savePage = useCallback(
    (page: number) => {
      if (page === lastSaved.current) return;
      lastSaved.current = page;
      putLearningBookmark(id, { page_nr: page }).catch(() => {
        /* Stille fout: bladwijzer bewaren is niet kritisch. */
      });
    },
    [id]
  );

  /* Bij verlaten: pending timer flushen en de laatste pagina bewaren. */
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      savePage(pageRef.current);
    };
  }, [savePage]);

  const onMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      let msg: any;
      try {
        msg = JSON.parse(event.nativeEvent.data);
      } catch {
        return;
      }
      if (msg?.type === 'page' && typeof msg.page === 'number') {
        pageRef.current = msg.page;
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(
          () => savePage(pageRef.current),
          SAVE_DEBOUNCE_MS
        );
      } else if (msg?.type === 'error') {
        show('Kon het document niet weergeven.', 'error');
      }
    },
    [savePage, show]
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <ChevronBack onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title ?? 'Document'}
        </Text>
        <View style={{ width: 28 }} />
      </View>

      {loading || !html ? (
        <View style={styles.loadingBlock}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <WebView
          originWhitelist={['*']}
          source={{ html }}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled
          onMessage={onMessage}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loadingBlock}>
              <ActivityIndicator color={colors.primary} />
            </View>
          )}
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
    textAlign: 'center',
    marginHorizontal: spacing.sm,
  },
  loadingBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webview: {
    flex: 1,
    backgroundColor: '#525659',
  },
});
