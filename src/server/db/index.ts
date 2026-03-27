export type { AuthContext } from './shared'
export { getCurrentUser, getCurrentUserProfile } from './auth'
export {
  createDocument,
  getDocumentById,
  getLastUpdatedTimestamp,
  getDocumentIdsForUser,
  updateDocumentName,
} from './documents'
export {
  saveDocumentChange,
  saveDocumentChanges,
  getDocumentChanges,
  getDocumentTailCount,
  compactDocument,
} from './document-changes'
export {
  authorDisplayLabel,
  getPublicationByUsernameSlug,
  getPublicationWithAuthorByUsernameSlug,
  getPublicationByDocumentId,
  getPublicationOwnerPathSegmentForDocument,
  publishDocument,
  unpublishDocument,
  type DocumentPublicationRow,
  type PublishedAuthorProfileRow,
} from './document-publications'
