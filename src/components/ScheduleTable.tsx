/**
 * SCHEDULE TABLE
 * Weekschema als tabel, gespiegeld van `renderScheduleGrid` op de website:
 * een vaste linkerkolom met de eetmomenten en daarnaast één kolom per dag.
 * Elke cel is een fototegel met de receptnaam eroverheen.
 *
 * De dagkolommen schuiven horizontaal weg, zoals de website op smalle schermen
 * doet (`.schedule-table-wrapper { overflow-x: auto }`). De linkerkolom blijft
 * staan, zodat je altijd ziet bij welk eetmoment je kijkt.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ImageBackground,
} from 'react-native';
import { colors, radius, spacing, shadows } from '../constants/theme';
import { SCHEDULE_SLOTS, getSlotLabel } from '../constants/data';
import type { Recipe, RatingSummary } from '../types';

/* Vaste maten: de linkerkolom en de dagkolommen moeten regel per regel
   uitlijnen, en dat lukt alleen met een vaste rijhoogte. */
const HEADER_H = 38;
const CELL_H = 86;
const LABEL_W = 84;
const DAY_W = 96;

interface Props {
  days: readonly string[];
  daysData: Record<string, Record<string, string | null>>;
  recipeMap: Map<string, Recipe>;
  ratings?: Record<string, RatingSummary>;
  onPressRecipe: (recipeId: string) => void;
  /* Alleen het gegenereerde schema laat een slot verversen. */
  onRefreshSlot?: (day: string, slotId: string) => void;
  todayDay?: string;
}

export function ScheduleTable({
  days,
  daysData,
  recipeMap,
  ratings,
  onPressRecipe,
  onRefreshSlot,
  todayDay,
}: Props) {
  return (
    <View style={styles.wrapper}>
      {/* Vaste linkerkolom: hoek + de vijf eetmomenten */}
      <View>
        <View style={[styles.corner, { width: LABEL_W, height: HEADER_H }]} />
        {SCHEDULE_SLOTS.map((slot, i) => (
          <View
            key={slot.id}
            style={[
              styles.rowHeader,
              { width: LABEL_W, height: CELL_H },
              i === SCHEDULE_SLOTS.length - 1 && styles.lastRow,
            ]}
          >
            <Text style={styles.rowHeaderText}>{getSlotLabel(slot.id)}</Text>
          </View>
        ))}
      </View>

      {/* Dagkolommen, horizontaal scrollbaar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={{ flexDirection: 'row' }}>
            {days.map(day => (
              <View
                key={day}
                style={[
                  styles.colHeader,
                  { width: DAY_W, height: HEADER_H },
                  day === todayDay && styles.colHeaderToday,
                ]}
              >
                <Text style={styles.colHeaderText}>
                  {day.substring(0, 2).toUpperCase()}
                </Text>
              </View>
            ))}
          </View>

          {SCHEDULE_SLOTS.map((slot, rowIndex) => (
            <View key={slot.id} style={{ flexDirection: 'row' }}>
              {days.map((day, colIndex) => {
                const recipeId = daysData[day]?.[slot.id] || null;
                const recipe = recipeId ? recipeMap.get(recipeId) : null;
                const rating = recipe && ratings ? ratings[recipe.id] : undefined;

                return (
                  <View
                    key={day}
                    style={[
                      styles.cell,
                      { width: DAY_W, height: CELL_H },
                      colIndex === days.length - 1 && styles.lastCol,
                      rowIndex === SCHEDULE_SLOTS.length - 1 && styles.lastRow,
                    ]}
                  >
                    {recipe ? (
                      <Pressable
                        style={styles.cellFill}
                        onPress={() => onPressRecipe(recipe.id)}
                      >
                        <ImageBackground
                          source={recipe.image ? { uri: recipe.image } : undefined}
                          style={styles.cellFill}
                          imageStyle={styles.cellImage}
                        >
                          <View style={styles.overlay}>
                            <Text style={styles.recipeName} numberOfLines={3}>
                              {recipe.name}
                            </Text>
                            {rating && rating.count > 0 ? (
                              <Text style={styles.ratingText}>
                                {'★'.repeat(Math.round(rating.average))}
                              </Text>
                            ) : null}
                          </View>
                        </ImageBackground>
                      </Pressable>
                    ) : (
                      <View style={styles.cellEmpty}>
                        <Text style={styles.cellEmptyText}>–</Text>
                      </View>
                    )}

                    {onRefreshSlot && (
                      <Pressable
                        style={styles.refreshBtn}
                        onPress={() => onRefreshSlot(day, slot.id)}
                        hitSlop={6}
                      >
                        <Text style={styles.refreshIcon}>↻</Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    overflow: 'hidden',
    marginTop: spacing.lg,
    ...shadows.sm,
  },
  corner: {
    backgroundColor: colors.primary,
  },
  colHeader: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colHeaderToday: {
    backgroundColor: colors.primaryDark,
  },
  colHeaderText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  rowHeader: {
    backgroundColor: colors.greenText,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.18)',
  },
  rowHeaderText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    lineHeight: 14,
  },
  cell: {
    borderBottomWidth: 1,
    borderBottomColor: colors.light,
    borderRightWidth: 1,
    borderRightColor: colors.light,
  },
  lastCol: {
    borderRightWidth: 0,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  cellFill: {
    flex: 1,
  },
  cellImage: {
    resizeMode: 'cover',
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
    padding: 5,
  },
  recipeName: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 13,
  },
  ratingText: {
    color: colors.star,
    fontSize: 9,
    marginTop: 1,
  },
  cellEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellEmptyText: {
    color: colors.grayLight,
    fontSize: 16,
  },
  refreshBtn: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshIcon: {
    color: colors.greenText,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },
});
