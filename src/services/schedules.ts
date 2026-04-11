/**
 * SCHEDULES SERVICE
 *
 * Alle operaties rond opgeslagen weekschema's.
 * Leest/schrijft naar de Supabase-tabel `schedules`.
 *
 * Functies:
 *   getSavedSchedules(user)  — alle schema's van een gebruiker
 *   getSchedule(id)          — één schema ophalen op ID
 *   saveSchedule(user, data) — nieuw schema opslaan
 *   deleteSchedule(id)       — schema verwijderen
 */

import { supabase } from '../lib/supabase';
import { cacheGet, cacheSet, cacheInvalidate } from './cache';
import type { Schedule } from '../types';

/** Alle opgeslagen weekschema's voor een gebruiker (gecached). */
export async function getSavedSchedules(user: string): Promise<Schedule[]> {
  if (!user) return [];

  const key = `schedules:${user}`;
  const cached = cacheGet<Schedule[]>(key);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('user_name', user)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const schedules: Schedule[] = (data || []).map((s: any) => ({
    id: s.id,
    name: s.name,
    days: s.days || {},
    excludedAllergens: s.excluded_allergens || [],
    createdAt: s.created_at,
  }));
  cacheSet(key, schedules);
  for (const s of schedules) cacheSet(`schedule:${s.id}`, s);
  return schedules;
}

/** Haal één weekschema op via ID (gecached). */
export async function getSchedule(id: string): Promise<Schedule | null> {
  const cached = cacheGet<Schedule>(`schedule:${id}`);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const schedule: Schedule = {
    id: data.id,
    name: data.name,
    days: data.days || {},
    excludedAllergens: data.excluded_allergens || [],
    createdAt: data.created_at,
  };
  cacheSet(`schedule:${id}`, schedule);
  return schedule;
}

/** Sla een nieuw weekschema op in de database. */
export async function saveSchedule(
  user: string,
  schedule: { name: string; days: any; excludedAllergens: string[] }
): Promise<Schedule | null> {
  if (!user) throw new Error('Geen gebruikersnaam ingesteld.');

  const { data, error } = await supabase
    .from('schedules')
    .insert({
      user_name: user,
      name: schedule.name,
      days: schedule.days || {},
      excluded_allergens: schedule.excludedAllergens || [],
    })
    .select()
    .single();

  if (error) throw error;
  cacheInvalidate(`schedules:${user}`);

  return {
    id: data.id,
    name: data.name,
    days: data.days,
    excludedAllergens: data.excluded_allergens,
    createdAt: data.created_at,
  };
}

/** Verwijder een weekschema. */
export async function deleteSchedule(id: string) {
  const { error } = await supabase.from('schedules').delete().eq('id', id);
  if (error) throw error;
  cacheInvalidate('schedules:');
  cacheInvalidate(`schedule:${id}`);
}
