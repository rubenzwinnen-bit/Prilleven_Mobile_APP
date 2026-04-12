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

  /* Laad eerder bewaarde lijst bij start */
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(raw => {
        if (raw) {
          try {
            setListState(JSON.parse(raw));
          } catch {}
        }
      })
      .finally(() => setLoading(false));
  }, []);

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
