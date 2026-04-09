/**
 * RECIPE CARD
 * Tegel die in de recepten-lijst en favorieten gebruikt wordt.
 */

import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { colors, radius, spacing, shadows } from '../constants/theme';
import { Stars } from './Stars';
import type { Recipe, RatingSummary } from '../types';
import { getMealMomentLabel } from '../constants/data';

interface RecipeCardProps {
  recipe: Recipe;
  rating?: RatingSummary;
  isFavorite?: boolean;
  onPress: () => void;
  onToggleFavorite?: () => void;
}

export function RecipeCard({
  recipe,
  rating,
  isFavorite,
  onPress,
  onToggleFavorite,
}: RecipeCardProps) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.imageWrap}>
        {recipe.image ? (
          <Image source={{ uri: recipe.image }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.placeholder]}>
            <Text style={styles.placeholderIcon}>🍽️</Text>
          </View>
        )}

        {onToggleFavorite && (
          <Pressable style={styles.favBtn} onPress={onToggleFavorite} hitSlop={10}>
            <Text style={styles.favIcon}>{isFavorite ? '❤️' : '🤍'}</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>
          {recipe.name}
        </Text>

        <View style={styles.tagRow}>
          {(recipe.mealMoments || []).slice(0, 2).map(m => (
            <View key={m} style={styles.tagMoment}>
              <Text style={styles.tagMomentText}>{getMealMomentLabel(m)}</Text>
            </View>
          ))}
          <View style={styles.tagTime}>
            <Text style={styles.tagTimeText}>⏱ {recipe.cookingTime} min</Text>
          </View>
        </View>

        {rating && rating.count > 0 ? (
          <View style={styles.ratingRow}>
            <Stars rating={rating.average} size={14} />
            <Text style={styles.ratingText}>
              {rating.average}/5 ({rating.count})
            </Text>
          </View>
        ) : (
          <Text style={styles.noRating}>Nog geen beoordelingen</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  imageWrap: {
    position: 'relative',
  },
  image: {
    width: '100%',
    height: 180,
    backgroundColor: colors.light,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {
    fontSize: 48,
    color: colors.gray,
  },
  favBtn: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favIcon: {
    fontSize: 18,
  },
  body: {
    padding: spacing.lg,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.dark,
    marginBottom: spacing.sm,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.sm,
  },
  tagMoment: {
    backgroundColor: 'rgba(152, 195, 164, 0.2)',
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  tagMomentText: {
    color: '#4a7c59',
    fontSize: 12,
    fontWeight: '500',
  },
  tagTime: {
    backgroundColor: 'rgba(152, 195, 164, 0.15)',
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  tagTimeText: {
    color: '#4a7c59',
    fontSize: 12,
    fontWeight: '500',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ratingText: {
    fontSize: 12,
    color: colors.gray,
  },
  noRating: {
    fontSize: 12,
    color: colors.gray,
    fontStyle: 'italic',
  },
});
