/**
 * MAIN NAVIGATION
 *
 * Combineert alle stacks in een bottom-tab navigator.
 * Dit is het enige navigatie-bestand dat App.tsx importeert.
 *
 * Tabs (alleen iconen, geen labels):
 *   Recepten        → RecipesStack          (groen-bestek)
 *   Weekschema      → ScheduleStack         (groen-kalender)
 *   Favorieten      → FavoritesStack        (groen-hart)
 *   Boodschappen    → ShoppingListTabScreen (groen-mandje)
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { colors } from '../constants/theme';
import type { MainTabParamList } from './types';

import { RecipesStackNavigator } from './RecipesStack';
import { ScheduleStackNavigator } from './ScheduleStack';
import { FavoritesStackNavigator } from './FavoritesStack';
import { ShoppingListTabScreen } from '../screens/ShoppingListTabScreen';
import {
  RecipesIcon,
  ScheduleIcon,
  FavoritesIcon,
  ShoppingIcon,
} from '../components/TabIcons';

const Tabs = createBottomTabNavigator<MainTabParamList>();

export function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.gray,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.light,
          height: 60,
          paddingTop: 0,
          paddingBottom: 0,
        },
        tabBarItemStyle: {
          height: 60,
          justifyContent: 'flex-end',
          alignItems: 'center',
          paddingTop: 0,
          paddingBottom: 2,
        },
      }}
    >
      <Tabs.Screen
        name="Recepten"
        component={RecipesStackNavigator}
        options={{
          tabBarIcon: ({ focused }) => <RecipesIcon focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="Weekschema"
        component={ScheduleStackNavigator}
        options={{
          tabBarIcon: ({ focused }) => <ScheduleIcon focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="Favorieten"
        component={FavoritesStackNavigator}
        options={{
          tabBarIcon: ({ focused }) => <FavoritesIcon focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="Boodschappenlijst"
        component={ShoppingListTabScreen}
        options={{
          tabBarIcon: ({ focused }) => <ShoppingIcon focused={focused} />,
        }}
      />
    </Tabs.Navigator>
  );
}
