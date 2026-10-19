export type { AuthContext } from "./shared";
export {
  getCurrentUser,
  getCurrentUserProfile,
  getHandleAvailability,
  isUsernameAvailable,
  suggestAvailableHandle,
  acceptSuggestedAvatar,
  completeOnboarding,
  saveOnboardingProgress,
  updateUserAvatar,
  updateUserProfile,
  type OnboardingProgressInput,
  type UpdateUserProfileInput,
  type UserProfile,
} from "./auth";
export {
  createDocument,
  getDocumentById,
  getLastUpdatedTimestamp,
  getDocumentIdsForUser,
  updateDocumentName,
  trashDocument,
  restoreDocument,
} from "./documents";
export {
  authorDisplayLabel,
  getPublicationByUsernameSlug,
  getPublicationWithAuthorByUsernameSlug,
  getCachedPublicationRedirectByUsernameSlug,
  getPublicationRedirectByUsernameSlug,
  getPublicationByDocumentId,
  getPublicationOwnerPathSegmentForDocument,
  publishDocument,
  unpublishDocument,
  type DocumentPublicationRow,
  type PublishedAuthorProfileRow,
} from "./document-publications";
