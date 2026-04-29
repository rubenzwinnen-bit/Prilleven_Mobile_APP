-- =====================================================================
-- Backfill: zet display_name + aliases voor de bekende ingrediënten
-- waarvan de genormaliseerde sleutel afwijkt van de leesbare naam.
-- Datum: 2026-04-29
--
-- Veilig opnieuw uit te voeren: gebruikt UPDATE op de hoofdsleutel,
-- raakt geen recepten aan. `name` blijft ongewijzigd.
--
-- LET OP: voer pas uit nadat de eerste migratie
--   20260429_add_display_name_and_aliases.sql is gedraaid.
-- =====================================================================

-- ---- Bekende afwijkingen uit de screenshots / normalisatielogica ----

-- citro  → "Citroen"
-- recept-spellingen die ook moeten matchen op deze icoon
UPDATE ingredient_icons
SET display_name = 'Citroen',
    aliases      = ARRAY['citroen', 'citroenen', 'citroentje', 'citroensap', 'citroenrasp']
WHERE name = 'citro';

-- hazelnot → "Hazelnoot"
UPDATE ingredient_icons
SET display_name = 'Hazelnoot',
    aliases      = ARRAY['hazelnoot', 'hazelnoten', 'hazelnootje', 'hazelnootjes']
WHERE name = 'hazelnot';

-- linz → "Linzen"
UPDATE ingredient_icons
SET display_name = 'Linzen',
    aliases      = ARRAY['linze', 'linzen', 'rode linzen', 'groene linzen', 'belugalinzen']
WHERE name = 'linz';

-- anana → "Ananas"
UPDATE ingredient_icons
SET display_name = 'Ananas',
    aliases      = ARRAY['ananas', 'ananasstukje', 'ananasstukjes', 'ananasschijf', 'ananasschijfjes']
WHERE name = 'anana';

-- bon → "Boon" (algemeen — verfijn indien er per type bonen iconen zijn)
UPDATE ingredient_icons
SET display_name = 'Boon',
    aliases      = ARRAY['boon', 'bonen', 'witte boon', 'bruine boon', 'kidneyboon', 'kidneybonen']
WHERE name = 'bon';

-- zad → "Zaad" (algemeen)
UPDATE ingredient_icons
SET display_name = 'Zaad',
    aliases      = ARRAY['zaad', 'zaden', 'pompoenzaad', 'pompoenzaden', 'zonnebloempit', 'zonnebloempitten']
WHERE name = 'zad';

-- collage → ?  (data-entry onduidelijk; admin moet de juiste naam invullen)
-- Plaats voorlopig een tijdelijke display_name zodat het niet "Collage" toont in UI.
UPDATE ingredient_icons
SET display_name = 'Onbekend ingrediënt'
WHERE name = 'collage'
  AND display_name IS NULL;

-- "gemengde diepvries groent" → "Gemengde diepvriesgroenten"
-- (Naam met spatie als sleutel — komt door normalisatie van "groenten" → "groent".)
UPDATE ingredient_icons
SET display_name = 'Gemengde diepvriesgroenten',
    aliases      = ARRAY['gemengde diepvriesgroenten', 'gemengde groenten diepvries', 'diepvriesgroenten gemengd']
WHERE name = 'gemengde diepvries groent';

-- =====================================================================
-- Algemene heuristiek voor de admin: alle overige rijen waar
-- display_name nog NULL is, krijgen voorlopig hun `name` met
-- hoofdletter. De admin kan ze daarna één voor één bijwerken.
-- =====================================================================
UPDATE ingredient_icons
SET display_name = INITCAP(name)
WHERE display_name IS NULL;

-- =====================================================================
-- Controle-query (voer manueel uit na de backfill):
--
--   SELECT name, display_name, aliases
--   FROM ingredient_icons
--   ORDER BY name;
--
-- Verwacht: elke rij heeft een display_name; rijen met afwijkende
-- normalisatie (citro, hazelnot, …) hebben ook aliases.
-- =====================================================================
