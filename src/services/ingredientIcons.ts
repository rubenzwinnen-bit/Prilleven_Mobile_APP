/**
 * INGREDIENT ICONS SERVICE
 *
 * Haalt de iconen-mapping op uit de Supabase `ingredient_icons`
 * tabel. Levert twee maps:
 *   - iconUrl:     genormaliseerde naam → icon URL
 *   - displayName: genormaliseerde naam → admin-bewerkbare weergavenaam
 *
 * Aliases die in de DB op een ingrediënt staan krijgen ook een
 * entry in beide maps (zelfde URL & display_name als de hoofdsleutel),
 * zodat afwijkende recept-spellingen automatisch matchen.
 *
 * Backwards-compatible: als de DB nog geen `display_name` of
 * `aliases` kolommen heeft (bv. tijdens uitrol vóór migratie),
 * valt de fetch terug op enkel `name, icon_url`.
 *
 * Cache: 5 min TTL — iconen veranderen zelden en worden enkel
 * via de admin-website beheerd.
 */

import { supabase } from '../lib/supabase';

/* ---- In-memory cache (5 min TTL) ---- */
const ICON_CACHE_TTL = 5 * 60 * 1000;

export interface IngredientIconMaps {
  /** genormaliseerde naam → icon URL (incl. aliases) */
  iconUrl: Map<string, string>;
  /** genormaliseerde naam → admin-bewerkbare weergavenaam (incl. aliases) */
  displayName: Map<string, string>;
}

let _maps: IngredientIconMaps | null = null;
let _mapsTimestamp = 0;

/**
 * Haal de volledige iconen-maps op (icon-URL + display-name + aliases).
 */
export async function getIngredientIconMaps(): Promise<IngredientIconMaps> {
  if (_maps && Date.now() - _mapsTimestamp < ICON_CACHE_TTL) {
    return _maps;
  }

  // Probeer met de nieuwe kolommen; val terug op het oude schema bij fout.
  let rows: Array<{
    name: string;
    icon_url: string;
    display_name?: string | null;
    aliases?: string[] | null;
  }> = [];

  const fullResult = await supabase
    .from('ingredient_icons')
    .select('name, icon_url, display_name, aliases');

  if (fullResult.error) {
    // Mogelijk draait de DB nog op het oude schema → val terug.
    const legacy = await supabase
      .from('ingredient_icons')
      .select('name, icon_url');
    if (legacy.error) {
      console.warn('Ingredient icons ophalen mislukt:', legacy.error.message);
      return _maps || { iconUrl: new Map(), displayName: new Map() };
    }
    rows = legacy.data || [];
  } else {
    rows = fullResult.data || [];
  }

  const iconUrl = new Map<string, string>();
  const displayName = new Map<string, string>();

  for (const row of rows) {
    if (!row.name) continue;
    const dn = row.display_name?.trim() || null;

    iconUrl.set(row.name, row.icon_url);
    if (dn) displayName.set(row.name, dn);

    for (const alias of row.aliases || []) {
      if (!alias) continue;
      // Bestaande hoofdsleutels niet overschrijven door een alias
      if (!iconUrl.has(alias)) iconUrl.set(alias, row.icon_url);
      if (dn && !displayName.has(alias)) displayName.set(alias, dn);
    }
  }

  _maps = { iconUrl, displayName };
  _mapsTimestamp = Date.now();
  return _maps;
}

/**
 * Backwards-compat helper: enkel de URL-map.
 * @deprecated gebruik `getIngredientIconMaps()` voor display-namen + aliases.
 */
export async function getIngredientIconMap(): Promise<Map<string, string>> {
  const maps = await getIngredientIconMaps();
  return maps.iconUrl;
}

/**
 * Wis de iconen-cache (bijv. na een handmatige refresh).
 */
export function clearIngredientIconCache(): void {
  _maps = null;
  _mapsTimestamp = 0;
}
