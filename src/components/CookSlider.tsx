/**
 * COOK SLIDER — "Veeg om af te ronden"
 * Spiegel van `.recipe-cook-slider` op de website: je sleept de knop naar
 * rechts om één gerecht uit je actieve weekschema af te ronden.
 *
 * Eén baan per plaats in het schema. Staat een recept twee keer op dezelfde
 * dag, dan krijg je twee banen die je los afvinkt.
 *
 * Bewust een veegbeweging en geen knop: afronden mag niet per ongeluk
 * gebeuren, en het is dezelfde handeling als op de web.
 *
 * Drie dingen maken het gebaar bruikbaar in een scrollbaar scherm:
 *   - de hele baan luistert, niet alleen de knop;
 *   - het gebaar wordt in de capture-fase opgeëist zodra de beweging meer
 *     horizontaal dan verticaal is, anders pakt de ScrollView hem af;
 *   - `onPanResponderTerminationRequest` staat op false, zodat de ScrollView
 *     hem er halverwege niet alsnog uit trekt.
 *
 * `PanResponder` + `Animated` volstaan; reanimated zou een worklet-laag
 * toevoegen voor één gebaar dat niet in een lijst zit.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  Pressable,
} from 'react-native';
import { colors, radius, spacing } from '../constants/theme';

const TRACK_H = 54;
const KNOB = 46;
const KNOB_MARGE = (TRACK_H - KNOB) / 2;
/** Aandeel van de baan dat je moet halen voor het telt als afgerond. */
const DREMPEL = 0.75;

interface Props {
  isCooked: boolean;
  /** Bijvoorbeeld "Woensdag - Middag" — waar in het schema dit gerecht staat. */
  slotLabel: string;
  /** Stand van de week, getoond na het afronden. */
  feedback: string;
  onCooked: () => void;
  onUndo: () => void;
}

export function CookSlider({
  isCooked,
  slotLabel,
  feedback,
  onCooked,
  onUndo,
}: Props) {
  const [trackW, setTrackW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;

  /* Na "Ongedaan maken" moet de knop terug naar links. Zonder dit blijft de
     animatiewaarde op het maximum staan: de knop lijkt vast te zitten rechts
     en springt bij je eerste aanraking terug. */
  useEffect(() => {
    if (!isCooked) x.setValue(0);
  }, [isCooked, x]);
  /* De responder-callbacks zien de state van hun eigen render, dus de
     baanbreedte moet via een ref binnenkomen. */
  const maxRef = useRef(0);
  maxRef.current = Math.max(0, trackW - KNOB - KNOB_MARGE * 2);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !isCooked,
        /* Capture: opeisen vóór de ScrollView, zodra de beweging duidelijk
           horizontaal is. Anders verlies je het gebaar bij de minste
           verticale afwijking en veert de knop terug. */
        onMoveShouldSetPanResponderCapture: (_, g) =>
          !isCooked && Math.abs(g.dx) > 4 && Math.abs(g.dx) > Math.abs(g.dy),
        onMoveShouldSetPanResponder: (_, g) =>
          !isCooked && Math.abs(g.dx) > 4 && Math.abs(g.dx) > Math.abs(g.dy),
        /* Eenmaal bezig laten we niemand het gebaar afpakken. */
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, g) => {
          const max = maxRef.current;
          x.setValue(Math.max(0, Math.min(max, g.dx)));
        },
        onPanResponderRelease: (_, g) => {
          const max = maxRef.current;
          const bereikt = max > 0 && g.dx >= max * DREMPEL;
          if (bereikt) {
            Animated.timing(x, {
              toValue: max,
              duration: 120,
              useNativeDriver: true,
            }).start(() => onCooked());
          } else {
            Animated.spring(x, {
              toValue: 0,
              useNativeDriver: true,
              bounciness: 4,
            }).start();
          }
        },
        onPanResponderTerminate: () => {
          Animated.spring(x, { toValue: 0, useNativeDriver: true }).start();
        },
      }),
    [isCooked, onCooked, x]
  );

  /* Na het afronden staat de knop rechts; bij ongedaan maken weer links. */
  const knobX = isCooked ? maxRef.current : x;

  return (
    <View style={styles.wrap}>
      <Text style={styles.slotLabel}>{slotLabel}</Text>

      <View
        {...(isCooked ? {} : panResponder.panHandlers)}
        style={[styles.track, isCooked && styles.trackDone]}
        onLayout={e => setTrackW(e.nativeEvent.layout.width)}
      >
        {/* De vulling is een balk over de volle baan die we naar links uit
            beeld schuiven. `width` animeren kan niet op de native driver
            ("style property width is not supported by native animated
            module"); `translateX` wel. */}
        {!isCooked && trackW > 0 && (
          <Animated.View
            style={[
              styles.fill,
              {
                width: trackW,
                transform: [
                  {
                    translateX: Animated.add(
                      x,
                      KNOB + KNOB_MARGE * 2 - trackW
                    ),
                  },
                ],
              },
            ]}
          />
        )}

        <Text style={[styles.label, isCooked && styles.labelDone]}>
          {isCooked ? 'Cooked it! ✓' : 'Veeg om af te ronden →'}
        </Text>

        <Animated.View
          style={[styles.knob, { transform: [{ translateX: knobX }] }]}
          pointerEvents="none"
        >
          <Text style={styles.knobText}>{isCooked ? '✓' : '→'}</Text>
        </Animated.View>
      </View>

      {isCooked && (
        <View style={styles.success}>
          <Text style={styles.successIcon}>✓</Text>
          <View style={styles.successCopy}>
            <Text style={styles.successTitle}>Cooked it!</Text>
            <Text style={styles.successText}>{feedback}</Text>
          </View>
          <Pressable onPress={onUndo} hitSlop={8}>
            <Text style={styles.undo}>Ongedaan maken</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.md,
  },
  slotLabel: {
    marginBottom: 6,
    color: colors.greenText,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  track: {
    height: TRACK_H,
    borderRadius: 999,
    backgroundColor: colors.light,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  trackDone: {
    backgroundColor: colors.greenText,
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.greenText,
  },
  label: {
    position: 'absolute',
    left: TRACK_H,
    right: spacing.md,
    textAlign: 'center',
    color: colors.darkLight,
    fontSize: 13.5,
    fontWeight: '600',
  },
  labelDone: {
    color: colors.white,
  },
  knob: {
    position: 'absolute',
    left: KNOB_MARGE,
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  knobText: {
    color: colors.greenText,
    fontSize: 19,
    fontWeight: '700',
  },
  success: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  successIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.greenText,
    color: colors.white,
    textAlign: 'center',
    lineHeight: 26,
    fontWeight: '700',
  },
  successCopy: {
    flex: 1,
  },
  successTitle: {
    color: colors.dark,
    fontSize: 14,
    fontWeight: '700',
  },
  successText: {
    color: colors.gray,
    fontSize: 12,
    lineHeight: 17,
  },
  undo: {
    color: colors.greenText,
    fontSize: 12.5,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
