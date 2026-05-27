/**
 * ALLERGENEN CHILDREN SCREEN — v2.6.0
 *
 * Tussen-stap tussen de "Allergenen-introductie"-tile op het landingscherm
 * en de eigenlijke `EersteHapjesScreen`. Toont alle (niet-gearchiveerde)
 * kinderen met hun leeftijd en een chevron. Tap → EersteHapjes voor dat
 * kind.
 *
 * Waarom een aparte picker? De allergeen-flow is per kind, en we willen
 * hem niet langer als sub-flow onder ChildrenScreen tonen (zie v2.6.0
 * UX-feedback). Vanaf nu start de flow expliciet vanuit het landingscherm.
 *
 * Bij 0 kinderen: korte instructie + knop naar `Children` om er een aan
 * te maken.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { colors, radius, spacing, shadows } from '../constants/theme';
import { useToast } from '../components/Toast';
import { getChildren, formatAge } from '../services';
import type { Child } from '../services';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'AllergenenChildren'>;

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

export function AllergenenChildrenScreen({ navigation }: Props) {
  const { show } = useToast();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <ChevronBack onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Allergenen-introductie</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.intro}>
          Voor welk kind wil je een allergeen registreren of een symptoom
          loggen? Tik op een naam om de allergeen-flow te openen.
        </Text>

        {loading ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : children.length === 0 ? (
          <View style={styles.emptyBlock}>
            <Feather name="users" size={28} color={colors.grayLight} />
            <Text style={styles.emptyText}>
              Je hebt nog geen kinderen toegevoegd. Maak er eerst eentje aan
              via "Mijn kinderen".
            </Text>
            <Pressable
              onPress={() => navigation.navigate('Children')}
              style={({ pressed }) => [
                styles.primaryBtn,
                pressed && styles.btnPressed,
              ]}
            >
              <Feather name="plus" size={16} color={colors.white} />
              <Text style={styles.primaryBtnText}>Kind toevoegen</Text>
            </Pressable>
          </View>
        ) : (
          children.map(child => (
            <Pressable
              key={child.id}
              onPress={() =>
                navigation.navigate('EersteHapjes', { childId: child.id })
              }
              style={({ pressed }) => [
                styles.card,
                pressed && styles.btnPressed,
              ]}
              accessibilityLabel={`Allergeen-flow openen voor ${child.name}`}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{child.name}</Text>
                <Text style={styles.cardAge}>{formatAge(child.birthdate)}</Text>
              </View>
              <Feather name="chevron-right" size={22} color={colors.primary} />
            </Pressable>
          ))
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
  },
  emptyText: {
    fontSize: 14,
    color: colors.gray,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
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
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    marginTop: spacing.md,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
  btnPressed: {
    opacity: 0.65,
  },
});
