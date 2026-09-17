-- Soft-delete documents: trash sets deleted_at, restore clears it.
-- Active docs are deleted_at IS NULL. Purge (hard DELETE) is a later job.

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS documents_active_last_updated_idx
  ON public.documents (last_updated DESC)
  WHERE deleted_at IS NULL;

-- Existence for PartyKit 403 vs 404: trashed docs look missing.
CREATE OR REPLACE FUNCTION public.document_exists(p_document_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.documents
    WHERE id = p_document_id
      AND deleted_at IS NULL
  );
$$;

-- Block name/last_updated writes on trashed rows. Trash/restore use DEFINER RPCs.
DROP POLICY IF EXISTS "Users can update their own documents" ON public.documents;
CREATE POLICY "Users can update their own documents" ON public.documents
FOR UPDATE
USING (
  creator_id = (SELECT auth.uid())
  AND deleted_at IS NULL
)
WITH CHECK (
  creator_id = (SELECT auth.uid())
  AND deleted_at IS NULL
);

-- Refuse Y.Doc saves against a trashed parent even if permission rows remain.
CREATE OR REPLACE FUNCTION public.enforce_active_document_state()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.documents d
    WHERE d.id = NEW.document_id
      AND d.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Document is not active' USING ERRCODE = 'PT404';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS document_state_requires_active_document ON public.document_state;
CREATE TRIGGER document_state_requires_active_document
  BEFORE INSERT OR UPDATE ON public.document_state
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_active_document_state();

CREATE OR REPLACE FUNCTION public.trash_document(p_document_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  publication_paths jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'PT401';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.document_permissions
    WHERE document_id = p_document_id
      AND user_id = auth.uid()
      AND permission = 'owner'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.documents WHERE id = p_document_id
    ) THEN
      RAISE EXCEPTION 'Document not found' USING ERRCODE = 'PT404';
    END IF;
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = 'PT403';
  END IF;

  SELECT jsonb_build_object(
    'publication', (
      SELECT jsonb_build_object(
        'owner_username', owner_username,
        'slug', slug
      )
      FROM public.document_publications
      WHERE document_id = p_document_id
    ),
    'redirects', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'from_owner_username', from_owner_username,
        'from_slug', from_slug
      ))
      FROM public.document_publication_redirects
      WHERE document_id = p_document_id
    ), '[]'::jsonb)
  )
  INTO publication_paths;

  UPDATE public.documents
  SET deleted_at = now()
  WHERE id = p_document_id
    AND deleted_at IS NULL;

  DELETE FROM public.document_publications
  WHERE document_id = p_document_id;

  DELETE FROM public.document_publication_redirects
  WHERE document_id = p_document_id;

  RETURN publication_paths;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_document(p_document_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'PT401';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.document_permissions
    WHERE document_id = p_document_id
      AND user_id = auth.uid()
      AND permission = 'owner'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.documents WHERE id = p_document_id
    ) THEN
      RAISE EXCEPTION 'Document not found' USING ERRCODE = 'PT404';
    END IF;
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = 'PT403';
  END IF;

  UPDATE public.documents
  SET deleted_at = NULL
  WHERE id = p_document_id
    AND deleted_at IS NOT NULL;

  IF NOT FOUND THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.documents WHERE id = p_document_id
    ) THEN
      RAISE EXCEPTION 'Document not found' USING ERRCODE = 'PT404';
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.trash_document(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trash_document(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trash_document(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.restore_document(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_document(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_document(uuid) TO service_role;
