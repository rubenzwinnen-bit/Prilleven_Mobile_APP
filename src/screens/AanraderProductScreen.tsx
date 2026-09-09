/**
 * AANRADER — productdetail
 *
 * Tegenhanger van `/aanraders/p/<slug>`. Toont alles wat de kaart weglaat:
 * de lange beschrijving, voordelen, nadelen en FAQ. Die velden staan vandaag
 * nog grotendeels leeg in de database — ze worden pas getoond als ze gevuld
 * zijn, zodat het scherm niet uit lege kopjes bestaat.
 *
 * De data komt uit dezelfde `getAanraders()`-call als het overzicht (30 s
 * cache), dus het openen van een product kost normaal geen extra request.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, radius, spacing, shadows } from '../constants/theme';
import { useToast } from '../components/Toast';
import { getAanraders, leeftijdLabel, type AanraderProduct } from '../services';
import {
  AanraderLabels,
  AanraderCode,
  AanraderKnop,
  AanraderRelatie,
} from '../components/AanraderKaart';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'AanraderProduct'>;

function ChevronBack({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} hitSlop={12} style={styles.backBtn}>
      <Text style={styles.backChevron}>‹</Text>
    </TouchableOpacity>
  );
}

function Blok({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <View style={styles.blok}>
      <Text style={styles.blokTitel}>{titel}</Text>
      {children}
    </View>
  );
}

export function AanraderProductScreen({ route, navigation }: Props) {
  const { slug, titel } = route.params;
  const { show } = useToast();
  const [product, setProduct] = useState<AanraderProduct | null>(null);
  const [loading, setLoading] = useState(true);

  const laad = useCallback(async () => {
    try {
      const data = await getAanraders();
      const gevonden = data.producten.find(p => p.slug === slug) || null;
      if (!gevonden) {
        show('Dit product bestaat niet meer.', 'error');
        navigation.goBack();
        return;
      }
      setProduct(gevonden);
    } catch {
      show('Kon dit product niet laden.', 'error');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [slug, show, navigation]);

  useEffect(() => {
    laad();
  }, [laad]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <ChevronBack onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle} numberOfLines={1}>
          {product?.titel || titel || 'Aanrader'}
        </Text>
        <View style={{ width: 28 }} />
      </View>

      {loading || !product ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.media}>
            {product.afbeelding_url ? (
              <Image
                source={{ uri: product.afbeelding_url }}
                style={styles.foto}
                resizeMode="cover"
              />
            ) : (
              <Text style={styles.fotoPlaceholder}>🛍️</Text>
            )}
          </View>

          <AanraderLabels product={product} />

          <View style={styles.kop}>
            {!!product.merk && <Text style={styles.merk}>{product.merk}</Text>}
            <Text style={styles.titel}>{product.titel}</Text>
            <View style={styles.chips}>
              <View style={styles.chip}>
                <Text style={styles.chipText}>
                  {leeftijdLabel(product.leeftijd_vanaf_maanden)}
                </Text>
              </View>
              {!!product.materiaal && (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{product.materiaal}</Text>
                </View>
              )}
              {!!product.categorie_titel && (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>{product.categorie_titel}</Text>
                </View>
              )}
            </View>
          </View>

          {!!product.korte_beschrijving && (
            <Text style={styles.lead}>{product.korte_beschrijving}</Text>
          )}

          {!!product.waarom_aanbevolen && (
            <View style={styles.waarom}>
              <Text style={styles.waaromKop}>Waarom ik dit aanbeveel</Text>
              <Text style={styles.waaromTekst}>{product.waarom_aanbevolen}</Text>
            </View>
          )}

          {!!product.opmerking && (
            <View style={styles.opmerking}>
              <Text style={styles.opmerkingText}>
                <Text style={styles.opmerkingKop}>Belangrijk: </Text>
                {product.opmerking}
              </Text>
            </View>
          )}

          {!!product.lange_beschrijving && (
            <Blok titel="Over dit product">
              <Text style={styles.tekst}>{product.lange_beschrijving}</Text>
            </Blok>
          )}

          {product.voordelen.length > 0 && (
            <Blok titel="Pluspunten">
              {product.voordelen.map((v, i) => (
                <Text key={i} style={styles.lijstItem}>
                  + {v}
                </Text>
              ))}
            </Blok>
          )}

          {product.nadelen.length > 0 && (
            <Blok titel="Waar je rekening mee houdt">
              {product.nadelen.map((v, i) => (
                <Text key={i} style={styles.lijstItem}>
                  − {v}
                </Text>
              ))}
            </Blok>
          )}

          {product.faq.length > 0 && (
            <Blok titel="Veelgestelde vragen">
              {product.faq.map((f, i) => (
                <View key={i} style={styles.faqItem}>
                  <Text style={styles.faqVraag}>{f.vraag}</Text>
                  <Text style={styles.tekst}>{f.antwoord}</Text>
                </View>
              ))}
            </Blok>
          )}

          <View style={styles.actie}>
            {!!product.kortingscode && <AanraderCode code={product.kortingscode} />}
            <AanraderKnop product={product} />
            <AanraderRelatie product={product} />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
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
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: colors.dark,
    textAlign: 'center',
  },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },

  media: {
    height: 210,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  foto: { width: '100%', height: '100%' },
  fotoPlaceholder: { fontSize: 48 },

  kop: { marginTop: spacing.sm },
  merk: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gray,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  titel: {
    fontSize: 21,
    fontWeight: '700',
    color: colors.dark,
    marginTop: 2,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: spacing.sm },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.light,
  },
  chipText: { fontSize: 11, fontWeight: '600', color: colors.darkLight },

  lead: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.darkLight,
    marginTop: spacing.md,
  },
  waarom: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(201, 137, 102, 0.08)',
  },
  waaromKop: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  waaromTekst: { fontSize: 14, lineHeight: 21, color: colors.dark },
  opmerking: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: '#fff8e8',
    borderWidth: 1,
    borderColor: '#ead49a',
  },
  opmerkingText: { fontSize: 13, lineHeight: 19, color: colors.dark },
  opmerkingKop: { fontWeight: '700' },

  blok: { marginTop: spacing.xl },
  blokTitel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.dark,
    marginBottom: spacing.sm,
  },
  tekst: { fontSize: 14, lineHeight: 21, color: colors.darkLight },
  lijstItem: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.darkLight,
  },
  faqItem: { marginBottom: spacing.md },
  faqVraag: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.dark,
    marginBottom: 2,
  },

  actie: {
    marginTop: spacing.xl,
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadows.sm,
  },
});
