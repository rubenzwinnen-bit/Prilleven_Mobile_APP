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
