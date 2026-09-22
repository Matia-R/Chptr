export type { AuthContext } from './shared'
export {
  getCurrentUser,
  getCurrentUserProfile,
  isUsernameAvailable,
  updateUserAvatar,
  updateUserProfile,
  type UpdateUserProfileInput,
  type UserProfile,
} from './auth'
export {
  createDocument,
  getDocumentById,
  getLastUpdatedTimestamp,
  getDocumentIdsForUser,
  updateDocumentName,
  trashDocument,
  restoreDocument,
} from './documents'
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
} from './document-publications'
