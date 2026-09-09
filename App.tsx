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
 *                             ├── AuthScreen                   (niet ingelogd)
 *                             ├── SubscriptionExpiredScreen    (lidmaatschap verlopen)
 *                             └── RootStackNavigator           (ingelogd)
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
import { SubscriptionExpiredScreen } from './src/screens/SubscriptionExpiredScreen';
import { useSubscriptionGate } from './src/lib/useSubscriptionGate';

/* ----------------------------------------
   Gate – wacht tot sessie is gecheckt
---------------------------------------- */
function AppGate() {
  const { user, loading, setUser, logout } = useUser();
  const { status, geblokkeerd, recheck } = useSubscriptionGate(user);

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

  /* Ingelogd, maar de server zegt dat het lidmaatschap niet meer loopt.
     Dit scherm staat bewust vóór de NavigationContainer: er valt niets te
     navigeren en de gebruiker mag er niet omheen. Alleen een expliciet
     serverantwoord komt hier terecht — bij een netwerkfout is de gate
     fail-open en gaat de app gewoon open. */
  if (geblokkeerd) {
    return (
      <SubscriptionExpiredScreen
        status={status}
        onRecheck={recheck}
        onLogout={logout}
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
