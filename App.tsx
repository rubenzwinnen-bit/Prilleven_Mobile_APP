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
 *                 └── ShoppingListProvider
 *                       └── AppGate
 *                             ├── AuthScreen     (niet ingelogd)
 *                             └── MainTabs       (ingelogd)
 */

import 'react-native-url-polyfill/auto';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';

import { colors } from './src/constants/theme';
import { UserProvider, useUser } from './src/context/UserContext';
import { ShoppingListProvider } from './src/context/ShoppingListContext';
import { ToastProvider } from './src/components/Toast';
import { MainTabs } from './src/navigation';
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

  /* Ingelogd → toon de app */
  return (
    <NavigationContainer>
      <MainTabs />
    </NavigationContainer>
  );
}

/* ----------------------------------------
   Root
---------------------------------------- */
export default function App() {
  return (
    <SafeAreaProvider>
      <ToastProvider>
        <UserProvider>
          <ShoppingListProvider>
            <StatusBar style="dark" />
            <AppGate />
          </ShoppingListProvider>
        </UserProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
});
