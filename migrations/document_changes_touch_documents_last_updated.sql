-- Keep documents.last_updated in sync when Yjs/CRDT updates are saved to document_changes.
-- Application code only updated last_updated on rename; collaborative edits never touched it.
-- SECURITY DEFINER so the update succeeds for any collaborator who can INSERT into document_changes
-- (RLS on documents only allows the creator to UPDATE directly).

CREATE OR REPLACE FUNCTION public.touch_document_last_updated_on_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.documents
  SET last_updated = NOW()
  WHERE id = NEW.document_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS document_changes_touch_last_updated ON public.document_changes;

CREATE TRIGGER document_changes_touch_last_updated
  AFTER INSERT ON public.document_changes
  FOR EACH ROW
  EXECUTE PROCEDURE public.touch_document_last_updated_on_change();
