/**
 * LEARNING PDF SCREEN — eigen PDF.js-viewer in een WebView
 *
 * Vervangt de in-app systeembrowser voor documenten (pdf). Reden:
 *   1. Bladwijzer-sync — we kunnen de huidige pagina uitlezen én naar een
 *      bewaarde pagina springen. Zet je op de website een bladwijzer op
 *      pagina X, dan opent dit scherm meteen op pagina X (en omgekeerd).
 *   2. Download verbergen — net als de website tonen we geen downloadknop.
 *
 * Werking: pdf.js (CDN, UMD-build) rendert de pagina's als canvassen in
 * een scrollbare WebView. **Lui**: eerst worden alleen lege canvassen met de
 * juiste afmetingen geplaatst, en pas wat rond de zichtbare pagina ligt wordt
 * gerasterd (venster van 3, één render tegelijk); ver weg gerenderde pagina's
 * worden weer leeggemaakt zodat het geheugen niet oploopt. Daarvoor werden
 * álle pagina's vooraf gerenderd, wat bij een dik document minutenlang duurde.
 * De pixelratio is afgetopt op 2. De pagina-tracker post elke pagina-wissel terug
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
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { WebView } from 'react-native-webview';
import { colors, radius, spacing } from '../constants/theme';
import { useUser } from '../context/UserContext';
import { leesVoortgang, setLearningCompleted } from '../lib/learningProgress';
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

      /* Een pixelratio van 3 verviervoudigt het rasterwerk tegenover 1,5
         zonder dat je op een telefoon het verschil ziet. Aftoppen op 2. */
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var cw = document.body.clientWidth;

      /* EERST alleen de afmetingen bepalen en lege canvassen plaatsen. Het
         rasteren zelf gebeurt pas wanneer een pagina in beeld komt — anders
         wacht je bij een document van dertig pagina's op dertig renders
         voor je iets ziet. */
      var pages = [];
      for (var n = 1; n <= pdf.numPages; n++){
        var page = await pdf.getPage(n);
        var base = page.getViewport({ scale: 1 });
        var fit = cw / base.width;
        var vp = page.getViewport({ scale: fit * dpr });
        var canvas = document.createElement('canvas');
        canvas.className = 'page';
        canvas.style.width = cw + 'px';
        canvas.style.height = (vp.height / dpr) + 'px';
        canvas.setAttribute('data-page', String(n));
        viewer.appendChild(canvas);
        pages.push({ n: n, page: page, vp: vp, canvas: canvas, state: 'leeg' });
      }

      post({ type: 'loaded', pages: pdf.numPages });

      /* Eén render tegelijk: parallelle renders vechten om dezelfde thread
         en maken het scrollen schokkerig. */
      var wachtrij = [];
      var bezig = false;
      async function werkAf(){
        if (bezig) return;
        bezig = true;
        while (wachtrij.length){
          var item = wachtrij.shift();
          if (item.state !== 'leeg') continue;
          item.state = 'bezig';
          try {
            item.canvas.width = item.vp.width;
            item.canvas.height = item.vp.height;
            await item.page.render({
              canvasContext: item.canvas.getContext('2d'),
              viewport: item.vp
            }).promise;
            item.state = 'klaar';
          } catch (e){
            item.state = 'leeg';
          }
        }
        bezig = false;
      }

      function planIn(item){
        if (item.state !== 'leeg') return;
        wachtrij.push(item);
        werkAf();
      }

      /* Ver weg gerenderde pagina's weer leegmaken: de CSS-afmeting blijft,
         dus de opmaak schuift niet, maar de bitmap komt vrij. Zonder dit
         groeit het geheugen bij een lang document tot het tabblad sneuvelt. */
      function laatVallen(item){
        if (item.state !== 'klaar') return;
        item.canvas.width = 0;
        item.canvas.height = 0;
        item.state = 'leeg';
      }

      var VENSTER = 3;
      function verversRondom(midden){
        for (var i = 0; i < pages.length; i++){
          var afstand = Math.abs(pages[i].n - midden);
          if (afstand <= VENSTER) planIn(pages[i]);
          else if (afstand > VENSTER + 3) laatVallen(pages[i]);
        }
      }

      /* Bij een bladwijzer eerst daarheen springen, zodat die pagina als
         eerste gerasterd wordt in plaats van pagina 1. */
      var cur = START_PAGE || 1;
      if (START_PAGE > 1 && pages[START_PAGE - 1]) {
        pages[START_PAGE - 1].canvas.scrollIntoView();
      }
      verversRondom(cur);

      var t;
      function detect(){
        var mid = window.scrollY + window.innerHeight / 2;
        var best = 1, bestDist = Infinity;
        for (var i = 0; i < pages.length; i++){
          var c = pages[i].canvas;
          var center = c.offsetTop + c.offsetHeight / 2;
          var d = Math.abs(center - mid);
          if (d < bestDist){ bestDist = d; best = pages[i].n; }
        }
        verversRondom(best);
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

  const { user } = useUser();
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  /* Afgerond-status, lokaal per gebruiker — zie lib/learningProgress.ts.
     Documenten openen via dit scherm en niet via LearningDetailScreen, dus
     de afrondactie hoort hier óók te staan. */
  const [afgerond, setAfgerond] = useState(false);

  useEffect(() => {
    let cancelled = false;
    leesVoortgang(user).then(map => {
      if (!cancelled) setAfgerond(!!map[id]?.completed_at);
    });
    return () => {
      cancelled = true;
    };
  }, [user, id]);

  const toggleAfgerond = useCallback(async () => {
    const volgende = !afgerond;
    setAfgerond(volgende);
    await setLearningCompleted(user, id, volgende);
  }, [afgerond, user, id]);

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

      <View style={styles.afrondBalk}>
        {afgerond ? (
          <>
            <Text style={styles.afrondKlaar}>Afgerond ✓</Text>
            <Pressable onPress={toggleAfgerond}>
              <Text style={styles.afrondUndo}>Ongedaan maken</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.afrondVraag}>Klaar met dit document?</Text>
            <Pressable onPress={toggleAfgerond} style={styles.afrondBtn}>
              <Text style={styles.afrondBtnText}>Markeer als afgerond</Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  afrondBalk: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.light,
    backgroundColor: colors.white,
  },
  afrondVraag: { flex: 1, fontSize: 14, color: colors.darkLight },
  afrondBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderRadius: radius.sm,
    backgroundColor: colors.greenText,
  },
  afrondBtnText: { fontSize: 13, fontWeight: '700', color: colors.white },
  afrondKlaar: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.greenText,
  },
  afrondUndo: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray,
    textDecorationLine: 'underline',
  },

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
