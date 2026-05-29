/**
 * CHATRUIMTES STACK
 *
 * Stack achter de Chatruimtes-footertab op de landing.
 *   RoomList       — overzicht van de 4 vaste rooms (tab-root, geen back)
 *   ChatRoom       — topics binnen een room + admin-intro + nieuw-topic
 *   ChatTopic      — topic-body + replies + reply-composer
 *   ChatTopicForm  — topic aanmaken of bewerken
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../constants/theme';
import { ChevronBack } from './RootStack';
import type { ChatRoomsStackParamList } from './types';
import { ChatRoomsListScreen } from '../screens/ChatRoomsListScreen';
import { ChatRoomScreen } from '../screens/ChatRoomScreen';
import { ChatTopicScreen } from '../screens/ChatTopicScreen';
import { ChatTopicFormScreen } from '../screens/ChatTopicFormScreen';

const Stack = createNativeStackNavigator<ChatRoomsStackParamList>();

export function ChatRoomsStackNavigator() {
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
        name="RoomList"
        component={ChatRoomsListScreen}
        options={{ title: 'Chatruimtes', headerShown: false }}
      />
      <Stack.Screen
        name="ChatRoom"
        component={ChatRoomScreen}
        options={({ navigation, route }) => ({
          title: route.params?.title ?? 'Chatruimte',
          headerBackVisible: false,
          headerLeft: () => <ChevronBack onPress={() => navigation.goBack()} />,
        })}
      />
      <Stack.Screen
        name="ChatTopic"
        component={ChatTopicScreen}
        options={({ navigation }) => ({
          title: 'Topic',
          headerBackVisible: false,
          headerLeft: () => <ChevronBack onPress={() => navigation.goBack()} />,
        })}
      />
      <Stack.Screen
        name="ChatTopicForm"
        component={ChatTopicFormScreen}
        options={({ navigation, route }) => ({
          title: route.params?.topicId ? 'Topic bewerken' : 'Nieuw topic',
          headerBackVisible: false,
          headerLeft: () => <ChevronBack onPress={() => navigation.goBack()} />,
        })}
      />
    </Stack.Navigator>
  );
}
