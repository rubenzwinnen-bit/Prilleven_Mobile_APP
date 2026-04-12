/**
 * INGREDIENT ICONS SERVICE
 *
 * Haalt de iconen-mapping op uit de Supabase `ingredient_icons`
 * tabel. Retourneert een Map<string, string> van genormaliseerde
 * ingrediënt-namen naar hun icon-URL's in Supabase Storage.
 *
 * Gebruikt een langere cache (5 minuten) omdat iconen zelden
 * veranderen — ze worden enkel via de admin-website geüpload.
 */

import { supabase } from '../lib/supabase';

/* ---- In-memory cache (5 min TTL) ---- */
const ICON_CACHE_TTL = 5 * 60 * 1000; // 5 minuten

let _iconMap: Map<string, string> | null = null;
let _iconMapTimestamp = 0;

/**
 * Haal de volledige iconen-map op.
 * Retourneert Map<normalized_name, icon_url>.
 */
export async function getIngredientIconMap(): Promise<Map<string, string>> {
  // Check in-memory cache
  if (_iconMap && Date.now() - _iconMapTimestamp < ICON_CACHE_TTL) {
    return _iconMap;
  }

  const { data, error } = await supabase
    .from('ingredient_icons')
    .select('name, icon_url');

  if (error) {
    console.warn('Ingredient icons ophalen mislukt:', error.message);
    // Return bestaande cache als fallback, of lege map
    return _iconMap || new Map();
  }

  const map = new Map<string, string>();
  for (const row of data || []) {
    map.set(row.name, row.icon_url);
  }

  _iconMap = map;
  _iconMapTimestamp = Date.now();
  return map;
}

/**
 * Wis de iconen-cache (bijv. na een handmatige refresh).
 */
export function clearIngredientIconCache(): void {
  _iconMap = null;
  _iconMapTimestamp = 0;
}
