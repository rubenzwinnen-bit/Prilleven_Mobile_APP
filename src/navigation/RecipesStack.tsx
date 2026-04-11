/**
 * RECIPES STACK
 *
 * Navigatie binnen de "Recepten" tab:
 *   RecipeList → RecipeDetail
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RecipesStackParamList } from './types';
import { RecipeListScreen } from '../screens/RecipeListScreen';
import { RecipeDetailScreen } from '../screens/RecipeDetailScreen';

const Stack = createNativeStackNavigator<RecipesStackParamList>();

export function RecipesStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="RecipeList" component={RecipeListScreen} />
      <Stack.Screen name="RecipeDetail" component={RecipeDetailScreen} />
    </Stack.Navigator>
  );
}
