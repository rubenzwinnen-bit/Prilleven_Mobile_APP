/**
 * AANRADER-KAART
 *
 * Eén product in het overzicht. Gedeeld met het detailscherm voor de
 * onderdelen die daar terugkomen (labels, kortingscode, koopknop,
 * transparantieregel), zodat beide niet uiteen kunnen lopen.
 *
 * Transparantie is hier geen sierlijk detail maar de afspraak uit
 * PLAN-AFFILIATE §5: `relatie_type` staat verplicht op élke kaart én op de
 * detailpagina. Niet verstoppen, niet afkorten.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Image, Pressable, Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { colors, radius, spacing, shadows } from '../constants/theme';
import {
  RELATIE_LABELS,
  LABEL_TEKST,
  leeftijdLabel,
  magKoopknopTonen,
  veiligeUrl,
  type AanraderProduct,
} from '../services';

/* ----------------------------------------
   Herbruikbare stukjes
---------------------------------------- */

export function AanraderLabels({ product }: { product: AanraderProduct }) {
  const labels: string[] = [];
  if (product.favoriet_anneleen) labels.push('Favoriet');
  for (const l of product.labels) {
    if (l === 'favoriet' && product.favoriet_anneleen) continue; // niet dubbel
    labels.push(LABEL_TEKST[l] || l);
  }
  if (product.korting_tekst) labels.push(product.korting_tekst);
  if (labels.length === 0) return null;

  return (
    <View style={styles.labels}>
      {labels.map(l => (
        <View key={l} style={styles.label}>
          <Text style={styles.labelText}>{l}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Kortingscode met kopieerknop. Het label wisselt 1,8 s naar "Gekopieerd"
 * en springt dan terug — zelfde bevestiging als `kopieerCode()` op de
 * website. De tekst blijft `selectable`, zodat handmatig kopiëren mogelijk
 * blijft als het klembord onverhoopt weigert.
 */
export function AanraderCode({ code }: { code: string }) {
  const [gekopieerd, setGekopieerd] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Opruimen bij unmount: anders zet de timer state op een verdwenen
     component wanneer je meteen terugnavigeert. */
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const kopieer = async () => {
    try {
      await Clipboard.setStringAsync(code);
      setGekopieerd(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setGekopieerd(false), 1800);
    } catch {
      /* Stil: de code staat er nog gewoon en is selecteerbaar. */
    }
  };

  return (
    <Pressable
      onPress={kopieer}
      style={({ pressed }) => [
        styles.code,
        gekopieerd && styles.codeGekopieerd,
        pressed && styles.pressed,
      ]}
      accessibilityLabel={`Kortingscode ${code} kopiëren`}
    >
      <Text style={styles.codeLabel}>
        {gekopieerd ? 'Gekopieerd ✓' : 'Kortingscode · tik om te kopiëren'}
      </Text>
      <Text style={styles.codeWaarde} selectable>
        {code}
      </Text>
    </Pressable>
  );
}

/**
 * De koopknop. Drie situaties, net als op de website:
 *   - echte link          → knop naar de winkel
 *   - enkel kortingscode  → geen valse knop, wel uitleg
 *   - geen van beide      → "link volgt" (bv. een partner zonder link)
 * En op iOS verdwijnt de knop bij Pril Levens eigen digitale producten;
 * zie `magKoopknopTonen`.
 */
export function AanraderKnop({ product }: { product: AanraderProduct }) {
  const link = veiligeUrl(product.affiliate_link);
  const mag = magKoopknopTonen(product);

  if (link && mag) {
    return (
      <Pressable
        style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
        onPress={() => Linking.openURL(link)}
      >
        <Text style={styles.btnText}>
          Bekijk bij {product.merk || product.titel} ↗
        </Text>
      </Pressable>
    );
  }

  /* Eigen digitaal product op iOS: geen knop én geen zin die zegt waar je
     het koopt — ook dat is een oproep tot kopen buiten de app (3.1.3(f), zie
     constants/links.ts). De kaart zelf blijft staan. */
  if (link && !mag) {
    return null;
  }

  return (
    <Text style={styles.btnUit}>
      {product.kortingscode
        ? 'Gebruik de code in de webshop.'
        : 'Link volgt.'}
    </Text>
  );
}

export function AanraderRelatie({ product }: { product: AanraderProduct }) {
  const tekst = RELATIE_LABELS[product.relatie_type];
  if (!tekst) return null;
  const zacht =
    product.relatie_type === 'enkel_korting' ||
    product.relatie_type === 'geen_samenwerking';
  return (
    <View style={styles.relatie}>
      <View style={[styles.relatieStip, zacht && styles.relatieStipZacht]} />
      <Text style={styles.relatieText}>{tekst}</Text>
    </View>
  );
}

/* ----------------------------------------
   De kaart
---------------------------------------- */
export function AanraderKaart({
  product,
  onOpen,
}: {
  product: AanraderProduct;
  onOpen: () => void;
}) {
  return (
    <View style={styles.kaart}>
      <Pressable onPress={onOpen}>
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

        <View style={styles.body}>
          <View style={styles.kop}>
            {!!product.merk && <Text style={styles.merk}>{product.merk}</Text>}
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
            </View>
          </View>

          <Text style={styles.titel}>{product.titel}</Text>
          {!!product.korte_beschrijving && (
            <Text style={styles.tekst}>{product.korte_beschrijving}</Text>
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
        </View>
      </Pressable>

      <View style={styles.foot}>
        {!!product.kortingscode && <AanraderCode code={product.kortingscode} />}
        <AanraderKnop product={product} />
        <AanraderRelatie product={product} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  kaart: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    overflow: 'hidden',
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  media: {
    height: 170,
    backgroundColor: colors.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  foto: { width: '100%', height: '100%' },
  fotoPlaceholder: { fontSize: 40 },

  labels: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  label: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(79, 125, 108, 0.12)',
  },
  labelText: { fontSize: 11, fontWeight: '700', color: colors.greenText },

  body: { padding: spacing.md },
  kop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: 4,
  },
  merk: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gray,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  chips: { flexDirection: 'row', gap: 5, flexShrink: 0 },
  chip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.light,
  },
  chipText: { fontSize: 10, fontWeight: '600', color: colors.darkLight },

  titel: { fontSize: 16, fontWeight: '700', color: colors.dark },
  tekst: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.darkLight,
    marginTop: 4,
  },
  waarom: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(201, 137, 102, 0.08)',
  },
  waaromKop: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  waaromTekst: { fontSize: 13, lineHeight: 19, color: colors.dark },
  opmerking: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: '#fff8e8',
    borderWidth: 1,
    borderColor: '#ead49a',
  },
  opmerkingText: { fontSize: 12, lineHeight: 18, color: colors.dark },
  opmerkingKop: { fontWeight: '700' },

  foot: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  code: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.greenText,
    backgroundColor: 'rgba(79, 125, 108, 0.07)',
  },
  codeGekopieerd: {
    backgroundColor: 'rgba(79, 125, 108, 0.16)',
    borderStyle: 'solid',
  },
  codeLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.greenText,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  codeWaarde: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.greenText,
    letterSpacing: 1,
  },

  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 11,
    alignItems: 'center',
  },
  btnText: { fontSize: 14, fontWeight: '700', color: colors.white },
  btnUit: {
    fontSize: 12,
    color: colors.gray,
    fontStyle: 'italic',
  },

  relatie: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  relatieStip: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.primary,
  },
  relatieStipZacht: { backgroundColor: colors.grayLight },
  relatieText: { fontSize: 11, color: colors.gray, flex: 1 },

  pressed: { opacity: 0.8 },
});
