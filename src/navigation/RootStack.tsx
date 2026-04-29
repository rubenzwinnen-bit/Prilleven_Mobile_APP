/**
 * ROOT STACK
 *
 * Bovenste laag van de navigatie (na login). Bestaat uit:
 *   Landing     — LandingScreen met de 2 module-tegels
 *   Main        — MainTabs (Recepten / Weekschema / Favorieten / Boodschappen)
 *   HapjesHeld  — HapjesHeld 2.0 chat module
 *
 * De LandingScreen heeft geen header. Main en HapjesHeld
 * krijgen een back-button in hun eigen header zodat je altijd
 * terug kan naar de landing.
 */

import React, { useCallback } from 'react';
import { TouchableOpacity, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing } from '../constants/theme';
import { LandingScreen } from '../screens/LandingScreen';
import { MainTabs } from './index';
import { HapjesHeldStackNavigator } from './HapjesHeldStack';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/* Chevron back-knop (linksboven) */
function ChevronBack({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={12}
      style={{ paddingRight: spacing.md }}
    >
      <Text
        style={{
          fontSize: 28,
          color: colors.primary,
          fontWeight: '300',
          marginTop: -2,
        }}
      >
        ‹
      </Text>
    </TouchableOpacity>
  );
}

/* Huisje home-knop (rechtsboven) — gaat altijd naar Landing
   Sage-groene cirkel met witte Feather "home" outline icon. */
function HomeIconButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} hitSlop={12}>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: colors.secondary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Feather name="home" size={20} color={colors.white} />
      </View>
    </TouchableOpacity>
  );
}

/* Vaste hoogte voor de inhoud van álle compacte headers — voorkomt
   layout-shift / "schok" bij navigatie tussen schermen waar de header
   verschillende elementen bevat (chevron, huisje, zoekveld...). */
export const HEADER_CONTENT_HEIGHT = 42;

/* Generieke compacte header — minimale hoogte. Toont links altijd een
   chevron, rechts optioneel een huisje als `onHome` is meegegeven. */
function CompactHeader({
  onBack,
  onHome,
}: {
  onBack: () => void;
  onHome?: () => void;
}) {
  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: colors.bg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.md,
          height: HEADER_CONTENT_HEIGHT,
        }}
      >
        <ChevronBack onPress={onBack} />
        {onHome ? <HomeIconButton onPress={onHome} /> : <View />}
      </View>
    </SafeAreaView>
  );
}

/* Header voor Main — alleen chevron terug naar Landing
   (huisje weggelaten omdat de chevron hetzelfde doet). */
function MainHeader({ navigation }: { navigation: any }) {
  return <CompactHeader onBack={() => navigation.goBack()} />;
}

/* Hook voor tab-schermen die geen custom header nodig hebben.
   Zet bij elke focus de standaard MainHeader terug op de RootStack
   Main-screen. Voorkomt dat een custom header (bv. die van RecipeList)
   blijft hangen wanneer je naar een andere tab overschakelt.

   `levelsUp` = aantal getParent() calls om RootStack te bereiken:
     • 1 voor schermen direct in MainTabs (zoals Boodschappenlijst tab)
     • 2 voor schermen in een sub-stack (Recepten/Schema/Favorieten) */
function useResetMainHeader(navigation: any, levelsUp: 1 | 2 = 2) {
  useFocusEffect(
    useCallback(() => {
      let nav = navigation;
      for (let i = 0; i < levelsUp; i++) {
        nav = nav?.getParent();
      }
      if (!nav) return;
      nav.setOptions({
        header: () => <MainHeader navigation={nav} />,
      });
    }, [navigation, levelsUp])
  );
}

export function RootStackNavigator() {
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
        name="Landing"
        component={LandingScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Main"
        component={MainTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="HapjesHeld"
        component={HapjesHeldStackNavigator}
        options={{
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
}

/* Re-export voor de inner stacks zodat ze dezelfde knoppen kunnen gebruiken */
export { ChevronBack, HomeIconButton, CompactHeader, MainHeader, useResetMainHeader };
