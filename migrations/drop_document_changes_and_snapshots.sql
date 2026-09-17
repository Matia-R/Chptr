-- Drop legacy CRDT change-log tables (replaced by document_state / PartyKit).
-- Safe after data has been migrated into document_state.

DROP TRIGGER IF EXISTS document_changes_touch_last_updated ON public.document_changes;
DROP FUNCTION IF EXISTS public.touch_document_last_updated_on_change();

DROP TABLE IF EXISTS document_changes;
DROP TABLE IF EXISTS document_snapshots;
