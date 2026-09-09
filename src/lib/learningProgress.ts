/**
 * MIJN LEERTRAJECT — lokale voortgang
 *
 * Spiegel van `js/learningProgress.js` op de website.
 *
 * Twee bronnen, bewust gescheiden:
 *   - "Bezig"    wordt AFGELEID van de bladwijzer die de server bijhoudt
 *                (`user_learning_bookmarks`). Die is gedeeld met de
 *                website: verder lezen op je laptop maakt het item hier
 *                ook "Bezig".
 *   - "Afgerond" is een bewuste actie van de gebruiker en staat voorlopig
 *                LOKAAL, per gebruiker, in AsyncStorage.
 *
 * Dat tweede is een preview, precies zoals op de website. Gevolg om te
 * kennen: een afronding op de website verschijnt NIET in de app en
 * omgekeerd. Dat verdwijnt pas wanneer fase 3 van het gamificatieplan
 * (een Supabase-tabel met RLS) gebouwd is; tot dan is dit geen bron van
 * waarheid en mag er niets op gebaseerd worden dat cross-device moet
 * kloppen.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Learning } from '../services';

const PREFIX = 'prilleven_learning_progress_';

export type LearningStatusKey = 'new' | 'active' | 'completed';

export interface LearningStatus {
  key: LearningStatusKey;
  label: string;
}

function storageKey(user: string): string {
  return `${PREFIX}${String(user || 'anoniem').trim().toLowerCase()}`;
}

type VoortgangMap = Record<string, { completed_at: string }>;

/** Lezen faalt stil: een kapotte of lege map betekent gewoon "niets afgerond". */
export async function leesVoortgang(user: string): Promise<VoortgangMap> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(user));
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as VoortgangMap)
      : {};
  } catch {
    return {};
  }
}

/** Zet of wist de afronding van één learning. Geeft de nieuwe map terug. */
export async function setLearningCompleted(
  user: string,
  learningId: string,
  completed: boolean
): Promise<VoortgangMap> {
  const map = await leesVoortgang(user);
  if (completed) map[learningId] = { completed_at: new Date().toISOString() };
  else delete map[learningId];
  try {
    await AsyncStorage.setItem(storageKey(user), JSON.stringify(map));
  } catch {
    /* Niet kritisch: de UI toont de nieuwe staat, hij overleeft alleen
       geen herstart. Beter dan de actie laten mislukken. */
  }
  return map;
}

/**
 * Nieuw / Bezig / Afgerond voor één item. `voortgang` komt uit
 * `leesVoortgang()` zodat een lijst niet per kaart AsyncStorage raakt.
 */
export function getLearningStatus(
  learning: Pick<Learning, 'id' | 'bookmark'>,
  voortgang: VoortgangMap
): LearningStatus {
  if (voortgang[learning.id]?.completed_at) {
    return { key: 'completed', label: 'Afgerond' };
  }
  const positie = learning.bookmark?.position;
  if (positie && Object.keys(positie).length > 0) {
    return { key: 'active', label: 'Bezig' };
  }
  return { key: 'new', label: 'Nieuw' };
}
