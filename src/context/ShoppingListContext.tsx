/**
 * SHOPPING LIST CONTEXT
 *
 * Bewaart de huidige gegenereerde boodschappenlijst zodat deze
 * leeft tussen tabs en herstarts. Wordt persistent opgeslagen in
 * AsyncStorage zodat de gebruiker een gegenereerde lijst niet
 * verliest als hij/zij de app sluit.
 *
 * De BoodschappenlijstScreen leest hier zijn data uit; de
 * "selecteer & genereer" stap zit nog in ShoppingListScreen
 * (in de Weekschema-/Favorieten-stack), die na het genereren
 * hiernaartoe schrijft en doornavigeert naar de tab.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getIngredientIconMaps } from '../services/ingredientIcons';
import { normalizeIngredientName } from '../constants/ingredientIcons';

const STORAGE_KEY = 'receptenboek_shoppinglist_v1';

export interface AggregatedIngredient {
  key: string;
  name: string;
  icon: string;
  iconUrl?: string;
  totalAmount: number;
  unit: string;
  isNumeric: boolean;
}

export interface ShoppingList {
  scheduleId: string;
  scheduleName: string;
  generatedAt: number;
  ingredients: AggregatedIngredient[];
  basket: string[]; // keys van ingrediënten die al in 't mandje zitten
  persons?: number; // aantal personen (als actief weekschema)
}

interface ShoppingListContextValue {
  list: ShoppingList | null;
  loading: boolean;
  setList: (list: ShoppingList) => Promise<void>;
  clearList: () => Promise<void>;
  moveToBasket: (key: string) => Promise<void>;
  moveBackToList: (key: string) => Promise<void>;
}

const Ctx = createContext<ShoppingListContextValue>({
  list: null,
  loading: true,
  setList: async () => {},
  clearList: async () => {},
  moveToBasket: async () => {},
  moveBackToList: async () => {},
});

export function ShoppingListProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [list, setListState] = useState<ShoppingList | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * Ververs icoon-URLs én admin-display-namen op de ingrediënten in
   * een lijst. Haalt de laatste data op uit Supabase en update de
   * lijst (en AsyncStorage) wanneer er iets gewijzigd is.
   */
  const refreshIconUrls = useCallback(async (currentList: ShoppingList): Promise<ShoppingList> => {
    try {
      const { iconUrl: iconMap, displayName: nameMap } = await getIngredientIconMaps();
      if (iconMap.size === 0 && nameMap.size === 0) return currentList;

      let changed = false;
      const updatedIngredients = currentList.ingredients.map(ing => {
        // Gebruik de STABIELE genormaliseerde sleutel (key = "normalized|unit"),
        // niet de (mogelijk al door een vorige refresh vervangen) display-naam.
        // Anders drift de lookup bij elke refresh weg: "goji bessen" → "goji bess"
        // → display "Goji Bess" → bij de volgende refresh normalize("Goji Bess")
        // → "goji bes" → "Goji Bes" → "goji be" → geen match meer (emoji-fallback).
        const normalized = ing.key.split('|')[0] || normalizeIngredientName(ing.name);
        const newUrl = iconMap.get(normalized) || undefined;
        const adminName = nameMap.get(normalized);
        const newName = adminName || ing.name;

        if (newUrl !== ing.iconUrl || newName !== ing.name) {
          changed = true;
          return { ...ing, iconUrl: newUrl, name: newName };
        }
        return ing;
      });

      if (changed) {
        const updated = { ...currentList, ingredients: updatedIngredients };
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return updated;
      }
    } catch {
      // Refresh is non-critical — silently continue
    }
    return currentList;
  }, []);

  /* Laad eerder bewaarde lijst bij start + ververs iconen */
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(async raw => {
        if (raw) {
          try {
            let parsed: ShoppingList = JSON.parse(raw);
            // Ververs icoon-URLs in de achtergrond
            parsed = await refreshIconUrls(parsed);
            setListState(parsed);
          } catch {}
        }
      })
      .finally(() => setLoading(false));
  }, [refreshIconUrls]);

  const persist = useCallback(async (next: ShoppingList | null) => {
    setListState(next);
    if (next) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } else {
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const setList = useCallback(
    async (next: ShoppingList) => {
      await persist(next);
    },
    [persist]
  );

  const clearList = useCallback(async () => {
    await persist(null);
  }, [persist]);

  const moveToBasket = useCallback(
    async (key: string) => {
      if (!list) return;
      if (list.basket.includes(key)) return;
      await persist({ ...list, basket: [...list.basket, key] });
    },
    [list, persist]
  );

  const moveBackToList = useCallback(
    async (key: string) => {
      if (!list) return;
      await persist({
        ...list,
        basket: list.basket.filter(k => k !== key),
      });
    },
    [list, persist]
  );

  return (
    <Ctx.Provider
      value={{ list, loading, setList, clearList, moveToBasket, moveBackToList }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useShoppingList() {
  return useContext(Ctx);
}
