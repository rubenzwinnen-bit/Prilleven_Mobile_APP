/**
 * USER CONTEXT
 *
 * Houdt de huidige gebruiker (emailadres) bij via Supabase Auth.
 * Bij het opstarten wordt de bestaande sessie uit AsyncStorage
 * geladen door de Supabase SDK. Als er geen sessie is, wordt
 * `user` een lege string en toont de app het login-scherm.
 *
 * Het emailadres wordt ook bewaard in AsyncStorage onder de
 * key `receptenboek_user` zodat alle services (favorites,
 * ratings, schedules) het direct als user-identifier kunnen
 * gebruiken — precies zoals de website dat doet.
 *
 * Functies:
 *   user       — het e-mailadres van de ingelogde gebruiker (leeg = niet ingelogd)
 *   loading    — true zolang de sessie wordt gecheckt
 *   setUser    — wordt aangeroepen na succesvolle login/registratie
 *   logout     — uitloggen + sessie + cache wissen
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearCache, signOut, getSession, onAuthStateChange } from '../services';

const USER_KEY = 'receptenboek_user';

interface UserContextValue {
  /** Het e-mailadres van de ingelogde gebruiker, of '' als niet ingelogd. */
  user: string;
  /** True zolang we de sessie controleren bij het opstarten. */
  loading: boolean;
  /** Sla het e-mailadres op na login/registratie. */
  setUser: (email: string) => Promise<void>;
  /** Log uit, wis sessie en cache. */
  logout: () => Promise<void>;
}

const UserContext = createContext<UserContextValue>({
  user: '',
  loading: true,
  setUser: async () => {},
  logout: async () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  /* Bij opstarten: check of er al een Supabase sessie is */
  useEffect(() => {
    (async () => {
      try {
        const session = await getSession();
        if (session?.user?.email) {
          const email = session.user.email;
          setUserState(email);
          await AsyncStorage.setItem(USER_KEY, email);
        } else {
          // Geen sessie — misschien was er een oude username opgeslagen?
          // Wis die zodat de login-screen verschijnt.
          await AsyncStorage.removeItem(USER_KEY);
          setUserState('');
        }
      } catch {
        setUserState('');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* Luister naar auth wijzigingen (bv. token refresh, signout) */
  useEffect(() => {
    const { data: listener } = onAuthStateChange((_event, session) => {
      if (session?.user?.email) {
        setUserState(session.user.email);
        AsyncStorage.setItem(USER_KEY, session.user.email);
      } else if (_event === 'SIGNED_OUT') {
        setUserState('');
        AsyncStorage.removeItem(USER_KEY);
        clearCache();
      }
    });

    return () => {
      listener?.subscription?.unsubscribe();
    };
  }, []);

  /** Wordt aangeroepen na succesvolle login of registratie. */
  const setUser = useCallback(async (email: string) => {
    const trimmed = email.toLowerCase().trim();
    if (!trimmed) return;
    await AsyncStorage.setItem(USER_KEY, trimmed);
    clearCache();
    setUserState(trimmed);
  }, []);

  /** Log volledig uit. */
  const logout = useCallback(async () => {
    try {
      await signOut();
    } catch {
      // Zelfs als sign-out faalt op de server, wis lokaal
    }
    await AsyncStorage.removeItem(USER_KEY);
    clearCache();
    setUserState('');
  }, []);

  return (
    <UserContext.Provider value={{ user, loading, setUser, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
