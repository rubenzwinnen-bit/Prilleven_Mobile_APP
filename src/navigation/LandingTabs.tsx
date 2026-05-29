/**
 * LANDING TABS — footer-navigatie op het landingscherm
 *
 * Drie tabs in de footer:
 *   Functies     → LandingScreen (de bestaande module-tegels)
 *   Tijdlijn     → TimelineScreen (community-feed)
 *   Chatruimtes  → ChatRoomsScreen (placeholder, komt later)
 *
 * Deze navigator vervangt het losse Landing-scherm in de RootStack.
 * Diepere schermen (Main, HapjesHeld, ...) worden bovenop gepusht en
 * bedekken de footer — die zien we dus alleen op de landing zelf.
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { colors } from '../constants/theme';
import type { LandingTabParamList } from './types';
import { LandingScreen } from '../screens/LandingScreen';
import { TimelineScreen } from '../screens/TimelineScreen';
import { ChatRoomsScreen } from '../screens/ChatRoomsScreen';

const Tabs = createBottomTabNavigator<LandingTabParamList>();

export function LandingTabs() {
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
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="Functies"
        component={LandingScreen}
        options={{
          tabBarLabel: 'Functies',
          tabBarIcon: ({ color, size }) => (
            <Feather name="grid" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="Tijdlijn"
        component={TimelineScreen}
        options={{
          tabBarLabel: 'Tijdlijn',
          tabBarIcon: ({ color, size }) => (
            <Feather name="message-square" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="Chatruimtes"
        component={ChatRoomsScreen}
        options={{
          tabBarLabel: 'Chatruimtes',
          tabBarIcon: ({ color, size }) => (
            <Feather name="users" size={size} color={color} />
          ),
        }}
      />
    </Tabs.Navigator>
  );
}
