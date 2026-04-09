/**
 * STARS
 * Sterren-component voor zowel display als interactief.
 * In display-modus is hij niet aanraakbaar.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors } from '../constants/theme';

interface StarsProps {
  rating: number;
  size?: number;
  interactive?: boolean;
  onChange?: (rating: number) => void;
}

export function Stars({ rating, size = 20, interactive = false, onChange }: StarsProps) {
  const stars = [1, 2, 3, 4, 5];

  return (
    <View style={styles.row}>
      {stars.map(i => {
        const filled = i <= Math.round(rating);
        const star = (
          <Text
            style={{
              fontSize: size,
              color: filled ? colors.star : colors.starEmpty,
              marginRight: 2,
            }}
          >
            ★
          </Text>
        );

        if (interactive && onChange) {
          return (
            <Pressable key={i} onPress={() => onChange(i)} hitSlop={6}>
              {star}
            </Pressable>
          );
        }
        return <View key={i}>{star}</View>;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
