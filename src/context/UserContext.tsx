/**
 * USER CONTEXT
 * Houdt de huidige gebruikersnaam bij. Wordt op de eerste
 * launch gevraagd via een modal en bewaard in AsyncStorage.
 *
 * Komt overeen met de webversie die de gebruikersnaam
 * in localStorage bewaart.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearCache } from '../lib/store';

const USER_KEY = 'receptenboek_user';

interface UserContextValue {
  user: string;
  loading: boolean;
  setUser: (name: string) => Promise<void>;
}

const UserContext = createContext<UserContextValue>({
  user: '',
  loading: true,
  setUser: async () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    AsyncStorage.getItem(USER_KEY)
      .then(stored => {
        if (stored) setUserState(stored);
      })
      .finally(() => setLoading(false));
  }, []);

  const setUser = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await AsyncStorage.setItem(USER_KEY, trimmed);
    clearCache();
    setUserState(trimmed);
  }, []);

  return (
    <UserContext.Provider value={{ user, loading, setUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
