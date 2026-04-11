/**
 * COMMENTS SERVICE
 *
 * Alle operaties rond reacties/commentaren op recepten.
 * Leest/schrijft naar de Supabase-tabel `comments`.
 *
 * Functies:
 *   getComments(recipeId)               — alle reacties bij een recept
 *   addComment(recipeId, text, user)    — nieuwe reactie plaatsen
 */

import { supabase } from '../lib/supabase';
import { cacheGet, cacheSet, cacheInvalidate } from './cache';
import type { Comment } from '../types';

/** Haal alle commentaren op voor een recept (gecached). */
export async function getComments(recipeId: string): Promise<Comment[]> {
  const key = `comments:${recipeId}`;
  const cached = cacheGet<Comment[]>(key);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('recipe_id', recipeId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const comments: Comment[] = (data || []).map((c: any) => ({
    id: c.id,
    userId: c.user_name,
    userName: c.user_name,
    text: c.text,
    date: c.created_at,
  }));
  cacheSet(key, comments);
  return comments;
}

/** Voeg een nieuw commentaar toe aan een recept. */
export async function addComment(
  recipeId: string,
  text: string,
  user: string
): Promise<Comment | null> {
  if (!user || !text.trim()) return null;

  const { data, error } = await supabase
    .from('comments')
    .insert({ recipe_id: recipeId, user_name: user, text: text.trim() })
    .select()
    .single();

  if (error) throw error;
  cacheInvalidate(`comments:${recipeId}`);

  return {
    id: data.id,
    userId: data.user_name,
    userName: data.user_name,
    text: data.text,
    date: data.created_at,
  };
}
