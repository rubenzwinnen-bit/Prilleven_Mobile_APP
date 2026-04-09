/**
 * GEDEELDE TYPES
 * Komt overeen met de DB-structuur die de website ook gebruikt.
 */

export interface Ingredient {
  name: string;
  amount: string | number;
  unit: string;
}

export interface Recipe {
  id: string;
  name: string;
  image: string;
  mealMoments: string[];
  cookingTime: number;
  portions: number;
  ingredients: Ingredient[];
  allergens: string[];
  preparation: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  date: string;
}

export interface RatingSummary {
  average: number;
  count: number;
}

export interface Schedule {
  id: string;
  name: string;
  days: Record<string, Record<string, string | null>>;
  excludedAllergens: string[];
  createdAt?: string;
}

export interface ActiveSchedule {
  days: Record<string, Record<string, string | null>>;
  excludedAllergens: string[];
  generatedAt: string;
}
