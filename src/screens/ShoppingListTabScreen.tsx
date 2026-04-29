/**
 * SHOPPING LIST TAB SCREEN
 *
 * De "Boodschappenlijst" tab onderaan. Toont de gegenereerde
 * lijst (uit ShoppingListContext) als visuele tegels. Gebruikers
 * kunnen tegels naar het mandje verplaatsen en weer terug.
 *
 * Als er nog geen lijst is, krijgt de gebruiker uitleg dat hij/zij
 * eerst een lijst moet genereren vanuit een opgeslagen weekschema.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing, shadows } from '../constants/theme';
import { CompactHeader } from '../navigation/RootStack';
import { IngredientTile, ingredientTileStyles } from '../components/IngredientTile';
import { useShoppingList } from '../context/ShoppingListContext';

export function ShoppingListTabScreen({ navigation }: any) {
  const { list, clearList, moveToBasket, moveBackToList } = useShoppingList();
  const goToLanding = () => navigation.getParent()?.goBack();

  /* ----- Lege staat: nog geen lijst gegenereerd ----- */
  if (!list) {
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <CompactHeader onBack={goToLanding} />
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>🛒 Boodschappenlijst</Text>

          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>🧺</Text>
            <Text style={styles.emptyTitle}>Nog geen lijst gegenereerd</Text>
            <Text style={styles.emptyText}>
              Je kunt een boodschappenlijst genereren vanuit een opgeslagen
              weekschema.{'\n\n'}
              Ga naar de tab <Text style={styles.bold}>Weekschema</Text>,
              maak en bewaar een schema, of open een eerder bewaard schema
              in <Text style={styles.bold}>Favorieten</Text>. Tik daar op
              <Text style={styles.bold}> "Genereer boodschappenlijst"</Text>,
              kies welke dagen en maaltijden je wil meenemen, en klik op
              <Text style={styles.bold}> Genereer</Text>.{'\n\n'}
              Daarna verschijnt de volledige lijst hier in deze tab — met
              vierkante tegels die je in je winkelmandje kunt slepen.
            </Text>

            <Pressable
              style={styles.cta}
              onPress={() => navigation.navigate('Favorieten')}
            >
              <Text style={styles.ctaText}>Naar Favorieten →</Text>
            </Pressable>
            <Pressable
              style={[styles.cta, styles.ctaSecondary]}
              onPress={() => navigation.navigate('Weekschema')}
            >
              <Text style={[styles.ctaText, styles.ctaSecondaryText]}>
                Naar Weekschema →
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* ----- Lijst aanwezig ----- */
  const basketSet = new Set(list.basket);
  const remaining = list.ingredients.filter(i => !basketSet.has(i.key));
  const basket = list.ingredients.filter(i => basketSet.has(i.key));

  const handleClear = () => {
    Alert.alert(
      'Boodschappenlijst wissen?',
      'Je gegenereerde lijst wordt verwijderd.',
      [
        { text: 'Annuleren', style: 'cancel' },
        {
          text: 'Wissen',
          style: 'destructive',
          onPress: () => clearList(),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <CompactHeader onBack={goToLanding} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>🛒 Boodschappenlijst</Text>
        <View style={styles.activeInfoBanner}>
          <Text style={styles.activeInfoText}>
            Actief weekschema: <Text style={styles.activeInfoBold}>{list.scheduleName}</Text>
            {list.persons ? ` · ${list.persons} personen` : ''}
          </Text>
        </View>
        <Text style={styles.helperTop}>
          Tik op een ingrediënt om het in je winkelmandje te leggen.
          Per ongeluk getikt? Tik nog een keer in het mandje om hem terug
          te zetten.
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Nog te kopen ({remaining.length})
          </Text>

          {remaining.length === 0 ? (
            <View style={styles.allDoneBox}>
              <Text style={styles.allDoneIcon}>🎉</Text>
              <Text style={styles.allDoneText}>Alles in het mandje!</Text>
            </View>
          ) : (
            <View style={ingredientTileStyles.tileGrid}>
              {remaining.map(item => (
                <IngredientTile
                  key={item.key}
                  item={item}
                  inBasket={false}
                  onPress={() => moveToBasket(item.key)}
                />
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            In winkelmandje ({basket.length})
          </Text>
          {basket.length === 0 ? (
            <Text style={styles.helper}>
              Nog niets in het mandje. Tik hierboven op een ingrediënt
              om hem hier te plaatsen.
            </Text>
          ) : (
            <View style={ingredientTileStyles.tileGrid}>
              {basket.map(item => (
                <IngredientTile
                  key={item.key}
                  item={item}
                  inBasket
                  onPress={() => moveBackToList(item.key)}
                />
              ))}
            </View>
          )}
        </View>

        <Pressable style={styles.clearBtn} onPress={handleClear}>
          <Text style={styles.clearBtnText}>🗑️ Lijst wissen</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.dark,
    marginBottom: 4,
  },
  subtitle: {
    color: colors.gray,
    marginBottom: spacing.sm,
  },
  activeInfoBanner: {
    backgroundColor: 'rgba(152, 195, 164, 0.18)',
    borderLeftWidth: 4,
    borderLeftColor: colors.secondary,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  activeInfoText: {
    fontSize: 13,
    color: colors.darkLight,
  },
  activeInfoBold: {
    fontWeight: '700',
    color: colors.secondaryDark,
  },
  helperTop: {
    fontSize: 13,
    color: colors.gray,
    marginBottom: spacing.lg,
  },
  bold: {
    fontWeight: '700',
    color: colors.primaryDark,
  },
  emptyBox: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginTop: spacing.md,
    alignItems: 'center',
    ...shadows.sm,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.dark,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: 14,
    color: colors.gray,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  cta: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: radius.md,
    marginTop: spacing.sm,
    minWidth: 200,
    alignItems: 'center',
  },
  ctaText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
  ctaSecondary: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  ctaSecondaryText: {
    color: colors.primary,
  },
  section: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.primaryDark,
    marginBottom: spacing.sm,
  },
  helper: {
    fontSize: 13,
    color: colors.gray,
  },
  allDoneBox: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  allDoneIcon: {
    fontSize: 56,
    marginBottom: spacing.sm,
  },
  allDoneText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.secondaryDark,
  },
  clearBtn: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 18,
    marginTop: spacing.md,
  },
  clearBtnText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
});
