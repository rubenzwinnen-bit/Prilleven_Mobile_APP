/**
 * INGREDIENT TILE
 *
 * Vierkante tegel die een ingrediënt toont met emoji-icoon,
 * naam en hoeveelheid. Wordt gedeeld tussen:
 *   - ShoppingListTabScreen (de "Boodschappenlijst" tab)
 *   - ShoppingListScreen    (de genereer/selectie-weergave)
 *
 * Props:
 *   item      — het ingrediënt (uit ShoppingListContext)
 *   inBasket  — true als het al in het winkelmandje zit
 *   onPress   — callback bij tik
 */

import React from 'react';
import { Pressable, Text, Image, StyleSheet } from 'react-native';
import { colors, radius } from '../constants/theme';
import type { AggregatedIngredient } from '../context/ShoppingListContext';

interface IngredientTileProps {
  item: AggregatedIngredient;
  inBasket: boolean;
  onPress: () => void;
}

/** Formatteer een getal: geheel → geen decimalen, anders 1 decimaal met komma. */
function formatAmount(n: number): string {
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(1).replace('.', ',');
}

export function IngredientTile({ item, inBasket, onPress }: IngredientTileProps) {
  return (
    <Pressable
      style={[styles.tile, inBasket && styles.tileBasket]}
      onPress={onPress}
    >
      {item.iconUrl ? (
        <Image
          source={{ uri: item.iconUrl }}
          style={[styles.tileIconImage, inBasket && styles.tileIconBasket]}
        />
      ) : (
        <Text style={[styles.tileIcon, inBasket && styles.tileIconBasket]}>
          {item.icon}
        </Text>
      )}
      <Text
        style={[styles.tileName, inBasket && styles.tileNameBasket]}
        numberOfLines={2}
      >
        {item.name}
      </Text>
      <Text style={[styles.tileAmount, inBasket && styles.tileAmountBasket]}>
        {item.isNumeric
          ? `${formatAmount(item.totalAmount)} ${item.unit}`.trim()
          : item.unit || '—'}
      </Text>
    </Pressable>
  );
}

/* ---- Styles ---- */
const TILE_SIZE = '31%';

export const ingredientTileStyles = StyleSheet.create({
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});

const styles = StyleSheet.create({
  tile: {
    width: TILE_SIZE,
    backgroundColor: '#FAF8F5',
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: '#F0EDE8',
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileBasket: {
    backgroundColor: 'rgba(192, 57, 43, 0.08)',
    borderColor: colors.danger,
  },
  tileIcon: {
    fontSize: 56,
    marginBottom: 6,
  },
  tileIconImage: {
    width: 64,
    height: 64,
    borderRadius: 8,
    marginBottom: 6,
  },
  tileIconBasket: {
    opacity: 0.6,
  },
  tileName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#A89078',
    textAlign: 'center',
  },
  tileNameBasket: {
    color: colors.danger,
    textDecorationLine: 'line-through',
  },
  tileAmount: {
    fontSize: 12,
    color: '#A89078',
    marginTop: 2,
    textAlign: 'center',
  },
  tileAmountBasket: {
    color: colors.danger,
    textDecorationLine: 'line-through',
  },
});
