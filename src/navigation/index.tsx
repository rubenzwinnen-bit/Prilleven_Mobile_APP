/**
 * MAIN NAVIGATION
 *
 * Combineert alle stacks in een bottom-tab navigator.
 * Dit is het enige navigatie-bestand dat App.tsx importeert.
 *
 * Tabs:
 *   🍽️ Recepten        → RecipesStack
 *   📅 Weekschema      → ScheduleStack
 *   ❤️ Favorieten      → FavoritesStack
 *   🛒 Boodschappen    → ShoppingListTabScreen (geen stack nodig)
 */

import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { colors } from '../constants/theme';
import type { MainTabParamList } from './types';

import { RecipesStackNavigator } from './RecipesStack';
import { ScheduleStackNavigator } from './ScheduleStack';
import { FavoritesStackNavigator } from './FavoritesStack';
import { ShoppingListTabScreen } from '../screens/ShoppingListTabScreen';

const Tabs = createBottomTabNavigator<MainTabParamList>();

export function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.gray,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.light,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="Recepten"
        component={RecipesStackNavigator}
        options={{
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 22, color }}>🍽️</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="Weekschema"
        component={ScheduleStackNavigator}
        options={{
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 22, color }}>📅</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="Favorieten"
        component={FavoritesStackNavigator}
        options={{
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 22, color }}>❤️</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="Boodschappenlijst"
        component={ShoppingListTabScreen}
        options={{
          tabBarLabel: 'Boodschappen',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 22, color }}>🛒</Text>
          ),
        }}
      />
    </Tabs.Navigator>
  );
}
