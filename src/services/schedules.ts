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
    persons: s.persons || 4,
    isActive: s.is_active || false,
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
    persons: data.persons || 4,
    isActive: data.is_active || false,
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

/** Haal het actieve weekschema op voor een gebruiker (max 1). */
export async function getActiveSchedule(user: string): Promise<Schedule | null> {
  if (!user) return null;

  const key = `active_schedule:${user}`;
  const cached = cacheGet<Schedule>(key);
  if (cached !== undefined) return cached;

  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('user_name', user)
    .eq('is_active', true)
    .limit(1);

  if (error) throw error;
  if (!data || data.length === 0) {
    cacheSet(key, null as any);
    return null;
  }

  const s = data[0];
  const schedule: Schedule = {
    id: s.id,
    name: s.name,
    days: s.days || {},
    excludedAllergens: s.excluded_allergens || [],
    persons: s.persons || 4,
    isActive: true,
    createdAt: s.created_at,
  };
  cacheSet(key, schedule);
  return schedule;
}

/** Activeer een weekschema met een bepaald aantal personen. Deactiveert alle andere schema's. */
export async function setActiveSchedule(scheduleId: string, persons: number) {
  // Deactiveer alle actieve schema's van deze gebruiker
  // We halen eerst het schema op om de user_name te weten
  const schedule = await getSchedule(scheduleId);
  if (!schedule) throw new Error('Schema niet gevonden');

  // We moeten de user_name via een aparte query ophalen
  const { data: schData } = await supabase
    .from('schedules')
    .select('user_name')
    .eq('id', scheduleId)
    .single();

  if (schData?.user_name) {
    await supabase
      .from('schedules')
      .update({ is_active: false })
      .eq('user_name', schData.user_name)
      .eq('is_active', true);
  }

  // Activeer het gekozen schema
  const { error } = await supabase
    .from('schedules')
    .update({ is_active: true, persons })
    .eq('id', scheduleId);

  if (error) throw error;

  cacheInvalidate('schedules:');
  cacheInvalidate('schedule:');
  cacheInvalidate('active_schedule:');
}

/** Deactiveer een weekschema. */
export async function deactivateSchedule(scheduleId: string) {
  const { error } = await supabase
    .from('schedules')
    .update({ is_active: false })
    .eq('id', scheduleId);

  if (error) throw error;

  cacheInvalidate('schedules:');
  cacheInvalidate('schedule:');
  cacheInvalidate('active_schedule:');
}
