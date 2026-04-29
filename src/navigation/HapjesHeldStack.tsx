/**
 * HAPJESHELD STACK
 *
 * Stack voor de HapjesHeld 2.0 chat module.
 *   Conversations  — lijst met oude gesprekken (start-scherm)
 *   Chat           — het chat scherm (met optionele conversationId)
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../constants/theme';
import { HapjesHeldScreen } from '../screens/HapjesHeldScreen';
import { ConversationsScreen } from '../screens/ConversationsScreen';
import { ChevronBack, HomeIconButton } from './RootStack';
import type { HapjesHeldStackParamList } from './types';

const Stack = createNativeStackNavigator<HapjesHeldStackParamList>();

export function HapjesHeldStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.primary,
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="Conversations"
        component={ConversationsScreen}
        options={({ navigation }) => ({
          title: 'HapjesHeld 2.0',
          headerBackVisible: false,
          headerLeft: () => (
            <ChevronBack onPress={() => navigation.getParent()?.goBack()} />
          ),
        })}
      />
      <Stack.Screen
        name="Chat"
        component={HapjesHeldScreen}
        options={({ navigation }) => ({
          title: 'HapjesHeld',
          headerBackVisible: false,
          headerLeft: () => <ChevronBack onPress={() => navigation.goBack()} />,
          headerRight: () => (
            <HomeIconButton
              onPress={() => navigation.getParent()?.goBack()}
            />
          ),
        })}
      />
    </Stack.Navigator>
  );
}
