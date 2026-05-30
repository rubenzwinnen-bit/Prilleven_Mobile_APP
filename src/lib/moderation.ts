/**
 * MODERATIE-MENU — rapporteren + gebruiker blokkeren
 *
 * Gedeeld tussen de tijdlijn (TimelineScreen) en de chatruimtes
 * (ChatTopicScreen / ChatRoomScreen). App Store Guideline 1.2 vereist dat
 * elke gebruiker UGC kan rapporteren én de auteur kan blokkeren.
 *
 * Toont een native `Alert.alert` met twee acties:
 *   1. "<Doel> rapporteren"  → onReport()
 *   2. "Gebruiker blokkeren"  → bevestig-alert → onBlock()
 */

import { Alert } from 'react-native';

type ToastFn = (msg: string, type?: 'success' | 'error' | 'info') => void;

export function openModerationMenu(opts: {
  /** Label van het te modereren item, bv. 'Bericht', 'Reactie', 'Topic'. */
  targetLabel: string;
  /** Bijnaam van de auteur (voor de blokkeer-bevestiging). */
  authorName: string | null;
  onReport: () => Promise<void>;
  onBlock: () => Promise<void>;
  show: ToastFn;
}) {
  const { targetLabel, authorName, onReport, onBlock, show } = opts;
  Alert.alert('Moderatie', `Wat wil je doen met dit ${targetLabel.toLowerCase()}?`, [
    {
      text: `${targetLabel} rapporteren`,
      onPress: async () => {
        try {
          await onReport();
          show('Bedankt. We bekijken dit zo snel mogelijk.', 'success');
        } catch (err: any) {
          show(err.message || 'Rapporteren mislukt.', 'error');
        }
      },
    },
    {
      text: 'Gebruiker blokkeren',
      style: 'destructive',
      onPress: () => {
        Alert.alert(
          'Gebruiker blokkeren',
          `Je ziet geen berichten en reacties meer van ${
            authorName || 'deze gebruiker'
          }. Je kan dit later ongedaan maken via je profiel.`,
          [
            { text: 'Annuleren', style: 'cancel' },
            {
              text: 'Blokkeren',
              style: 'destructive',
              onPress: async () => {
                try {
                  await onBlock();
                  show('Gebruiker geblokkeerd.', 'success');
                } catch (err: any) {
                  show(err.message || 'Blokkeren mislukt.', 'error');
                }
              },
            },
          ]
        );
      },
    },
    { text: 'Annuleren', style: 'cancel' },
  ]);
}
