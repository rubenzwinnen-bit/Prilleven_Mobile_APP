/**
 * SCHEDULE STACK
 *
 * Navigatie binnen de "Weekschema" tab:
 *   WeekSchedule → ShoppingList (selectie) → RecipeDetail
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ScheduleStackParamList } from './types';
import { WeekScheduleScreen } from '../screens/WeekScheduleScreen';
import { ShoppingListScreen } from '../screens/ShoppingListScreen';
import { RecipeDetailScreen } from '../screens/RecipeDetailScreen';

const Stack = createNativeStackNavigator<ScheduleStackParamList>();

export function ScheduleStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="WeekSchedule" component={WeekScheduleScreen} />
      <Stack.Screen name="ShoppingList" component={ShoppingListScreen} />
      <Stack.Screen name="RecipeDetail" component={RecipeDetailScreen} />
    </Stack.Navigator>
  );
}
