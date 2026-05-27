/**
 * NAVIGATIE TYPES
 *
 * Definieert de route-namen en hun parameters voor elke stack
 * en de bottom tabs. Hierdoor geeft TypeScript foutmeldingen
 * als je een verkeerde route-naam of paramater gebruikt.
 *
 * Gebruik in een screen:
 *   import type { RecipesStackParamList } from '../navigation/types';
 *   import type { NativeStackScreenProps } from '@react-navigation/native-stack';
 *   type Props = NativeStackScreenProps<RecipesStackParamList, 'RecipeDetail'>;
 */

import type { NavigatorScreenParams } from '@react-navigation/native';

/* ---- Root Stack (Landing → Main of HapjesHeld of Profile) ---- */
export type RootStackParamList = {
  Landing: undefined;
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  HapjesHeld: NavigatorScreenParams<HapjesHeldStackParamList> | undefined;
  Profile: undefined;
  Children: undefined;
  ChildForm: { childId?: string };
};

/* ---- Bottom Tabs ---- */
export type MainTabParamList = {
  Recepten: NavigatorScreenParams<RecipesStackParamList>;
  Weekschema: NavigatorScreenParams<ScheduleStackParamList>;
  Favorieten: NavigatorScreenParams<FavoritesStackParamList>;
  Boodschappenlijst: undefined;
};

/* ---- HapjesHeld 2.0 stack ---- */
export type HapjesHeldStackParamList = {
  Conversations: undefined;
  Chat: { conversationId?: string } | undefined;
};

/* ---- Recepten tab stack ---- */
export type RecipesStackParamList = {
  RecipeList: undefined;
  RecipeDetail: { id: string };
};

/* ---- Weekschema tab stack ---- */
export type ScheduleStackParamList = {
  WeekSchedule: undefined;
  ShoppingList: { id: string };
  RecipeDetail: { id: string };
};

/* ---- Favorieten tab stack ---- */
export type FavoritesStackParamList = {
  FavoritesList: undefined;
  RecipeDetail: { id: string };
  ShoppingList: { id: string };
};
