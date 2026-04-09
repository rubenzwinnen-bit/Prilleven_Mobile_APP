/**
 * SUPABASE CLIENT
 * Verbindt de mobiele app met dezelfde Supabase-database
 * als de website. Tabellen: recipes, ratings, comments,
 * favorites, schedules.
 *
 * AsyncStorage wordt gebruikt voor session persistence
 * (mocht je later auth toevoegen). Voor nu draait alles
 * met de anon key — net als de webversie.
 */

import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ynrdoxukevhzupjvcjuw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_iksnuXPtWB_mqunZfLarVQ_tPLWaG02';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export const SUPABASE_PROJECT_URL = SUPABASE_URL;
