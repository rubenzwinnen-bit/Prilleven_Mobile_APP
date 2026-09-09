/**
 * COOKING RHYTHM — "Pril Ritme"
 * Spiegel van `.cooking-rhythm` op de website: één balk boven het actieve
 * weekschema met de lopende week en de drie voorgaande.
 *
 * Per week één rondje: een vinkje wanneer het ritme gehaald is, "x/3" voor de
 * lopende week, en een streepje voor een afgelopen week zonder vol ritme.
 * Drie kookdagen vormen één volle week — meerdere gerechten op dezelfde dag
 * tellen samen als één kookdag.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '../constants/theme';
import type { RhythmHistory } from '../lib/cookingProgress';

interface Props {
  history: RhythmHistory;
}

function weekLabel(index: number): string {
  if (index === 0) return 'Deze week';
  if (index === 1) return 'Vorige';
  return `${index} weken`;
}

export function CookingRhythm({ history }: Props) {
  return (
    <View style={styles.bar}>
      <Text style={styles.title}>Pril Ritme</Text>

      <View style={styles.weeks}>
        {history.weeks.map((week, index) => (
          <View key={week.weekStart} style={styles.week}>
            <View
              style={[
                styles.marker,
                week.isCurrent && !week.isComplete && styles.markerCurrent,
                week.isComplete && styles.markerComplete,
              ]}
            >
              <Text
                style={[
                  styles.markerText,
                  week.isComplete && styles.markerTextComplete,
                ]}
              >
                {week.isComplete
                  ? '✓'
                  : week.isCurrent
                    ? `${Math.min(week.days, week.target)}/${week.target}`
                    : '–'}
              </Text>
            </View>
            <Text style={styles.weekLabel}>{weekLabel(index)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(79, 125, 108, 0.14)',
    borderRadius: radius.md,
    backgroundColor: 'rgba(79, 125, 108, 0.08)',
  },
  title: {
    color: colors.greenText,
    fontSize: 15,
    fontWeight: '600',
  },
  weeks: {
    flexDirection: 'row',
    gap: 6,
  },
  week: {
    alignItems: 'center',
    gap: 3,
    minWidth: 46,
  },
  marker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(79, 125, 108, 0.22)',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerCurrent: {
    borderColor: 'rgba(79, 125, 108, 0.42)',
    backgroundColor: colors.white,
  },
  markerComplete: {
    borderColor: colors.greenText,
    backgroundColor: colors.greenText,
  },
  markerText: {
    color: colors.greenText,
    fontSize: 11,
    fontWeight: '600',
  },
  markerTextComplete: {
    color: colors.white,
  },
  weekLabel: {
    color: colors.gray,
    fontSize: 10,
    lineHeight: 13,
  },
});
