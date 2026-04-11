/**
 * RECIPE DETAIL SCREEN
 * Volledige weergave van één recept met sterren, commentaren en favoriet-toggle.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing, shadows } from '../constants/theme';
import { Stars } from '../components/Stars';
import { useToast } from '../components/Toast';
import { useUser } from '../context/UserContext';
import {
  getRecipe,
  getAverageRating,
  getUserRating,
  getComments,
  isFavorite,
  toggleFavorite,
  rateRecipe,
  addComment,
} from '../services';
import type { Recipe, RatingSummary, Comment } from '../types';
import { getMealMomentLabel } from '../constants/data';

export function RecipeDetailScreen({ route, navigation }: any) {
  const { id } = route.params;
  const { user } = useUser();
  const { show } = useToast();

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [fav, setFav] = useState(false);
  const [avgRating, setAvgRating] = useState<RatingSummary>({ average: 0, count: 0 });
  const [userRating, setUserRating] = useState(0);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');

  const load = useCallback(async () => {
    try {
      const [r, isF, avg, uR, cs] = await Promise.all([
        getRecipe(id),
        isFavorite(id, user),
        getAverageRating(id),
        getUserRating(id, user),
        getComments(id),
      ]);
      setRecipe(r);
      setFav(isF);
      setAvgRating(avg);
      setUserRating(uR);
      setComments(cs);
    } catch (err: any) {
      show('Fout: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [id, user, show]);

  useEffect(() => {
    load();
  }, [load]);

  const handleFav = async () => {
    try {
      const isF = await toggleFavorite(id, user);
      setFav(isF);
      show(isF ? 'Toegevoegd aan favorieten' : 'Verwijderd uit favorieten');
    } catch (err: any) {
      show('Fout: ' + err.message, 'error');
    }
  };

  const handleRate = async (n: number) => {
    try {
      await rateRecipe(id, n, user);
      setUserRating(n);
      const avg = await getAverageRating(id);
      setAvgRating(avg);
      show(`Beoordeling: ${n}/5 sterren`);
    } catch (err: any) {
      show('Fout: ' + err.message, 'error');
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) {
      show('Schrijf eerst een reactie', 'error');
      return;
    }
    try {
      const c = await addComment(id, commentText, user);
      if (c) {
        setComments(prev => [...prev, c]);
        setCommentText('');
        show('Reactie geplaatst!');
      }
    } catch (err: any) {
      show('Fout: ' + err.message, 'error');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!recipe) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.emptyIcon}>😕</Text>
        <Text style={styles.emptyTitle}>Recept niet gevonden</Text>
        <Pressable
          style={styles.btnPrimary}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.btnPrimaryText}>Terug</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← Terug</Text>
          </Pressable>

          {recipe.image ? (
            <Image source={{ uri: recipe.image }} style={styles.image} />
          ) : (
            <View style={[styles.image, styles.placeholder]}>
              <Text style={styles.placeholderIcon}>🍽️</Text>
            </View>
          )}

          <Text style={styles.title}>{recipe.name}</Text>

          <Pressable
            style={[styles.favBtn, fav && styles.favBtnActive]}
            onPress={handleFav}
          >
            <Text style={[styles.favBtnText, fav && styles.favBtnTextActive]}>
              {fav ? '❤️  In favorieten' : '🤍  Favoriet maken'}
            </Text>
          </Pressable>

          {/* Info sectie */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Informatie</Text>
            <View style={styles.tagRow}>
              {(recipe.mealMoments || []).map(m => (
                <View key={m} style={styles.tagMoment}>
                  <Text style={styles.tagMomentText}>{getMealMomentLabel(m)}</Text>
                </View>
              ))}
              <View style={styles.tagTime}>
                <Text style={styles.tagTimeText}>⏱ {recipe.cookingTime} min</Text>
              </View>
              <View style={styles.tagPortions}>
                <Text style={styles.tagPortionsText}>
                  🍰 {recipe.portions} {recipe.portions === 1 ? 'portie' : 'porties'}
                </Text>
              </View>
            </View>
            {(recipe.allergens || []).length > 0 && (
              <View style={[styles.tagRow, { marginTop: spacing.sm }]}>
                <Text style={styles.allergenLabel}>Allergenen: </Text>
                {recipe.allergens.map(a => (
                  <View key={a} style={styles.tagAllergen}>
                    <Text style={styles.tagAllergenText}>{a}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Ingrediënten */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Ingrediënten{' '}
              <Text style={styles.sectionSub}>
                (voor {recipe.portions} {recipe.portions === 1 ? 'portie' : 'porties'})
              </Text>
            </Text>
            {(recipe.ingredients || []).map((ing, i) => (
              <View key={i} style={styles.ingredientRow}>
                <Text style={styles.ingredientName}>{ing.name}</Text>
                <Text style={styles.ingredientAmount}>
                  {ing.amount} {ing.unit}
                </Text>
              </View>
            ))}
          </View>

          {/* Bereidingswijze */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Bereidingswijze</Text>
            {(recipe.preparation || []).map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{i + 1}</Text>
                </View>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </View>

          {/* Beoordeling */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Beoordeling</Text>
            <View style={styles.ratingBlock}>
              <Text style={styles.ratingLabel}>Gemiddelde:</Text>
              {avgRating.count > 0 ? (
                <View style={styles.starsInline}>
                  <Stars rating={avgRating.average} size={18} />
                  <Text style={styles.ratingInfo}>
                    {avgRating.average}/5 ({avgRating.count})
                  </Text>
                </View>
              ) : (
                <Text style={styles.ratingMuted}>Nog geen beoordelingen</Text>
              )}
            </View>
            <View style={styles.ratingBlock}>
              <Text style={styles.ratingLabel}>Jouw beoordeling:</Text>
              <View style={styles.starsInline}>
                <Stars
                  rating={userRating}
                  size={26}
                  interactive
                  onChange={handleRate}
                />
                {userRating > 0 && (
                  <Text style={styles.ratingInfo}>({userRating}/5)</Text>
                )}
              </View>
            </View>
          </View>

          {/* Reacties */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Reacties ({comments.length})</Text>
            {comments.length === 0 ? (
              <Text style={styles.ratingMuted}>Nog geen reacties. Wees de eerste!</Text>
            ) : (
              comments.map(c => (
                <View key={c.id} style={styles.commentItem}>
                  <View style={styles.commentHeader}>
                    <Text style={styles.commentAuthor}>{c.userName}</Text>
                    <Text style={styles.commentDate}>
                      {new Date(c.date).toLocaleDateString('nl-BE')}
                    </Text>
                  </View>
                  <Text style={styles.commentText}>{c.text}</Text>
                </View>
              ))
            )}

            <View style={styles.commentForm}>
              <TextInput
                style={styles.commentInput}
                placeholder="Schrijf een reactie..."
                placeholderTextColor={colors.gray}
                value={commentText}
                onChangeText={setCommentText}
                multiline
              />
              <Pressable style={styles.btnPrimary} onPress={handleAddComment}>
                <Text style={styles.btnPrimaryText}>Verstuur</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  scroll: {
    padding: spacing.lg,
    paddingBottom: 60,
  },
  backBtn: {
    paddingVertical: 8,
    marginBottom: spacing.md,
  },
  backText: {
    color: colors.primary,
    fontWeight: '600',
  },
  image: {
    width: '100%',
    height: 240,
    borderRadius: radius.lg,
    backgroundColor: colors.light,
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {
    fontSize: 64,
    color: colors.gray,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.dark,
    marginBottom: spacing.md,
  },
  favBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderWidth: 2,
    borderColor: colors.primary,
    marginBottom: spacing.lg,
  },
  favBtnActive: {
    backgroundColor: colors.primary,
  },
  favBtnText: {
    color: colors.primary,
    fontWeight: '600',
  },
  favBtnTextActive: {
    color: colors.white,
  },
  section: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.primaryDark,
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: colors.light,
  },
  sectionSub: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.gray,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  tagMoment: {
    backgroundColor: 'rgba(152, 195, 164, 0.2)',
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  tagMomentText: { color: '#4a7c59', fontSize: 12, fontWeight: '500' },
  tagTime: {
    backgroundColor: 'rgba(152, 195, 164, 0.15)',
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  tagTimeText: { color: '#4a7c59', fontSize: 12, fontWeight: '500' },
  tagPortions: {
    backgroundColor: 'rgba(221, 164, 97, 0.18)',
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  tagPortionsText: { color: '#8a5a1a', fontSize: 12, fontWeight: '500' },
  allergenLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.dark,
    marginRight: 4,
  },
  tagAllergen: {
    backgroundColor: 'rgba(192, 57, 43, 0.1)',
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  tagAllergenText: { color: colors.danger, fontSize: 12, fontWeight: '500' },
  ingredientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.light,
  },
  ingredientName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.dark,
    flex: 1,
  },
  ingredientAmount: {
    fontSize: 14,
    color: colors.gray,
  },
  stepRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.light,
    gap: 12,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: colors.dark,
    lineHeight: 20,
  },
  ratingBlock: {
    marginBottom: spacing.md,
  },
  ratingLabel: {
    fontWeight: '700',
    color: colors.dark,
    marginBottom: 6,
  },
  starsInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingInfo: {
    color: colors.gray,
    fontSize: 13,
  },
  ratingMuted: {
    color: colors.gray,
    fontStyle: 'italic',
    fontSize: 13,
  },
  commentItem: {
    backgroundColor: colors.bg,
    padding: spacing.md,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  commentAuthor: {
    fontWeight: '600',
    color: colors.primaryDark,
    fontSize: 13,
  },
  commentDate: {
    color: colors.gray,
    fontSize: 11,
  },
  commentText: {
    fontSize: 13,
    color: colors.dark,
    lineHeight: 18,
  },
  commentForm: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  commentInput: {
    borderWidth: 2,
    borderColor: colors.light,
    borderRadius: radius.sm,
    padding: spacing.md,
    fontSize: 14,
    minHeight: 70,
    textAlignVertical: 'top',
    color: colors.dark,
  },
  btnPrimary: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 22,
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: colors.white,
    fontWeight: '600',
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.darkLight,
    marginBottom: spacing.md,
  },
});
