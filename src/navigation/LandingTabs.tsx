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
 */

import React from 'react';
import { Image, View, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { colors } from '../constants/theme';
import type { LandingTabParamList } from './types';
import { LandingScreen } from '../screens/LandingScreen';
import { TimelineScreen } from '../screens/TimelineScreen';
import { ChatRoomsStackNavigator } from './ChatRoomsStack';

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
          height: 74,
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
          tabBarLabel: () => null,
          tabBarIcon: ({ focused }) => (
            <View style={[styles.logoCircle, { opacity: focused ? 1 : 0.7 }]}>
              <Image
                source={require('../../assets/prilleven-logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="Chatruimtes"
        component={ChatRoomsStackNavigator}
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

const styles = StyleSheet.create({
  logoCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -22,
    borderWidth: 1,
    borderColor: colors.light,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 4,
  },
  logoImage: {
    width: 46,
    height: 46,
  },
});
