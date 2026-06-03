/**
 * LANDING TABS — footer-navigatie op het landingscherm
 *
 * Drie tabs in de footer:
 *   Functies     → LandingScreen (de bestaande module-tegels)
 *   Tijdlijn     → TimelineScreen (community-feed)
 *   Chatruimtes  → ChatRoomsStack (rooms → topics → replies)
 *
 * Deze navigator vervangt het losse Landing-scherm in de RootStack.
 * Diepere schermen (Main, HapjesHeld, ...) worden bovenop gepusht en
 * bedekken de footer — die zien we dus alleen op de landing zelf.
 *
 * Notificatie-badges (rode cijfer-rondjes) op twee tabs, gevoed door de
 * NotificationContext:
 *   Tijdlijn (logo) → nieuwe admin-posts in de tijdlijn
 *   Chatruimtes     → som van nieuwe admin-activiteit over alle chatruimtes
 *
 * De Tijdlijn-badge wist bij focus (de feed is dan zichtbaar). De
 * Chatruimtes-badge wist NIET bij het aantikken van de tab — pas wanneer de
 * gebruiker een room opent (zie ChatRoomScreen). Bij focus op de Chatruimtes-
 * tab triggeren we wel een refresh() zodat de teller meteen klopt.
 */

import React from 'react';
import { Image, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { colors } from '../constants/theme';
import type { LandingTabParamList } from './types';
import { LandingScreen } from '../screens/LandingScreen';
import { TimelineScreen } from '../screens/TimelineScreen';
import { ChatRoomsStackNavigator } from './ChatRoomsStack';
import { useNotifications } from '../context/NotificationContext';

const Tabs = createBottomTabNavigator<LandingTabParamList>();

export function LandingTabs() {
  const { timelineCount, chatroomsCount, markTimelineSeen, refresh } =
    useNotifications();

  return (
    <Tabs.Navigator
      initialRouteName="Functies"
      backBehavior="initialRoute"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.gray,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.light,
          height: 74,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        tabBarBadgeStyle: {
          backgroundColor: colors.danger,
          color: colors.white,
          fontSize: 11,
          fontWeight: '700',
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
          tabBarLabel: () => null,
          tabBarBadge: timelineCount > 0 ? timelineCount : undefined,
          tabBarIcon: ({ focused }) => (
            <Image
              source={require('../../assets/prilleven-logo-round.png')}
              style={[styles.logoImage, { opacity: focused ? 1 : 0.7 }]}
              resizeMode="contain"
            />
          ),
        }}
        listeners={{ focus: () => markTimelineSeen() }}
      />
      <Tabs.Screen
        name="Chatruimtes"
        component={ChatRoomsStackNavigator}
        options={{
          tabBarLabel: 'Chatruimtes',
          tabBarBadge: chatroomsCount > 0 ? chatroomsCount : undefined,
          tabBarIcon: ({ color, size }) => (
            <Feather name="users" size={size} color={color} />
          ),
        }}
        listeners={{ focus: () => refresh() }}
      />
    </Tabs.Navigator>
  );
}

const styles = StyleSheet.create({
  logoImage: {
    width: 60,
    height: 60,
    marginTop: 2,
  },
});
