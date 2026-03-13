/**
 * Compaction tuning: shared by db layer (compactDocument) and document router (save trigger).
 * Kept in a separate module to avoid circular dependencies between db and routers.
 */

/** Tail count above this triggers compaction after save. */
export const COMPACTION_TAIL_THRESHOLD = 100;

/** Max tail rows to process in one compaction run (timeout safety). */
export const COMPACTION_CAP = 3000;
