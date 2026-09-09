/**
 * ACTIVE DAY BLOCKS
 * Het actieve weekschema als dagkaarten met fototegels, gespiegeld van
 * `renderActiveDays` op de website (`.active-day-block` / `.active-meal-card`).
 *
 * Per dag één kaart met de dagnaam en, op vandaag, een groene VANDAAG-badge.
 * Daarin de vijf eetmomenten als tegels: foto boven, daaronder het eetmoment
 * in groen kapitaal en de receptnaam.
 *
 * Waar de website vijf tegels naast elkaar in een grid zet, schuiven ze hier
 * horizontaal. Vijf kolommen zou op een telefoon neerkomen op tegels van zo'n
 * 60 punten: te smal voor een leesbare receptnaam.
 *
 * Een afgevinkte tegel (Cooked it) krijgt een groene rand, een groene titel en
 * een vinkje op de foto — spiegel van `.active-meal-card.is-cooked`. Welke
 * tegels dat zijn komt via `cookedKeys` binnen; het afvinken zelf gebeurt op
 * het receptdetail.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
} from 'react-native';
import { colors, spacing } from '../constants/theme';
import { SCHEDULE_SLOTS, getSlotLabel } from '../constants/data';
import { mealKey } from '../lib/cookingProgress';
import type { Recipe } from '../types';

/* Smal genoeg om er bijna drie tegelijk te zien — zo blijft het schuiven kort
   — en breed genoeg voor een receptnaam van twee regels. */
const CARD_W = 120;
const MEDIA_H = 75; /* ~16:10 op 120 breed */

interface Props {
  days: readonly string[];
  daysData: Record<string, Record<string, string | null>>;
  recipeMap: Map<string, Recipe>;
  onPressRecipe: (recipeId: string) => void;
  todayDay?: string;
  /** Sleutels uit `mealKey(day, slot, recipeId)` die deze week afgevinkt zijn. */
  cookedKeys?: Set<string>;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function ActiveDayBlocks({
  days,
  daysData,
  recipeMap,
  onPressRecipe,
  todayDay,
  cookedKeys,
}: Props) {
  return (
    <>
      {days.map(day => {
        const dayData = daysData[day] || {};
        const isToday = day === todayDay;

        return (
          <View
            key={day}
            style={[styles.dayBlock, isToday && styles.dayBlockToday]}
          >
            <View style={styles.dayHeader}>
              <Text style={styles.dayHeaderText}>{capitalize(day)}</Text>
              {isToday && (
                <View style={styles.todayBadge}>
                  <Text style={styles.todayBadgeText}>Vandaag</Text>
                </View>
              )}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.mealRow}
            >
              {SCHEDULE_SLOTS.map(slot => {
                const recipeId = dayData[slot.id];
                const recipe = recipeId ? recipeMap.get(recipeId) : null;
                const slotLabel = getSlotLabel(slot.id);

                if (!recipe) {
                  return (
                    <View key={slot.id} style={[styles.mealCard, styles.mealCardEmpty]}>
                      <View style={[styles.media, styles.mediaPlaceholder]}>
                        <Text style={styles.placeholderText}>Geen foto</Text>
                      </View>
                      <View style={styles.mealBody}>
                        <Text style={styles.mealSlot}>{slotLabel}</Text>
                        <Text style={styles.mealEmpty} numberOfLines={2}>
                          Geen recept gepland
                        </Text>
                      </View>
                    </View>
                  );
                }

                const isCooked = Boolean(
                  cookedKeys?.has(mealKey(day, slot.id, recipe.id))
                );

                return (
                  <Pressable
                    key={slot.id}
                    style={[styles.mealCard, isCooked && styles.mealCardCooked]}
                    onPress={() => onPressRecipe(recipe.id)}
                  >
                    <View>
                      {recipe.image ? (
                        <Image source={{ uri: recipe.image }} style={styles.media} />
                      ) : (
                        <View style={[styles.media, styles.mediaPlaceholder]}>
                          <Text style={styles.placeholderText}>Geen foto</Text>
                        </View>
                      )}
                      {isCooked && (
                        <View style={styles.cookedBadge}>
                          <Text style={styles.cookedBadgeText}>✓</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.mealBody}>
                      <Text style={styles.mealSlot}>{slotLabel}</Text>
                      <Text
                        style={[styles.mealName, isCooked && styles.mealNameCooked]}
                        numberOfLines={2}
                      >
                        {recipe.name}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  dayBlock: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: 'rgba(79, 125, 108, 0.14)',
    borderRadius: 18,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  dayBlockToday: {
    borderColor: colors.primary,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  dayHeaderText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.dark,
  },
  todayBadge: {
    backgroundColor: colors.greenText,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 12,
  },
  todayBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mealRow: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  mealCard: {
    width: CARD_W,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: 'rgba(79, 125, 108, 0.16)',
    borderRadius: 13,
    overflow: 'hidden',
  },
  mealCardEmpty: {
    opacity: 0.85,
  },
  /* Spiegel van .active-meal-card.is-cooked */
  mealCardCooked: {
    borderColor: 'rgba(79, 125, 108, 0.5)',
    backgroundColor: 'rgba(79, 125, 108, 0.055)',
  },
  cookedBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.greenText,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cookedBadgeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },
  media: {
    width: '100%',
    height: MEDIA_H,
    backgroundColor: 'rgba(79, 125, 108, 0.075)',
  },
  mediaPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: colors.gray,
    fontSize: 11,
  },
  mealBody: {
    minHeight: 58,
    paddingHorizontal: 7,
    paddingTop: 7,
    paddingBottom: spacing.sm,
    gap: 2,
  },
  mealSlot: {
    color: colors.greenText,
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  mealName: {
    color: colors.dark,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  mealNameCooked: {
    color: colors.greenText,
  },
  mealEmpty: {
    color: colors.gray,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
});
