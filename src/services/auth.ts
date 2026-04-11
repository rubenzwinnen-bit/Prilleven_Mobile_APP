/**
 * AUTH SERVICE
 *
 * Authenticatie via Supabase Auth — zelfde systeem als de website.
 * Gebruikt email + wachtwoord met een whitelist (allowed_users tabel).
 *
 * Functies:
 *   checkAllowedUser(email)       — staat het emailadres in de whitelist?
 *   checkCanSignUp(email)         — mag dit emailadres nog registreren?
 *   signUp(email, password)       — account aanmaken + markeer als geregistreerd
 *   signIn(email, password)       — inloggen met email + wachtwoord
 *   signOut()                     — uitloggen (sessie wissen)
 *   resetPassword(email)          — wachtwoord-reset email versturen
 *   getSession()                  — huidige sessie ophalen (uit AsyncStorage)
 *   onAuthStateChange(callback)   — luister naar auth status wijzigingen
 */

import { supabase } from '../lib/supabase';

/** Check of een emailadres in de allowed_users tabel staat (= betaald). */
export async function checkAllowedUser(email: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('allowed_users')
    .select('email')
    .eq('email', email.toLowerCase().trim());

  if (error) throw error;
  return Array.isArray(data) && data.length > 0;
}

/** Check of een emailadres nog kan registreren (= in whitelist EN nog niet geregistreerd). */
export async function checkCanSignUp(email: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('allowed_users')
    .select('email')
    .eq('email', email.toLowerCase().trim())
    .eq('has_registered', false);

  if (error) throw error;
  return Array.isArray(data) && data.length > 0;
}

/** Markeer een emailadres als geregistreerd in de allowed_users tabel. */
async function markUserRegistered(email: string): Promise<void> {
  const { error } = await supabase
    .from('allowed_users')
    .update({ has_registered: true })
    .eq('email', email.toLowerCase().trim());

  if (error) throw error;
}

/**
 * Registreer een nieuw account.
 * Controleert eerst de whitelist, maakt dan een Supabase Auth account aan,
 * markeert de gebruiker als geregistreerd, en logt automatisch in.
 */
export async function signUp(
  email: string,
  password: string
): Promise<{ email: string }> {
  const trimmedEmail = email.toLowerCase().trim();

  // Stap 1: Check whitelist
  const canSignUp = await checkCanSignUp(trimmedEmail);
  if (!canSignUp) {
    throw new Error(
      'Dit emailadres is niet toegelaten of heeft al een account. ' +
        'Neem contact op als je denkt dat dit een fout is.'
    );
  }

  // Stap 2: Maak Supabase Auth account aan
  const { error: signUpError } = await supabase.auth.signUp({
    email: trimmedEmail,
    password,
  });
  if (signUpError) throw signUpError;

  // Stap 3: Markeer als geregistreerd
  await markUserRegistered(trimmedEmail);

  // Stap 4: Direct inloggen
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: trimmedEmail,
    password,
  });
  if (signInError) throw signInError;

  return { email: trimmedEmail };
}

/** Log in met email + wachtwoord. Retourneert het emailadres bij succes. */
export async function signIn(
  email: string,
  password: string
): Promise<{ email: string }> {
  const trimmedEmail = email.toLowerCase().trim();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: trimmedEmail,
    password,
  });

  if (error) throw error;

  return { email: data.user?.email || trimmedEmail };
}

/** Log uit — wist de sessie uit AsyncStorage. */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/** Stuur een wachtwoord-reset email. */
export async function resetPassword(email: string): Promise<void> {
  const trimmedEmail = email.toLowerCase().trim();

  const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail);
  if (error) throw error;
}

/** Haal de huidige sessie op (uit AsyncStorage, cached door Supabase SDK). */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

/** Luister naar auth status wijzigingen (login, logout, token refresh). */
export function onAuthStateChange(
  callback: (event: string, session: any) => void
) {
  return supabase.auth.onAuthStateChange(callback);
}
