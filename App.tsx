/**
 * APP ROOT
 *
 * Minimale entry point die alleen providers opzet en de
 * navigatie delegeert naar src/navigation/index.tsx.
 *
 * Provider-boom:
 *   SafeAreaProvider
 *     └── ToastProvider
 *           └── UserProvider
 *                 └── NotificationProvider
 *                       └── ShoppingListProvider
 *                             └── AppGate
 *                             ├── AuthScreen          (niet ingelogd)
 *                             └── RootStackNavigator  (ingelogd)
 *                                   ├── Landing       (tegels)
 *                                   ├── Main          (MainTabs)
 *                                   └── HapjesHeld    (chat stack)
 */

import 'react-native-url-polyfill/auto';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';

import { colors } from './src/constants/theme';
import { UserProvider, useUser } from './src/context/UserContext';
import { NotificationProvider } from './src/context/NotificationContext';
import { ShoppingListProvider } from './src/context/ShoppingListContext';
import { ToastProvider } from './src/components/Toast';
import { RootStackNavigator } from './src/navigation/RootStack';
import { navigationRef, PushRouter } from './src/navigation/pushRouting';
import { AuthScreen } from './src/screens/AuthScreen';

/* ----------------------------------------
   Gate – wacht tot sessie is gecheckt
---------------------------------------- */
function AppGate() {
  const { user, loading, setUser } = useUser();

  /* Supabase sessie wordt gecheckt... */
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  /* Niet ingelogd → toon login/register scherm */
  if (!user) {
    return (
      <AuthScreen
        onAuthenticated={async (email) => {
          await setUser(email);
        }}
      />
    );
  }

  /* Ingelogd → toon de app. PushRouter hangt de notificatie-listeners op;
     hij staat binnen de container zodat navigationRef gegarandeerd bestaat. */
  return (
    <NavigationContainer ref={navigationRef}>
      <PushRouter />
      <RootStackNavigator />
    </NavigationContainer>
  );
}

/* ----------------------------------------
   Root
---------------------------------------- */
export default function App() {
  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <ToastProvider>
          <UserProvider>
            <NotificationProvider>
              <ShoppingListProvider>
                <StatusBar style="dark" />
                <AppGate />
              </ShoppingListProvider>
            </NotificationProvider>
          </UserProvider>
        </ToastProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
});
