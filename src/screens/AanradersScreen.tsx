/**
 * AANRADERS — overzicht
 *
 * Native tegenhanger van de publieke pagina `/aanraders`. De website rendert
 * die server-side omdat ze indexeerbaar moet zijn; in de app speelt dat niet,
 * dus lezen we de data rechtstreeks uit Supabase en bouwen we het scherm zelf.
 *
 * Opbouw, in dezelfde volgorde als de website:
 *   1. intro met de transparantietekst
 *   2. zoeken + filterpillen (categorie / merk / leeftijd)
 *   3. per categorie een sectie met productkaarten
 *   4. gratis downloads
 *
 * Er is bewust GEEN apart categoriescherm zoals `/aanraders/c/<slug>` op de
 * website. Die pagina's bestaan daar vooral voor Google; in de app doet de
 * categoriefilter in dit scherm hetzelfde werk zonder extra navigatie.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  TextInput,
  Image,
  Linking,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, radius, spacing, shadows } from '../constants/theme';
import { useToast } from '../components/Toast';
import {
  getAanraders,
  leeftijdLabel,
  zoekTekst,
  INTRO_TEKST,
  type AanradersData,
  type AanraderCategorie,
  type AanraderProduct,
} from '../services';
import { AanraderKaart } from '../components/AanraderKaart';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Aanraders'>;

/* Lokale chevron-back — zelfde reden als in ProfileScreen: RootStack
   importeert dit scherm, dus dit scherm mag niets uit RootStack halen. */
function ChevronBack({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} hitSlop={12} style={styles.backBtn}>
      <Text style={styles.backChevron}>‹</Text>
    </TouchableOpacity>
  );
}

/* ----------------------------------------
   Filters
   Een filtergroep verschijnt pas als minstens twee opties elk minstens
   twee producten hebben. Anders krijg je knoppen die stuk voor stuk één
   product tonen — dat doet de lijst zelf al. Spiegel van `pillGroep()`
   op de website.
---------------------------------------- */
interface FilterOptie {
  waarde: string;
  label: string;
  aantal: number;
}

function telOpties(
  producten: AanraderProduct[],
  lees: (p: AanraderProduct) => { waarde: string; label: string } | null
): FilterOptie[] {
  const map = new Map<string, FilterOptie>();
  for (const p of producten) {
    const v = lees(p);
    if (!v || !v.waarde) continue;
    const bestaand = map.get(v.waarde);
    if (bestaand) bestaand.aantal += 1;
    else map.set(v.waarde, { ...v, aantal: 1 });
  }
  return [...map.values()];
}

function bruikbaar(opties: FilterOptie[]): FilterOptie[] {
  const genoeg = opties.filter(o => o.aantal >= 2);
  return genoeg.length >= 2 ? genoeg : [];
}

function PillRij({
  label,
  opties,
  actief,
  onKies,
}: {
  label: string;
  opties: FilterOptie[];
  actief: string;
  onKies: (waarde: string) => void;
}) {
  if (opties.length === 0) return null;
  return (
    <View style={styles.filterGroep}>
      <Text style={styles.filterLabel}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillRij}
      >
        <Pill actief={actief === ''} label="Alles" onPress={() => onKies('')} />
        {opties.map(o => (
          <Pill
            key={o.waarde}
            actief={actief === o.waarde}
            label={o.label}
            onPress={() => onKies(o.waarde)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function Pill({
  label,
  actief,
  onPress,
}: {
  label: string;
  actief: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        actief && styles.pillActief,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.pillText, actief && styles.pillTextActief]}>
        {label}
      </Text>
    </Pressable>
  );
}

/* ----------------------------------------
   Scherm
---------------------------------------- */
export function AanradersScreen({ navigation }: Props) {
  const { show } = useToast();
  const [data, setData] = useState<AanradersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [zoek, setZoek] = useState('');
  const [cat, setCat] = useState('');
  const [merk, setMerk] = useState('');
  /* Leeftijd is een ondergrens, geen categorie: meerdere tegelijk aanvinken
     zou hetzelfde opleveren als enkel de hoogste. Dus enkelvoudig. */
  const [leeftijd, setLeeftijd] = useState('');

  const laad = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'refresh') setRefreshing(true);
      try {
        setData(await getAanraders());
      } catch {
        show('Kon de aanraders niet laden.', 'error');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [show]
  );

  useFocusEffect(
    useCallback(() => {
      laad();
    }, [laad])
  );

  /* Slugs van categorieën die als "in opbouw" gemarkeerd staan. Hun
     producten worden op de website niet getoond, dus ook hier niet — anders
     duiken ze alsnog op in de filters of zodra je zoekt. */
  const inOpbouwSlugs = useMemo(
    () =>
      new Set(
        (data?.categorieen ?? []).filter(c => c.binnenkort).map(c => c.slug)
      ),
    [data]
  );

  /* Alles wat werkelijk te zien is; hierop draaien zowel de filteropties
     als het filteren zelf. */
  const beschikbaar = useMemo(
    () =>
      (data?.producten ?? []).filter(
        p => !p.categorie_slug || !inOpbouwSlugs.has(p.categorie_slug)
      ),
    [data, inOpbouwSlugs]
  );

  const catOpties = useMemo(
    () =>
      bruikbaar(
        telOpties(beschikbaar, p =>
          p.categorie_slug
            ? { waarde: p.categorie_slug, label: p.categorie_titel || p.categorie_slug }
            : null
        )
      ),
    [beschikbaar]
  );

  const merkOpties = useMemo(
    () =>
      bruikbaar(
        telOpties(beschikbaar, p => (p.merk ? { waarde: p.merk, label: p.merk } : null))
      ),
    [beschikbaar]
  );

  const leeftijdOpties = useMemo(() => {
    const opties = telOpties(beschikbaar, p =>
      p.leeftijd_vanaf_maanden === null || p.leeftijd_vanaf_maanden === undefined
        ? null
        : {
            waarde: String(p.leeftijd_vanaf_maanden),
            label: leeftijdLabel(p.leeftijd_vanaf_maanden),
          }
    );
    return bruikbaar(opties).sort((a, b) => Number(a.waarde) - Number(b.waarde));
  }, [beschikbaar]);

  const zichtbaar = useMemo(() => {
    const term = zoek.trim().toLowerCase();
    return beschikbaar.filter(p => {
      if (cat && p.categorie_slug !== cat) return false;
      if (merk && p.merk !== merk) return false;
      if (leeftijd) {
        const m = p.leeftijd_vanaf_maanden;
        /* Ondergrens: een product "vanaf 6 mnd" past ook bij een kind van
           10 maanden. Producten zonder leeftijd gelden voor iedereen. */
        if (m !== null && m !== undefined && m > Number(leeftijd)) return false;
      }
      if (term && !zoekTekst(p).includes(term)) return false;
      return true;
    });
  }, [beschikbaar, zoek, cat, merk, leeftijd]);

  const openProduct = useCallback(
    (p: AanraderProduct) =>
      navigation.navigate('AanraderProduct', { slug: p.slug, titel: p.titel }),
    [navigation]
  );

  const filtersActief = !!(zoek.trim() || cat || merk || leeftijd);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <ChevronBack onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Aanraders</Text>
        <View style={{ width: 28 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => laad('refresh')}
              tintColor={colors.primary}
            />
          }
        >
          <Text style={styles.heroTitle}>
            Alles wat ik zelf gebruik en met overtuiging aanbeveel
          </Text>
          <Text style={styles.heroIntro}>{INTRO_TEKST}</Text>

          {beschikbaar.length === 0 ? (
            <View style={styles.soon}>
              <Text style={styles.soonTitle}>Binnenkort</Text>
              <Text style={styles.soonText}>
                De eerste aanraders worden op dit moment samengesteld.
              </Text>
            </View>
          ) : (
            <>
              <TextInput
                style={styles.zoek}
                value={zoek}
                onChangeText={setZoek}
                placeholder="Zoek op product, merk of trefwoord"
                placeholderTextColor={colors.gray}
                autoCorrect={false}
                clearButtonMode="while-editing"
              />

              <PillRij
                label="Categorie"
                opties={catOpties}
                actief={cat}
                onKies={setCat}
              />
              <PillRij label="Merk" opties={merkOpties} actief={merk} onKies={setMerk} />
              <PillRij
                label="Leeftijd"
                opties={leeftijdOpties}
                actief={leeftijd}
                onKies={setLeeftijd}
              />

              {zichtbaar.length === 0 ? (
                <View style={styles.soon}>
                  <Text style={styles.soonTitle}>Niets gevonden</Text>
                  <Text style={styles.soonText}>
                    Geen enkel product past bij deze zoekterm of filter. Probeer
                    een ander woord of zet de filters terug op "Alles".
                  </Text>
                </View>
              ) : (
                (data?.categorieen ?? []).map(c => (
                  <CategorieSectie
                    key={c.id}
                    categorie={c}
                    producten={zichtbaar.filter(p => p.categorie_slug === c.slug)}
                    /* Tijdens filteren is een lege categorie geen "binnenkort"
                       maar simpelweg weggefilterd — die verbergen we dan. */
                    verbergLeeg={filtersActief}
                    onOpen={openProduct}
                  />
                ))
              )}
            </>
          )}

          {(data?.downloads ?? []).length > 0 && (
            <View style={styles.downloads}>
              <Text style={styles.sectieTitel}>Gratis downloads</Text>
              {(data?.downloads ?? []).map(d => (
                <Pressable
                  key={d.slug}
                  style={({ pressed }) => [
                    styles.downloadRij,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => {
                    if (d.bestand_url) Linking.openURL(d.bestand_url);
                  }}
                  disabled={!d.bestand_url}
                >
                  <Text style={styles.downloadEmoji}>{d.emoji || '📄'}</Text>
                  <View style={styles.downloadBody}>
                    <Text style={styles.downloadTitel}>{d.titel}</Text>
                    {!!d.omschrijving && (
                      <Text style={styles.downloadTekst}>{d.omschrijving}</Text>
                    )}
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function CategorieSectie({
  categorie,
  producten,
  verbergLeeg,
  onOpen,
}: {
  categorie: AanraderCategorie;
  producten: AanraderProduct[];
  verbergLeeg: boolean;
  onOpen: (p: AanraderProduct) => void;
}) {
  /* De vlag `binnenkort` wint van de inhoud: staat die aan, dan toont de
     website het opbouw-blok ook als er al producten in de categorie zitten.
     Zo blijft een categorie die nog niet af is ook niet half zichtbaar. */
  const inOpbouw = categorie.binnenkort || producten.length === 0;

  /* Tijdens filteren is een lege categorie niet "in opbouw" maar gewoon
     weggefilterd; dan is een opbouw-blok misleidend. */
  if (inOpbouw && verbergLeeg) return null;

  return (
    <View style={styles.sectie}>
      {/* Geen emoji voor de categorienaam — rustiger beeld, en het is de
          afspraak uit CLAUDE.md §8. De emoji blijft wel in de database. */}
      <Text style={styles.sectieTitel}>{categorie.titel}</Text>
      {!inOpbouw && !!categorie.omschrijving && (
        <Text style={styles.sectieTekst}>{categorie.omschrijving}</Text>
      )}

      {inOpbouw ? (
        <View style={styles.soon}>
          <Text style={styles.soonTitle}>Binnenkort</Text>
          <Text style={styles.soonText}>
            Deze categorie is nog in opbouw — enkel producten die ik zelf
            getest heb komen erin.
          </Text>
        </View>
      ) : (
        producten.map(p => (
          <AanraderKaart key={p.id} product={p} onOpen={() => onOpen(p)} />
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    height: 42,
  },
  backBtn: { paddingRight: spacing.md },
  backChevron: {
    fontSize: 28,
    color: colors.primary,
    fontWeight: '300',
    marginTop: -2,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.dark },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },

  heroTitle: {
    fontSize: 21,
    fontWeight: '700',
    color: colors.dark,
    lineHeight: 28,
    marginBottom: spacing.sm,
  },
  heroIntro: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.darkLight,
    marginBottom: spacing.lg,
  },

  zoek: {
    borderWidth: 1,
    borderColor: colors.light,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.dark,
    marginBottom: spacing.md,
  },
  filterGroep: { marginBottom: spacing.sm },
  filterLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gray,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  pillRij: { gap: 6, paddingRight: spacing.lg },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(79, 125, 108, 0.24)',
    backgroundColor: colors.white,
  },
  pillActief: {
    backgroundColor: colors.greenText,
    borderColor: colors.greenText,
  },
  pillText: { fontSize: 12, fontWeight: '600', color: colors.greenText },
  pillTextActief: { color: colors.white },

  sectie: { marginTop: spacing.lg },
  sectieTitel: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.dark,
    marginBottom: spacing.sm,
  },
  sectieTekst: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.darkLight,
    marginBottom: spacing.sm,
  },

  soon: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.light,
    padding: spacing.lg,
    marginTop: spacing.sm,
  },
  soonTitle: { fontSize: 14, fontWeight: '700', color: colors.dark },
  soonText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.gray,
    marginTop: 3,
  },

  downloads: { marginTop: spacing.xl },
  downloadRij: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  downloadEmoji: { fontSize: 22 },
  downloadBody: { flex: 1 },
  downloadTitel: { fontSize: 14, fontWeight: '700', color: colors.dark },
  downloadTekst: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.gray,
    marginTop: 2,
  },

  pressed: { opacity: 0.75 },
});
