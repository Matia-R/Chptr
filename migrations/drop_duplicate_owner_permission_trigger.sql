-- Remove duplicate trigger: both after_insert_document_assign_owner_permission and
-- trigger_insert_owner_permission insert owner permission on document insert, causing
-- duplicate key on document_permissions (document_id, user_id). Keep the former, drop the latter.

DROP TRIGGER IF EXISTS trigger_insert_owner_permission ON public.documents;
