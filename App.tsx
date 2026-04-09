/**
 * APP ROOT
 *
 * Wires up:
 *  - SafeAreaProvider (voor notch / status bar)
 *  - UserProvider     (gebruikersnaam in AsyncStorage)
 *  - ToastProvider    (toasts in alle screens)
 *  - NavigationContainer
 *      └── Bottom Tabs
 *            ├── Recepten (Stack: List → Detail)
 *            ├── Weekschema (Stack: Generator → ShoppingList)
 *            └── Favorieten (Stack: List → Detail / ShoppingList)
 *
 * Bij eerste launch verschijnt automatisch de UsernameModal.
 */

import 'react-native-url-polyfill/auto';
import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Text, View, ActivityIndicator, StyleSheet, Pressable } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { colors } from './src/constants/theme';
import { UserProvider, useUser } from './src/context/UserContext';
import { ToastProvider } from './src/components/Toast';
import { UsernameModal } from './src/components/UsernameModal';

import { RecipeListScreen } from './src/screens/RecipeListScreen';
import { RecipeDetailScreen } from './src/screens/RecipeDetailScreen';
import { FavoritesScreen } from './src/screens/FavoritesScreen';
import { WeekScheduleScreen } from './src/screens/WeekScheduleScreen';
import { ShoppingListScreen } from './src/screens/ShoppingListScreen';

/* ----------------------------------------
   Stack navigators (één per tab)
---------------------------------------- */
const RecipesStack = createNativeStackNavigator();
function RecipesStackNavigator() {
  return (
    <RecipesStack.Navigator screenOptions={{ headerShown: false }}>
      <RecipesStack.Screen name="RecipeList" component={RecipeListScreen} />
      <RecipesStack.Screen name="RecipeDetail" component={RecipeDetailScreen} />
    </RecipesStack.Navigator>
  );
}

const ScheduleStack = createNativeStackNavigator();
function ScheduleStackNavigator() {
  return (
    <ScheduleStack.Navigator screenOptions={{ headerShown: false }}>
      <ScheduleStack.Screen name="WeekSchedule" component={WeekScheduleScreen} />
      <ScheduleStack.Screen name="ShoppingList" component={ShoppingListScreen} />
      <ScheduleStack.Screen name="RecipeDetail" component={RecipeDetailScreen} />
    </ScheduleStack.Navigator>
  );
}

const FavoritesStack = createNativeStackNavigator();
function FavoritesStackNavigator() {
  return (
    <FavoritesStack.Navigator screenOptions={{ headerShown: false }}>
      <FavoritesStack.Screen name="FavoritesList" component={FavoritesScreen} />
      <FavoritesStack.Screen name="RecipeDetail" component={RecipeDetailScreen} />
      <FavoritesStack.Screen name="ShoppingList" component={ShoppingListScreen} />
    </FavoritesStack.Navigator>
  );
}

/* ----------------------------------------
   Bottom tabs
---------------------------------------- */
const Tabs = createBottomTabNavigator();
function MainTabs() {
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
    </Tabs.Navigator>
  );
}

/* ----------------------------------------
   Gate – wacht tot user is geladen
---------------------------------------- */
function AppGate() {
  const { user, loading, setUser } = useUser();
  const [showRename, setShowRename] = useState(false);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  /* Geen gebruikersnaam? Toon modal en blokkeer de app. */
  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={styles.welcomeIcon}>🍳</Text>
        <Text style={styles.welcomeTitle}>Prilleven Receptenboek</Text>
        <Text style={styles.welcomeSubtitle}>
          Welkom! Vertel ons wie je bent om te starten.
        </Text>
        <UsernameModal
          visible
          onSubmit={async (name) => {
            await setUser(name);
          }}
        />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <MainTabs />
      <UsernameModal
        visible={showRename}
        initialName={user}
        title="Wijzig je gebruikersnaam"
        onSubmit={async (name) => {
          await setUser(name);
          setShowRename(false);
        }}
        onCancel={() => setShowRename(false)}
      />
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
          <StatusBar style="dark" />
          <AppGate />
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
  welcomeIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.dark,
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 15,
    color: colors.gray,
    textAlign: 'center',
  },
});
