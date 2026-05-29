/**
 * SERVICES — barrel export
 *
 * Alle service-functies worden hier gebundeld zodat screens
 * met één import-regel alles kunnen ophalen:
 *
 *   import { getRecipes, rateRecipe, toggleFavorite } from '../services';
 *
 * Elke service leeft in zijn eigen bestand voor overzicht.
 */

export { clearCache } from './cache';
export {
  checkAllowedUser,
  checkCanSignUp,
  signUp,
  signIn,
  signOut,
  resetPassword,
  getSession,
  onAuthStateChange,
} from './auth';
export { getRecipes, getRecipe, getRecipesByIds } from './recipes';
export {
  getAllRatings,
  getAverageRating,
  getUserRating,
  getAllUserRatings,
  rateRecipe,
} from './ratings';
export { getComments, addComment } from './comments';
export {
  getFavoriteRecipeIds,
  isFavorite,
  toggleFavorite,
  getFavoriteRecipes,
} from './favorites';
export {
  getSavedSchedules,
  getSchedule,
  saveSchedule,
  deleteSchedule,
  getActiveSchedule,
  setActiveSchedule,
  deactivateSchedule,
} from './schedules';
export {
  getIngredientIconMap,
  getIngredientIconMaps,
  clearIngredientIconCache,
} from './ingredientIcons';
export type { IngredientIconMaps } from './ingredientIcons';
export {
  getMemoryEnabled,
  setMemoryEnabled,
  exportUserData,
  deleteAccount,
} from './profile';
export {
  getCommunityProfile,
  updateCommunityProfile,
  getAvatarUploadUrl,
  uploadAvatarToStorage,
  NICKNAME_REGEX,
} from './communityProfile';
export type { CommunityProfile } from './communityProfile';
export {
  listPosts,
  createPost,
  togglePostLike,
  toggleReplyLike,
  listReplies,
  createReply,
  editPost,
  deletePost,
  editReply,
  togglePostPin,
  getIsAdmin,
  categoryInfo,
  POST_CATEGORIES,
  POST_BODY_MAX,
  REPLY_BODY_MAX,
} from './community';
/* NB: community.deleteReply botst met chatRooms.deleteReply — TimelineScreen
   importeert de community-variant rechtstreeks uit './community'. */
export type {
  CommunityPost,
  CommunityReply,
  CategoryInfo,
} from './community';
/* NB: createReply + REPLY_BODY_MAX bestaan ook in community.ts — die
   botsing vermijden we door de chatRooms-varianten niet via de barrel
   te exporteren. ChatTopicScreen importeert ze rechtstreeks uit
   './chatRooms'. */
export {
  listRooms,
  getRoom,
  getTopic,
  createTopic,
  updateTopic,
  deleteTopic,
  updateReply,
  deleteReply,
  getUnread,
  followRoom,
  unfollowRoom,
  markRoomRead,
  followTopic,
  unfollowTopic,
  markTopicRead,
  pinTopic,
  updateRoom,
  getCurrentUserId,
  isWithinEditWindow,
  roomEmoji,
  ROOMS,
  TOPIC_TITLE_MAX,
  TOPIC_BODY_MAX,
  ADMIN_INTRO_MAX,
  EDIT_WINDOW_MS,
} from './chatRooms';
export type {
  ChatRoom,
  ChatRoomDetail,
  ChatTopic,
  ChatReply,
  AdminIntro,
  UnreadCounts,
} from './chatRooms';
export {
  getChildren,
  createChild,
  updateChild,
  archiveChild,
  BIRTHDATE_REGEX,
  KNOWN_ALLERGEN_OPTIONS,
  ageInMonths,
  formatAge,
} from './children';
export type { Child, ChildInput } from './children';
export {
  getFamilyDiet,
  setFamilyDiet,
  DIET_OPTIONS,
  MAX_DIET_ITEMS,
} from './family';
export {
  getMemories,
  deleteMemory,
  deleteAllMemories,
  relTime,
} from './memory';
export type { Memory } from './memory';
export {
  countNewAdminTimelinePosts,
  countNewAdminChatroomPosts,
} from './notifications';
export {
  ALLERGEN_FLOW,
  ALLERGEN_COOLDOWN_DAYS,
  ALLERGEN_TARGET_DOSES,
  REACTION_LEVELS,
  SYMPTOM_TYPES,
  SYMPTOM_SEVERITIES,
  getEhState,
  patchEhState,
  getEhDoses,
  createEhDose,
  updateEhDose,
  deleteEhDose,
  getEhSymptoms,
  createEhSymptom,
  updateEhSymptom,
  deleteEhSymptom,
  buildAllergenContext,
  getAllergenStatus,
  successfulDoseCount,
  nextDoseNumber,
  todayIsoDate,
  isRedFlag,
  symptomTypeInfo,
} from './eersteHapjes';
export type {
  AllergenFlowItem,
  ReactionLevel,
  ReactionLevelInfo,
  AllergenStatus,
  AllergenStateData,
  EhState,
  EhDose,
  EhDoseInput,
  AllergenContext,
  SymptomType,
  SymptomTypeInfo,
  SymptomSeverity,
  SymptomSeverityInfo,
  TimeAfterEating,
  SymptomDuration,
  SymptomWorsened,
  SymptomBehavior,
  EhSymptom,
  EhSymptomInput,
} from './eersteHapjes';
