/**
 * CHILDREN SCREEN — fase 2
 *
 * Lijst van kinderen met "Kind toevoegen"-knop en bewerk/verwijder per
 * kaart. Soft-delete via DELETE /api/children. Add/edit gebeurt via een
 * apart `ChildForm`-scherm (zie ChildFormScreen.tsx).
 *
 * Entry-point: vanuit ProfileScreen-row "Mijn kinderen".
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
  getChildren,
  archiveChild,
  formatAge,
  KNOWN_ALLERGEN_OPTIONS,
} from '../services';
import type { Child } from '../services';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Children'>;

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

/** Map allergen-key → display-label (zonder emoji). Fallback op de key
 *  zelf voor onbekende keys (bv. legacy data). */
function allergenLabel(key: string): string {
  const opt = KNOWN_ALLERGEN_OPTIONS.find(o => o.key === key);
  return opt ? opt.label : key;
}

export function ChildrenScreen({ navigation }: Props) {
  const { show } = useToast();

  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  /* Bij elke focus (ook na terugkomen uit ChildForm) opnieuw laden zodat
     edits + toevoegingen direct zichtbaar zijn. */
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const list = await getChildren();
          if (!cancelled) setChildren(list);
        } catch (err: any) {
          if (!cancelled) {
            show(err.message || 'Kon kinderen niet laden.', 'error');
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [show])
  );

  const handleArchive = useCallback(
    (child: Child) => {
      Alert.alert(
        `${child.name} verwijderen?`,
        'De gegevens worden gearchiveerd (niet definitief gewist). Je kan op een later moment contact opnemen met support om alles definitief te wissen.',
        [
          { text: 'Annuleren', style: 'cancel' },
          {
            text: 'Verwijderen',
            style: 'destructive',
            onPress: async () => {
              setArchivingId(child.id);
              try {
                await archiveChild(child.id);
                setChildren(prev => prev.filter(c => c.id !== child.id));
                show(`${child.name} verwijderd.`, 'success');
              } catch (err: any) {
                show(err.message || 'Verwijderen mislukt.', 'error');
              } finally {
                setArchivingId(null);
              }
            },
          },
        ]
      );
    },
    [show]
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <ChevronBack onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Mijn kinderen</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.intro}>
          Voeg per kind een profiel toe. We gebruiken deze info om HapjesHeld
          persoonlijker te maken en (later) om allergeen-introducties op te
          volgen.
        </Text>

        {loading ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : children.length === 0 ? (
          <View style={styles.emptyBlock}>
            <Feather name="users" size={28} color={colors.grayLight} />
            <Text style={styles.emptyText}>
              Nog geen kinderen toegevoegd.
            </Text>
          </View>
        ) : (
          children.map(child => (
            <View key={child.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName}>{child.name}</Text>
                  <Text style={styles.cardAge}>{formatAge(child.birthdate)}</Text>
                </View>
                <View style={styles.cardActions}>
                  <Pressable
                    onPress={() =>
                      navigation.navigate('ChildForm', { childId: child.id })
                    }
                    style={({ pressed }) => [
                      styles.iconBtn,
                      pressed && styles.btnPressed,
                    ]}
                    accessibilityLabel={`${child.name} bewerken`}
                  >
                    <Feather name="edit-2" size={16} color={colors.primary} />
                  </Pressable>
                  <Pressable
                    onPress={() => handleArchive(child)}
                    disabled={archivingId === child.id}
                    style={({ pressed }) => [
                      styles.iconBtn,
                      pressed && styles.btnPressed,
                      archivingId === child.id && styles.btnDisabled,
                    ]}
                    accessibilityLabel={`${child.name} verwijderen`}
                  >
                    {archivingId === child.id ? (
                      <ActivityIndicator size="small" color={colors.danger} />
                    ) : (
                      <Feather name="trash-2" size={16} color={colors.danger} />
                    )}
                  </Pressable>
                </View>
              </View>

              {/* Optionele detail-blokjes */}
              {child.known_allergies.length > 0 && (
                <DetailRow
                  label="Bekende allergieën"
                  value={child.known_allergies
                    .map(allergenLabel)
                    .join(', ')}
                />
              )}
              {child.allergens_opted_out ? (
                <DetailRow
                  label="Reeds geïntroduceerde allergenen"
                  value="Functie uitgeschakeld"
                  muted
                />
              ) : (
                child.introduced_allergens.length > 0 && (
                  <DetailRow
                    label="Reeds geïntroduceerde allergenen"
                    value={child.introduced_allergens
                      .map(allergenLabel)
                      .join(', ')}
                  />
                )
              )}
              {child.previous_reactions && (
                <DetailRow
                  label="Eerdere reacties"
                  value={child.previous_reactions}
                  multiline
                />
              )}
              {child.notes && (
                <DetailRow
                  label="Opmerkingen"
                  value={child.notes}
                  multiline
                />
              )}

            </View>
          ))
        )}

        {/* "Kind toevoegen"-knop — onderaan zodat hij na de lijst staat */}
        <Pressable
          onPress={() => navigation.navigate('ChildForm')}
          style={({ pressed }) => [
            styles.addBtn,
            pressed && styles.btnPressed,
          ]}
        >
          <Feather name="plus" size={18} color={colors.white} />
          <Text style={styles.addBtnText}>Kind toevoegen</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({
  label,
  value,
  multiline,
  muted,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  muted?: boolean;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text
        style={[
          styles.detailValue,
          multiline && styles.detailValueMultiline,
          muted && styles.detailValueMuted,
        ]}
      >
        {value}
      </Text>
    </View>
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
  },
  emptyText: {
    fontSize: 14,
    color: colors.gray,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.dark,
  },
  cardAge: {
    fontSize: 13,
    color: colors.gray,
    marginTop: 2,
  },
  cardActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  detailRow: {
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.light,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.gray,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    color: colors.dark,
  },
  detailValueMultiline: {
    lineHeight: 20,
  },
  detailValueMuted: {
    color: colors.gray,
    fontStyle: 'italic',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    marginTop: spacing.md,
  },
  addBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.white,
  },
  btnPressed: {
    opacity: 0.65,
  },
  btnDisabled: {
    opacity: 0.45,
  },
});
