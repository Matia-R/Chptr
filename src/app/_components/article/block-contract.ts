/**
 * Custom blocks that exist in the editor and must not appear on the
 * published page. Their children are the published content.
 * Add a type here in the same change that registers its editor spec.
 */
export const EDITOR_ONLY_BLOCK_TYPES = new Set(["aiPromptInput"]);
