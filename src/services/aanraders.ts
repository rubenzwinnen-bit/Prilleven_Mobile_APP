/**
 * AANRADERS SERVICE
 *
 * De affiliatepagina van Pril Leven, native in de app. Leest de drie
 * `affiliate_*`-tabellen RECHTSTREEKS via Supabase met de anon-key — dat mag,
 * want de RLS-policy is `select using (zichtbaar = true)` voor anon. Er is
 * dus geen endpoint aan de website-zijde nodig; het patroon is dat van
 * `recipes.ts`.
 *
 * De website rendert deze data server-side als HTML (`api/aanraders.mjs`)
 * omdat die pagina publiek en indexeerbaar moet zijn. Dat speelt in de app
 * niet, dus die HTML halen we niet op — we bouwen de schermen native.
 *
 * Tabellen: `affiliate_categories`, `affiliate_products`, `affiliate_downloads`.
 * Beheren gebeurt uitsluitend op de website (admin-tab), niet hier.
 */

import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { cacheGet, cacheSet } from './cache';

/* ----------------------------------------
   Types — spiegel van de kolommen in de migratie
   2026-07-29-affiliate-aanraders.sql
---------------------------------------- */
export type RelatieType =
  | 'affiliate_korting'
  | 'affiliate'
  | 'enkel_korting'
  | 'geen_samenwerking';

export interface AanraderCategorie {
  id: string;
  slug: string;
  titel: string;
  emoji: string | null;
  omschrijving: string | null;
  volgorde: number | null;
  binnenkort: boolean;
}

export interface AanraderProduct {
  id: string;
  slug: string;
  titel: string;
  categorie_id: string | null;
  subcategorie: string | null;
  merk: string | null;
  afbeelding_url: string | null;
  afbeeldingen: string[];
  korte_beschrijving: string | null;
  lange_beschrijving: string | null;
  waarom_aanbevolen: string | null;
  voordelen: string[];
  nadelen: string[];
  faq: { vraag: string; antwoord: string }[];
  affiliate_link: string | null;
  kortingscode: string | null;
  korting_tekst: string | null;
  prijs_indicatie: string | null;
  labels: string[];
  leeftijd_vanaf_maanden: number | null;
  materiaal: string | null;
  relatie_type: RelatieType;
  opmerking: string | null;
  favoriet_anneleen: boolean;
  volgorde: number | null;
  /* Aangevuld vanuit de categorie — handig voor filteren en zoeken. */
  categorie_slug?: string;
  categorie_titel?: string;
}

export interface AanraderDownload {
  slug: string;
  titel: string;
  omschrijving: string | null;
  bestand_url: string | null;
  emoji: string | null;
  volgorde: number | null;
}

export interface AanradersData {
  categorieen: AanraderCategorie[];
  producten: AanraderProduct[];
  downloads: AanraderDownload[];
}

/* ----------------------------------------
   Labels — letterlijk overgenomen uit api/aanraders.mjs zodat app en
   website exact hetzelfde beloven. Transparantie is hier geen detail:
   `relatie_type` moet op elke kaart én op het detail zichtbaar staan.
---------------------------------------- */
export const RELATIE_LABELS: Record<RelatieType, string> = {
  affiliate_korting: 'Affiliatelink + kortingscode',
  affiliate: 'Affiliatelink',
  enkel_korting: 'Enkel kortingscode — geen commissie',
  geen_samenwerking: 'Persoonlijke aanbeveling — geen samenwerking',
};

export const LABEL_TEKST: Record<string, string> = {
  favoriet: 'Favoriet',
  bestseller: 'Bestseller',
  'community-favoriet': 'Community favoriet',
  budgetvriendelijk: 'Budgetvriendelijk',
  nieuw: 'Nieuw',
};

export const INTRO_TEKST =
  'Als ouders worden we overspoeld met producten en adviezen. Daarom verzamel ik hier ' +
  'enkel de producten waar ik écht achter sta. Alles op deze pagina gebruik ik zelf, ' +
  'testte ik uitgebreid of raad ik met vertrouwen aan. Sommige links zijn affiliatelinks ' +
  'of bevatten een kortingscode. Daarmee steun je Pril Leven, zonder dat het jou iets ' +
  'extra kost.';

export function leeftijdLabel(maanden: number | null | undefined): string {
  if (maanden === null || maanden === undefined) return 'Alle leeftijden';
  if (maanden === 0) return 'Vanaf de geboorte';
  if (maanden < 24) return `Vanaf ${maanden} mnd`;
  return `Vanaf ${Math.floor(maanden / 12)} jaar`;
}

/**
 * Mag de koopknop van dit product getoond worden?
 *
 * Op iOS niet wanneer de link naar de eigen Plug&Pay-checkout wijst. Dat
 * zijn Pril Levens eigen digitale producten (masterclass, roadmap), en
 * App Store 3.1.1 verbiedt een call-to-action naar een andere
 * aankoopmethode voor digitale content. Dezelfde afweging als
 * MAG_NAAR_CHECKOUT_LINKEN in constants/links.ts.
 *
 * De affiliatelinks van derden vallen hier niet onder: dat zijn fysieke
 * producten en externe diensten, en die mag een app gewoon linken. De
 * kaart zelf blijft in beide gevallen staan — enkel de knop verdwijnt.
 */
export function magKoopknopTonen(p: AanraderProduct): boolean {
  if (Platform.OS !== 'ios') return true;
  const link = p.affiliate_link || '';
  try {
    return !new URL(link).hostname.endsWith('plugandpay.com');
  } catch {
    return true;
  }
}

/** Alleen http(s) doorlaten — spiegel van `safeUrl()` op de website. */
export function veiligeUrl(v: string | null | undefined): string | null {
  if (!v) return null;
  try {
    const u = new URL(String(v).trim());
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

/* ----------------------------------------
   Ophalen
---------------------------------------- */
const CACHE_KEY = 'aanraders:all';

/** Lege arrays i.p.v. null, zodat schermen niet overal hoeven te checken. */
function normaliseerProduct(row: any): AanraderProduct {
  return {
    ...row,
    afbeeldingen: Array.isArray(row.afbeeldingen) ? row.afbeeldingen : [],
    voordelen: Array.isArray(row.voordelen) ? row.voordelen : [],
    nadelen: Array.isArray(row.nadelen) ? row.nadelen : [],
    faq: Array.isArray(row.faq) ? row.faq : [],
    labels: Array.isArray(row.labels) ? row.labels : [],
  };
}

/**
 * Alles in één keer: negen categorieën en een tiental producten is te
 * weinig om per categorie te gaan pagineren, en de filters draaien
 * client-side op dezelfde dataset — net als op de website.
 */
export async function getAanraders(): Promise<AanradersData> {
  const cached = cacheGet<AanradersData>(CACHE_KEY);
  if (cached) return cached;

  const [cats, prods, downloads] = await Promise.all([
    supabase
      .from('affiliate_categories')
      .select('id, slug, titel, emoji, omschrijving, volgorde, binnenkort')
      .eq('zichtbaar', true)
      .order('volgorde', { ascending: true })
      .order('titel', { ascending: true }),
    supabase
      .from('affiliate_products')
      .select('*')
      .eq('zichtbaar', true)
      .order('volgorde', { ascending: true })
      .order('titel', { ascending: true }),
    supabase
      .from('affiliate_downloads')
      .select('slug, titel, omschrijving, bestand_url, emoji, volgorde')
      .eq('zichtbaar', true)
      .order('volgorde', { ascending: true })
      .order('titel', { ascending: true }),
  ]);

  if (cats.error) throw cats.error;
  if (prods.error) throw prods.error;
  if (downloads.error) throw downloads.error;

  const categorieen = (cats.data || []) as AanraderCategorie[];
  /* Categorie-slug en -titel op het product plakken: de kaart filtert erop
     en zoekt erop mee, terwijl de categorienaam op de kaart zelf niet staat
     (zoeken op "slaap" hoort de producten uit die categorie te vinden). */
  const perId = new Map(categorieen.map(c => [String(c.id), c]));
  const producten = (prods.data || []).map(row => {
    const p = normaliseerProduct(row);
    const c = perId.get(String(p.categorie_id));
    return c ? { ...p, categorie_slug: c.slug, categorie_titel: c.titel } : p;
  });

  const data: AanradersData = {
    categorieen,
    producten,
    downloads: (downloads.data || []) as AanraderDownload[],
  };
  cacheSet(CACHE_KEY, data);
  return data;
}

/** De zoekindex van één product — spiegel van `data-zoek` op de website. */
export function zoekTekst(p: AanraderProduct): string {
  return [
    p.titel,
    p.merk,
    p.materiaal,
    p.subcategorie,
    p.korte_beschrijving,
    p.waarom_aanbevolen,
    p.categorie_titel,
    p.labels.join(' '),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}
