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
import { CompactHeader } from '../navigation/RootStack';
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
  getActiveSchedule,
  getChildren,
} from '../services';
import type { Child } from '../services';
import type { Recipe, RatingSummary, Comment } from '../types';
import { getMealMomentLabel, WEEKDAYS, SCHEDULE_SLOTS, getSlotLabel } from '../constants/data';
import {
  evaluateFamily,
  getAllergenLabel,
  getRecipeAgeLabel,
  normalizeAllergen,
  type ChildEvaluation,
  type FamilyStatus,
} from '../lib/familyLayer';

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
  const [children, setChildren] = useState<Child[]>([]);
  const [activeInfo, setActiveInfo] = useState<{
    persons: number;
    portions: number;
    X: number;
    occurrences: number;
    daySlots: string[];
    selectedDays: number;
  } | null>(null);

  const load = useCallback(async () => {
    try {
      const [r, isF, avg, uR, cs, activeSch, kids] = await Promise.all([
        getRecipe(id),
        isFavorite(id, user),
        getAverageRating(id),
        getUserRating(id, user),
        getComments(id),
        getActiveSchedule(user),
        /* Kinderen (family-layer) — defensief: een fout hier mag het
           recept niet blokkeren. */
        getChildren().catch(() => [] as Child[]),
      ]);
      setRecipe(r);
      setFav(isF);
      setAvgRating(avg);
      setUserRating(uR);
      setComments(cs);
      setChildren(kids);

      // Check of dit recept in het actieve schema zit
      if (activeSch && r) {
        const daySlots: string[] = [];
        WEEKDAYS.forEach(day => {
          SCHEDULE_SLOTS.forEach(slot => {
            if (activeSch.days?.[day]?.[slot.id] === id) {
              const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);
              daySlots.push(`${dayLabel} - ${getSlotLabel(slot.id)}`);
            }
          });
        });

        if (daySlots.length > 0) {
          const persons = activeSch.persons || 4;
          const portions = r.portions || 1;
          const X = Math.max(1, Math.ceil(persons / portions));
          setActiveInfo({
            persons,
            portions,
            X,
            occurrences: daySlots.length,
            daySlots,
            selectedDays: 1,
          });
        } else {
          setActiveInfo(null);
        }
      } else {
        setActiveInfo(null);
      }
    } catch (err: any) {
      show('Fout: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [id, user, show]);

  useEffect(() => {
    load();
  }, [load]);

  const goToLanding = useCallback(() => {
    navigation.getParent()?.getParent()?.goBack();
  }, [navigation]);

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
    <SafeAreaView style={styles.container} edges={[]}>
      <CompactHeader
        onBack={() => navigation.goBack()}
        onHome={goToLanding}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
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
            <View style={styles.sectionTitleRow}>
              <Text style={[styles.sectionTitle, styles.sectionTitleInRow]}>
                Informatie
              </Text>
              {getRecipeAgeLabel(recipe) ? (
                <View style={styles.ageBadgeLg}>
                  <Text style={styles.ageBadgeLgText}>{getRecipeAgeLabel(recipe)}</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.tagRow}>
              {(recipe.mealMoments || []).map(m => (
                <View key={m} style={styles.tagMoment}>
                  <Text style={styles.tagMomentText}>{getMealMomentLabel(m)}</Text>
                </View>
              ))}
              <View style={styles.tagTime}>
                <Text style={styles.tagTimeText}>⏱ {recipe.cookingTime} min</Text>
              </View>
              {!activeInfo && (
                <View style={styles.tagPortions}>
                  <Text style={styles.tagPortionsText}>
                    🍰 {recipe.portions} {recipe.portions === 1 ? 'portie' : 'porties'}
                  </Text>
                </View>
              )}
            </View>
            {(recipe.allergens || []).length > 0 && (
              <View style={[styles.tagRow, { marginTop: spacing.sm }]}>
                <Text style={styles.allergenLabel}>Allergenen: </Text>
                {[...new Set((recipe.allergens || []).map(normalizeAllergen))].map(key => (
                  <View key={key} style={styles.tagAllergen}>
                    <Text style={styles.tagAllergenText}>{getAllergenLabel(key)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Voor jouw gezin (family-layer) */}
          <FamilyLayer recipe={recipe} children={children} />

          {/* Actief weekschema info */}
          {activeInfo && (
            <View style={styles.activeScheduleInfo}>
              <View style={styles.dayPills}>
                {activeInfo.daySlots.map((ds, i) => (
                  <View key={i} style={styles.dayPill}>
                    <Text style={styles.dayPillText}>{ds}</Text>
                  </View>
                ))}
              </View>
              {activeInfo.occurrences >= 2 && (
                <>
                  <Text style={styles.daySelectorHint}>
                    Recept komt meer dan 1 keer voor in je actief weekschema.
                    Selecteer voor hoeveel dagen je het recept wil voorbereiden.
                  </Text>
                  <View style={styles.daySelectorBar}>
                    {Array.from({ length: activeInfo.occurrences }, (_, i) => i + 1).map(n => (
                      <Pressable
                        key={n}
                        style={[
                          styles.daySelectorBtn,
                          activeInfo.selectedDays === n && styles.daySelectorBtnActive,
                        ]}
                        onPress={() =>
                          setActiveInfo(prev => prev ? { ...prev, selectedDays: n } : null)
                        }
                      >
                        <Text
                          style={[
                            styles.daySelectorBtnText,
                            activeInfo.selectedDays === n && styles.daySelectorBtnTextActive,
                          ]}
                        >
                          {n === 1 ? '1 dag' : `${n} dagen`}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}
            </View>
          )}

          {/* Ingrediënten */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Ingrediënten{' '}
              <Text style={styles.sectionSub}>
                {activeInfo
                  ? `(${activeInfo.X * activeInfo.portions * activeInfo.selectedDays} ${
                      activeInfo.X * activeInfo.portions * activeInfo.selectedDays === 1
                        ? 'portie'
                        : 'porties'
                    } · ${activeInfo.persons} personen)`
                  : `(voor ${recipe.portions} ${recipe.portions === 1 ? 'portie' : 'porties'})`}
              </Text>
            </Text>
            {(recipe.ingredients || []).map((ing, i) => {
              const amount = parseFloat(ing.amount as any);
              let displayAmount: string;
              if (activeInfo && !isNaN(amount)) {
                const multiplier = activeInfo.X * activeInfo.selectedDays;
                const adjusted = Math.max(1, Math.ceil(amount * multiplier * 100) / 100);
                displayAmount = Number.isInteger(adjusted)
                  ? adjusted.toString()
                  : adjusted
                      .toFixed(2)
                      .replace(/\.?0+$/, '')
                      .replace('.', ',');
              } else {
                displayAmount = String(ing.amount);
              }
              return (
                <View key={i} style={styles.ingredientRow}>
                  <Text style={styles.ingredientName}>{ing.name}</Text>
                  <Text style={styles.ingredientAmount}>
                    {displayAmount} {ing.unit}
                  </Text>
                </View>
              );
            })}
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

            {/* Algemene babyhapje-uitleg (papje vs. stukjes) */}
            <BabyPrepTips />
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

/* ----------------------------------------
   FAMILY-LAYER — "Voor jouw gezin"
   Per kind: avatar + status-badge, met gekleurde waarschuwing eronder
   voor kinderen met een issue. Puur informatief.
---------------------------------------- */
const FAMILY_WARN_COLORS: Record<FamilyStatus, { border: string; bg: string }> = {
  rood: { border: colors.danger, bg: 'rgba(192, 57, 43, 0.08)' },
  jong: { border: colors.info, bg: 'rgba(93, 173, 226, 0.10)' },
  oranje: { border: '#e67e22', bg: 'rgba(230, 126, 34, 0.10)' },
  ok: { border: colors.secondary, bg: 'rgba(152, 195, 164, 0.10)' },
};

function FamilyLayer({
  recipe,
  children,
}: {
  recipe: Recipe;
  children: Child[];
}) {
  if (!children || children.length === 0) return null;

  const evaluated: ChildEvaluation[] = evaluateFamily(recipe, children);
  const warnings = evaluated.filter(e => e.warnTitle);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Voor jouw gezin</Text>

      <View style={styles.familyAvatars}>
        {evaluated.map(e => (
          <View key={e.child.id} style={styles.familyAvatar}>
            <View style={[styles.familyAvatarCircle, { backgroundColor: e.color }]}>
              <Text style={styles.familyAvatarInitials}>{e.initials}</Text>
              <View style={styles.familyAvatarBadge}>
                <Text style={styles.familyAvatarBadgeText}>{e.icon}</Text>
              </View>
            </View>
            <Text style={styles.familyAvatarName} numberOfLines={1}>
              {e.child.name}
            </Text>
            <Text style={styles.familyAvatarAge}>{e.ageLabel}</Text>
          </View>
        ))}
      </View>

      {warnings.map(e => {
        const c = FAMILY_WARN_COLORS[e.status];
        return (
          <View
            key={e.child.id}
            style={[
              styles.familyWarn,
              { borderLeftColor: c.border, backgroundColor: c.bg },
            ]}
          >
            <Text style={styles.familyWarnTitle}>
              {e.icon} {e.warnTitle}
            </Text>
            <Text style={styles.familyWarnText}>{e.warnText}</Text>
          </View>
        );
      })}

      <Text style={styles.familyNote}>Informatief, geen medisch advies.</Text>
    </View>
  );
}

/* ----------------------------------------
   BABYHAPJE-TIPS — uitklapbaar (papje vs. stukjes)
   Generiek blok, zelfde inhoud bij elk recept.
---------------------------------------- */
const BABY_PREP_PAPJE = [
  'Groenten 15-20 min stomen of koken (geen bakken/grillen).',
  'Vlees en vis meestomen; een eitje koken of bakken en meemixen.',
  'Verdun bij de start met wat (moeder)melk.',
  'Naar stukjes overschakelen? Plet met een vork i.p.v. mixen.',
];
const BABY_PREP_STUKJES = [
  'Stukken zo groot als 2 volwassen vingers, pletbaar tussen duim en wijsvinger.',
  'Groenten 5-10 min stomen; harde stukken fruit (appel) kort garen.',
  'Snijd ronde soorten (druif, kerstomaat, bes) overlangs — verstikkingsrisico.',
  'Vlees en vis volledig garen; vis uit blik tot reepjes drukken.',
  'Geen hele noten (gevaarlijk) — gebruik notenpasta; peulvruchten als dip.',
];

function BabyPrepTips() {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.babyPrep}>
      <Pressable
        style={styles.babyPrepSummary}
        onPress={() => setOpen(o => !o)}
      >
        <Text style={styles.babyPrepSummaryText}>
          Kinderhapje maken — papje of stukjes
        </Text>
        <Text style={styles.babyPrepChevron}>{open ? '▾' : '▸'}</Text>
      </Pressable>

      {open && (
        <View style={styles.babyPrepBody}>
          <Text style={styles.babyPrepIntro}>
            Papje en stukjes zijn perfect combineerbaar — kies wat bij jouw
            kindje past. Rond 6 mnd eet het met de hele hand, rond 9 mnd
            ontwikkelt zich de pincetgreep voor kleinere stukjes.
          </Text>

          <Text style={styles.babyPrepHeading}>Papje</Text>
          {BABY_PREP_PAPJE.map((li, i) => (
            <View key={i} style={styles.babyPrepLi}>
              <Text style={styles.babyPrepBullet}>•</Text>
              <Text style={styles.babyPrepLiText}>{li}</Text>
            </View>
          ))}

          <Text style={styles.babyPrepHeading}>Stukjes</Text>
          {BABY_PREP_STUKJES.map((li, i) => (
            <View key={i} style={styles.babyPrepLi}>
              <Text style={styles.babyPrepBullet}>•</Text>
              <Text style={styles.babyPrepLiText}>{li}</Text>
            </View>
          ))}

          <Text style={styles.babyPrepNote}>Informatief, geen medisch advies.</Text>
        </View>
      )}
    </View>
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
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 4,
    marginBottom: spacing.sm,
  },
  backChevron: {
    fontSize: 32,
    color: colors.primary,
    fontWeight: '300',
    lineHeight: 32,
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
  /* Variant: titel in een rij met een leeftijd-badge ernaast.
     De onderlijn verhuist naar de rij-container (sectionTitleRow). */
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: colors.light,
  },
  sectionTitleInRow: {
    flexShrink: 1,
    marginBottom: 0,
    paddingBottom: 0,
    borderBottomWidth: 0,
  },
  ageBadgeLg: {
    flexShrink: 0,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(152, 195, 164, 0.25)',
  },
  ageBadgeLgText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4a7c59',
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
  activeScheduleInfo: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.secondary,
    ...shadows.sm,
  },
  dayPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.sm,
  },
  dayPill: {
    backgroundColor: 'rgba(152, 195, 164, 0.2)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  dayPillText: {
    color: '#4a7c59',
    fontSize: 12,
    fontWeight: '500',
  },
  daySelectorHint: {
    fontSize: 12,
    color: colors.gray,
    marginBottom: spacing.sm,
  },
  daySelectorBar: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  daySelectorBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 4,
  },
  daySelectorBtnActive: {
    backgroundColor: colors.primary,
  },
  daySelectorBtnText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '500',
  },
  daySelectorBtnTextActive: {
    color: colors.white,
  },
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

  /* Family-layer */
  familyAvatars: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  familyAvatar: {
    alignItems: 'center',
    width: 64,
  },
  familyAvatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  familyAvatarInitials: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 16,
  },
  familyAvatarBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  familyAvatarBadgeText: {
    fontSize: 11,
  },
  familyAvatarName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.dark,
    maxWidth: 64,
    textAlign: 'center',
  },
  familyAvatarAge: {
    fontSize: 11,
    color: colors.gray,
  },
  familyWarn: {
    borderLeftWidth: 4,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  familyWarnTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.dark,
    marginBottom: 2,
  },
  familyWarnText: {
    fontSize: 13,
    color: colors.darkLight,
    lineHeight: 18,
  },
  familyNote: {
    fontSize: 11,
    fontStyle: 'italic',
    color: colors.gray,
    marginTop: spacing.sm,
  },

  /* Babyhapje-tips (uitklapbaar) */
  babyPrep: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.light,
    paddingTop: spacing.sm,
  },
  babyPrepSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  babyPrepSummaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primaryDark,
    flex: 1,
  },
  babyPrepChevron: {
    fontSize: 14,
    color: colors.primaryDark,
    marginLeft: spacing.sm,
  },
  babyPrepBody: {
    paddingTop: spacing.xs,
  },
  babyPrepIntro: {
    fontSize: 13,
    color: colors.darkLight,
    lineHeight: 19,
    marginBottom: spacing.sm,
  },
  babyPrepHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.dark,
    marginTop: spacing.sm,
    marginBottom: 4,
  },
  babyPrepLi: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  babyPrepBullet: {
    fontSize: 13,
    color: colors.primary,
    lineHeight: 19,
  },
  babyPrepLiText: {
    flex: 1,
    fontSize: 13,
    color: colors.darkLight,
    lineHeight: 19,
  },
  babyPrepNote: {
    fontSize: 11,
    fontStyle: 'italic',
    color: colors.gray,
    marginTop: spacing.sm,
  },
});
