-- =====================================================================
-- Migration: voeg display_name + aliases toe aan ingredient_icons
-- Datum: 2026-04-29
-- Reden: admins moeten ingrediënten kunnen hernoemen voor weergave
--        zonder de genormaliseerde sleutel (`name`) aan te passen,
--        die door recepten gematcht wordt. Aliases dienen als
--        per-ingrediënt fallback voor afwijkende recept-spellingen.
-- =====================================================================

-- 1. Voeg de twee kolommen toe (additief, geen breaking change).
ALTER TABLE ingredient_icons
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS aliases     text[] NOT NULL DEFAULT '{}';

-- 2. Index op aliases zodat de admin-pagina snel kan zoeken
--    welk ingredient een bepaalde alias bevat.
CREATE INDEX IF NOT EXISTS ingredient_icons_aliases_gin_idx
  ON ingredient_icons
  USING GIN (aliases);

-- 3. Comments voor toekomstige ontwikkelaars
COMMENT ON COLUMN ingredient_icons.name IS
  'Genormaliseerde sleutel — matcht met output van normalizeIngredientName(). NIET aanpassen na aanmaken: recepten verwijzen hier impliciet naar.';
COMMENT ON COLUMN ingredient_icons.display_name IS
  'Vrij door admin in te vullen weergavenaam (bv. "Citroen" i.p.v. "citro"). Wordt in mobiele app + admin getoond. Valt terug op `name` indien NULL.';
COMMENT ON COLUMN ingredient_icons.aliases IS
  'Extra genormaliseerde sleutels die ook deze icoon moeten matchen. Beheerd door admin om afwijkende recept-spellingen op te vangen zonder globale normalisatielogica te raken.';

-- =====================================================================
-- Rollback (handmatig uit te voeren indien nodig):
--   DROP INDEX IF EXISTS ingredient_icons_aliases_gin_idx;
--   ALTER TABLE ingredient_icons
--     DROP COLUMN IF EXISTS aliases,
--     DROP COLUMN IF EXISTS display_name;
-- =====================================================================
