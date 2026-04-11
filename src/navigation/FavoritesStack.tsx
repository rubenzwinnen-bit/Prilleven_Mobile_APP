/**
 * FAVORITES STACK
 *
 * Navigatie binnen de "Favorieten" tab:
 *   FavoritesList → RecipeDetail
 *                 → ShoppingList (selectie)
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { FavoritesStackParamList } from './types';
import { FavoritesScreen } from '../screens/FavoritesScreen';
import { RecipeDetailScreen } from '../screens/RecipeDetailScreen';
import { ShoppingListScreen } from '../screens/ShoppingListScreen';

const Stack = createNativeStackNavigator<FavoritesStackParamList>();

export function FavoritesStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="FavoritesList" component={FavoritesScreen} />
      <Stack.Screen name="RecipeDetail" component={RecipeDetailScreen} />
      <Stack.Screen name="ShoppingList" component={ShoppingListScreen} />
    </Stack.Navigator>
  );
}
