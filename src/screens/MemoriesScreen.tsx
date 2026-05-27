/**
 * MEMORIES SCREEN
 *
 * Toont de HapjesHeld-geheugen-items (feiten die HapjesHeld zelf opslaat
 * uit eerdere gesprekken). De gebruiker kan individuele items wissen en
 * (met confirmatie) alles in één keer. Lezen + verwijderen werkt los van
 * de `memory_enabled`-toggle in ProfileScreen — items blijven beheerbaar
 * ook al staat toekomstig geheugen uit.
 *
 * Entry-point: vanuit ProfileScreen "Voorkeuren & privacy" knop "Bekijk
 * opgeslagen geheugen →".
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { colors, radius, spacing, shadows } from '../constants/theme';
import { useToast } from '../components/Toast';
import {
  getMemories,
  deleteMemory,
  deleteAllMemories,
  relTime,
} from '../services';
import type { Memory } from '../services';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Memories'>;

const HEADER_CONTENT_HEIGHT = 42;

function ChevronBack({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={12}
      style={{ paddingRight: spacing.md }}
    >
      <Text
        style={{
          fontSize: 28,
          color: colors.primary,
          fontWeight: '300',
          marginTop: -2,
        }}
      >
        ‹
      </Text>
    </TouchableOpacity>
  );
}

/** Map importance (1-5) naar achtergrond-kleur voor de badge. Hogere
 *  waarde = belangrijker = donkerder/feller. Identiek aan web `imp-1..5`. */
function importanceColor(importance: number): string {
  switch (importance) {
    case 5:
      return colors.danger;
    case 4:
      return colors.primaryDark;
    case 3:
      return colors.primary;
    case 2:
      return colors.secondaryDark;
    default:
      return colors.secondary;
  }
}

export function MemoriesScreen({ navigation }: Props) {
  const { show } = useToast();

  const [memories, setMemories] = useState<Memory[] | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clearingAll, setClearingAll] = useState(false);

  /* Bij elke focus opnieuw laden — nieuwe gesprekken in HapjesHeld kunnen
     intussen nieuwe items hebben opgeleverd. */
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const list = await getMemories();
          if (!cancelled) setMemories(list);
        } catch (err: any) {
          if (!cancelled) {
            show(err.message || 'Geheugen kon niet worden geladen.', 'error');
            setMemories([]);
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [show])
  );

  const handleDeleteOne = useCallback(
    (mem: Memory) => {
      Alert.alert(
        'Dit feit verwijderen?',
        'HapjesHeld onthoudt dit niet meer in toekomstige gesprekken.',
        [
          { text: 'Annuleren', style: 'cancel' },
          {
            text: 'Verwijderen',
            style: 'destructive',
            onPress: async () => {
              setDeletingId(mem.id);
              try {
                await deleteMemory(mem.id);
                setMemories(prev =>
                  prev ? prev.filter(m => m.id !== mem.id) : prev
                );
                show('Feit verwijderd.', 'success');
              } catch (err: any) {
                show(err.message || 'Verwijderen mislukt.', 'error');
              } finally {
                setDeletingId(null);
              }
            },
          },
        ]
      );
    },
    [show]
  );

  const handleDeleteAll = useCallback(() => {
    if (!memories || memories.length === 0) return;
    Alert.alert(
      'Alle geheugen wissen?',
      `${memories.length} ${
        memories.length === 1 ? 'feit' : 'feiten'
      } worden verwijderd. HapjesHeld begint met een schone lei.`,
      [
        { text: 'Annuleren', style: 'cancel' },
        {
          text: 'Alles wissen',
          style: 'destructive',
          onPress: async () => {
            setClearingAll(true);
            try {
              await deleteAllMemories();
              setMemories([]);
              show('Geheugen volledig gewist.', 'success');
            } catch (err: any) {
              show(err.message || 'Wissen mislukt.', 'error');
            } finally {
              setClearingAll(false);
            }
          },
        },
      ]
    );
  }, [memories, show]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <ChevronBack onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Mijn geheugen</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.intro}>
          Dit zijn de feiten die HapjesHeld onthoudt om gesprekken
          persoonlijker te maken. Je kan ze hier op elk moment bekijken of
          verwijderen.
        </Text>

        {memories === null ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : memories.length === 0 ? (
          <View style={styles.emptyBlock}>
            <Feather name="cpu" size={28} color={colors.grayLight} />
            <Text style={styles.emptyText}>
              Nog geen geheugen. Naarmate je meer gesprekken voert, leert
              HapjesHeld je gezin beter kennen.
            </Text>
          </View>
        ) : (
          <>
            {memories.map(mem => (
              <View key={mem.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: importanceColor(mem.importance) },
                    ]}
                  >
                    <Text style={styles.badgeText}>{mem.importance}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardContent}>{mem.content}</Text>
                    <Text style={styles.cardMeta}>
                      Opgeslagen {relTime(mem.created_at)} geleden ·{' '}
                      {mem.last_used_at
                        ? `laatst gebruikt ${relTime(mem.last_used_at)} geleden`
                        : 'nog niet gebruikt'}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => handleDeleteOne(mem)}
                    disabled={deletingId === mem.id}
                    style={({ pressed }) => [
                      styles.iconBtn,
                      pressed && styles.btnPressed,
                      deletingId === mem.id && styles.btnDisabled,
                    ]}
                    accessibilityLabel="Feit verwijderen"
                  >
                    {deletingId === mem.id ? (
                      <ActivityIndicator size="small" color={colors.danger} />
                    ) : (
                      <Feather name="x" size={16} color={colors.danger} />
                    )}
                  </Pressable>
                </View>
              </View>
            ))}

            <Pressable
              onPress={handleDeleteAll}
              disabled={clearingAll}
              style={({ pressed }) => [
                styles.clearAllBtn,
                pressed && styles.btnPressed,
                clearingAll && styles.btnDisabled,
              ]}
            >
              {clearingAll ? (
                <ActivityIndicator color={colors.danger} />
              ) : (
                <>
                  <Feather name="trash-2" size={16} color={colors.danger} />
                  <Text style={styles.clearAllText}>Alles wissen</Text>
                </>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    height: HEADER_CONTENT_HEIGHT,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.dark,
  },
  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  intro: {
    fontSize: 13,
    color: colors.gray,
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
  loadingBlock: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyBlock: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  emptyText: {
    fontSize: 14,
    color: colors.gray,
    textAlign: 'center',
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  badgeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  cardContent: {
    fontSize: 14,
    color: colors.dark,
    lineHeight: 20,
  },
  cardMeta: {
    fontSize: 11,
    color: colors.gray,
    marginTop: 4,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  clearAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.white,
    marginTop: spacing.lg,
  },
  clearAllText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.danger,
  },
  btnPressed: {
    opacity: 0.65,
  },
  btnDisabled: {
    opacity: 0.45,
  },
});
