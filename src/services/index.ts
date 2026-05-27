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
