/**
 * INGREDIENT ICONS
 * Mapping van ingrediënten naar emoji-symbolen voor de
 * boodschappenlijst-tegels. We zoeken op substring zodat
 * "kipfilet", "kipreepjes", "biokip" allemaal het kip-icoon
 * krijgen. Eerste match wint, dus de volgorde is belangrijk:
 * specifiekere woorden moeten boven generieke staan.
 */

const ICON_MAP: { keywords: string[]; icon: string }[] = [
  // Vlees & vis
  { keywords: ['kip', 'gevogelte', 'kalkoen'], icon: '🍗' },
  { keywords: ['gehakt', 'rund', 'biefstuk', 'steak'], icon: '🥩' },
  { keywords: ['varken', 'spek', 'bacon', 'ham'], icon: '🥓' },
  { keywords: ['worst', 'salami'], icon: '🌭' },
  { keywords: ['vis', 'zalm', 'tonijn', 'kabeljauw', 'forel'], icon: '🐟' },
  { keywords: ['garnaal', 'schaaldier', 'kreeft'], icon: '🦐' },
  { keywords: ['ei'], icon: '🥚' },

  // Zuivel
  { keywords: ['melk'], icon: '🥛' },
  { keywords: ['kaas', 'gouda', 'mozzarella', 'feta', 'parmezaan', 'cheddar'], icon: '🧀' },
  { keywords: ['boter'], icon: '🧈' },
  { keywords: ['yoghurt', 'kwark', 'platte kaas'], icon: '🥣' },
  { keywords: ['room', 'creme fraiche', 'crème fraîche', 'slagroom'], icon: '🥛' },

  // Groenten
  { keywords: ['tomaat', 'cherrytomaat'], icon: '🍅' },
  { keywords: ['wortel', 'wortelen'], icon: '🥕' },
  { keywords: ['ui', 'sjalot', 'lente-ui', 'prei'], icon: '🧅' },
  { keywords: ['knoflook', 'look'], icon: '🧄' },
  { keywords: ['paprika'], icon: '🫑' },
  { keywords: ['sla', 'kropsla', 'rucola', 'spinazie', 'andijvie'], icon: '🥬' },
  { keywords: ['broccoli'], icon: '🥦' },
  { keywords: ['komkommer'], icon: '🥒' },
  { keywords: ['aubergine'], icon: '🍆' },
  { keywords: ['mais', 'maïs'], icon: '🌽' },
  { keywords: ['champignon', 'paddenstoel'], icon: '🍄' },
  { keywords: ['aardappel', 'krieltje'], icon: '🥔' },
  { keywords: ['pompoen', 'butternut'], icon: '🎃' },
  { keywords: ['avocado'], icon: '🥑' },

  // Fruit
  { keywords: ['appel'], icon: '🍎' },
  { keywords: ['peer'], icon: '🍐' },
  { keywords: ['banaan'], icon: '🍌' },
  { keywords: ['sinaasappel', 'mandarijn'], icon: '🍊' },
  { keywords: ['citroen', 'limoen'], icon: '🍋' },
  { keywords: ['aardbei', 'framboos', 'braam', 'bes'], icon: '🍓' },
  { keywords: ['blauwe bes', 'bosbes'], icon: '🫐' },
  { keywords: ['druiven', 'druif'], icon: '🍇' },
  { keywords: ['ananas'], icon: '🍍' },
  { keywords: ['mango'], icon: '🥭' },
  { keywords: ['kiwi'], icon: '🥝' },
  { keywords: ['perzik', 'nectarine'], icon: '🍑' },
  { keywords: ['watermeloen', 'meloen'], icon: '🍉' },
  { keywords: ['kers'], icon: '🍒' },

  // Granen & deeg
  { keywords: ['brood', 'baguette', 'toast', 'broodje'], icon: '🍞' },
  { keywords: ['rijst'], icon: '🍚' },
  { keywords: ['pasta', 'spaghetti', 'penne', 'tagliatelle', 'macaroni', 'lasagne'], icon: '🍝' },
  { keywords: ['noedel', 'noodle', 'mie'], icon: '🍜' },
  { keywords: ['couscous', 'bulgur', 'quinoa'], icon: '🌾' },
  { keywords: ['meel', 'bloem'], icon: '🌾' },
  { keywords: ['havermout', 'haver', 'muesli', 'granola'], icon: '🥣' },
  { keywords: ['cracker', 'beschuit'], icon: '🍪' },
  { keywords: ['tortilla', 'wrap'], icon: '🌮' },
  { keywords: ['pizza'], icon: '🍕' },

  // Peulvruchten & noten
  { keywords: ['boon', 'kikkererwt', 'linze'], icon: '🫘' },
  { keywords: ['pinda', 'pindakaas'], icon: '🥜' },
  { keywords: ['noot', 'amandel', 'walnoot', 'cashew', 'hazelnoot'], icon: '🌰' },

  // Kruiden & olie
  { keywords: ['olie', 'olijfolie'], icon: '🫒' },
  { keywords: ['azijn'], icon: '🧴' },
  { keywords: ['zout'], icon: '🧂' },
  { keywords: ['peper', 'kruiden', 'specerij', 'peterselie', 'basilicum', 'oregano', 'tijm'], icon: '🌿' },
  { keywords: ['suiker', 'honing', 'siroop'], icon: '🍯' },
  { keywords: ['chocolade', 'cacao'], icon: '🍫' },

  // Overige
  { keywords: ['water'], icon: '💧' },
  { keywords: ['koffie'], icon: '☕' },
  { keywords: ['thee'], icon: '🍵' },
  { keywords: ['sap'], icon: '🧃' },
  { keywords: ['wijn'], icon: '🍷' },
  { keywords: ['bier'], icon: '🍺' },
];

export function getIngredientIcon(name: string): string {
  if (!name) return '🥘';
  const lower = name.toLowerCase();
  for (const entry of ICON_MAP) {
    if (entry.keywords.some(k => lower.includes(k))) {
      return entry.icon;
    }
  }
  return '🥘';
}

/**
 * Normaliseer een ingrediënt-naam voor icoon-lookup EN aggregatie.
 * Zelfde logica als op de website zodat de matching consistent is.
 * - lowercase + trim
 * - strip hoeveelheidwoorden aan het begin (bijv. "snuifje", "scheutje", "teentje(s)")
 * - strip hoeveelheden/eenheden aan het begin (bijv. "120ml", "50g", "2 eetlepel")
 * - strip notities tussen haakjes overal (bijv. "(vers of uit blik)", "(s)")
 * - strip beschrijvende woorden (bijv. "verse", "geraspte", "fijngemalen")
 * - strip Nederlandse meervoudsvormen (-en, -'s, -s), maar niet bij dubbele klinkers (kaas)
 */
export function normalizeIngredientName(name: string): string {
  if (!name) return '';
  let n = name.toLowerCase().trim();

  // 1a. Strip hoeveelheid-woorden aan het begin (zonder getal ervoor)
  n = n.replace(
    /^(?:snuifje|snufje|snuf|scheutje|schepje|teentje(?:\(s\))?|sneetje(?:\(s\))?|takje(?:s)?|plakje(?:s)?|bosje|blaadje(?:s)?|handje(?:vol)?|beetje|stukje|blokje(?:s)?|potje|zakje|flesje|kopje|bakje)\s+/i,
    ''
  );

  // 1b. Strip hoeveelheden + eenheden aan het begin (met getal)
  n = n.replace(
    /^[\d.,/]+\s*(?:gram|g|kg|ml|liter|l|dl|cl|eetlepel|el|theelepel|tl|snuf|snufje|teen|tenen|takje|takjes|blaadjes|stuk|stuks|plak|plakken|schijf|schijfjes|blok|blokje|blokjes|mespunt|snede|sneetje|sneetjes|beker|bekers|portie|porties|kop|kopje|kopjes|bos|bosje|bosjes|cm|zakje|zakjes|pot|potje|potjes|blik|blikje|blikjes|fles|flesje|flesjes|pakje|pakjes|doos|doosje|doosjes|vel|vellen)\s*/i,
    ''
  );

  // 2. Strip ALLE haakjes-notities overal (inclusief "(s)", "(vegan)", "(vers of uit blik)")
  n = n.replace(/\s*\([^)]*\)/g, '').trim();

  // 3. Strip beschrijvende bijvoeglijke naamwoorden aan het begin
  n = n.replace(
    /^(?:verse?|grof|grove|fijn|fijne|fijngemalen|geraspte?|gehakte?|gesneden|gedroogde?|gesmolten|gekookte?|gebakken|ontpitte?|groene?|rode?|gele|witte?|zwarte?|volle|halve|hele|biologische?|bio|grote?|kleine?)\s+/i,
    ''
  );

  // 4. Strip " om te bakken/braden" etc. aan het einde
  n = n.replace(/\s+om\s+te\s+\w+$/, '').trim();

  // 5. Strip ", ontpit" etc. aan het einde
  n = n.replace(/,\s*\w+$/, '').trim();

  // 6. Strip niet-letter tekens aan begin/einde
  n = n.replace(/^[^a-zà-ÿ]+|[^a-zà-ÿ]+$/g, '').trim();

  if (!n || n.length < 2) return '';

  // 7. Strip Nederlandse meervoudsvormen
  // NIET strippen bij dubbele klinker + s (kaas, kaas → kaas, niet kaa)
  const doubleVowelS = /([aeiou])\1s$/.test(n);
  if (doubleVowelS) {
    // "kaas", "nootjes" etc. — niet strippen
  } else if (n.length > 4 && n.endsWith('en')) {
    n = n.slice(0, -2);
  } else if (n.endsWith("'s")) {
    n = n.slice(0, -2);
  } else if (n.length > 3 && n.endsWith('s')) {
    n = n.slice(0, -1);
  }

  // 8. Strip "tjes" en "je" verkleinwoorden
  if (n.endsWith('tjes')) {
    n = n.slice(0, -4);
  } else if (n.length > 4 && n.endsWith('je')) {
    n = n.slice(0, -2);
  }

  return n.trim();
}
