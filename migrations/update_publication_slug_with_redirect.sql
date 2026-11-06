-- Atomically retarget a published slug and record the old path as a redirect.
-- SECURITY INVOKER so the existing editor RLS policies still apply.
-- Does not touch document_publications.updated_at: a slug edit is not a republish.

CREATE OR REPLACE FUNCTION public.update_publication_slug_with_redirect(
  p_document_id uuid,
  p_slug text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_owner text;
  v_old_slug text;
  v_creator uuid;
  v_updated integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.document_permissions
    WHERE document_id = p_document_id
      AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'You do not have permission to edit this document'
      USING ERRCODE = '42501';
  END IF;

  SELECT owner_username, slug, creator_id
  INTO v_owner, v_old_slug, v_creator
  FROM public.document_publications
  WHERE document_id = p_document_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This document is not published' USING ERRCODE = 'P0002';
  END IF;

  IF v_old_slug = p_slug THEN
    RETURN;
  END IF;

  UPDATE public.document_publications
  SET slug = p_slug
  WHERE document_id = p_document_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'You do not have permission to edit this document'
      USING ERRCODE = '42501';
  END IF;

  -- A redirect from the new path back to the old one would become an identity row.
  DELETE FROM public.document_publication_redirects
  WHERE to_owner_username = v_owner
    AND to_slug = v_old_slug
    AND from_owner_username = v_owner
    AND from_slug = p_slug;

  UPDATE public.document_publication_redirects
  SET
    to_owner_username = v_owner,
    to_slug = p_slug,
    updated_at = now()
  WHERE to_owner_username = v_owner
    AND to_slug = v_old_slug;

  -- The live path must not also be a redirect source.
  DELETE FROM public.document_publication_redirects
  WHERE from_owner_username = v_owner
    AND from_slug = p_slug;

  INSERT INTO public.document_publication_redirects (
    from_owner_username,
    from_slug,
    to_owner_username,
    to_slug,
    document_id,
    creator_id,
    updated_at
  )
  VALUES (
    v_owner,
    v_old_slug,
    v_owner,
    p_slug,
    p_document_id,
    v_creator,
    now()
  )
  ON CONFLICT (from_owner_username, from_slug)
  DO UPDATE SET
    to_owner_username = EXCLUDED.to_owner_username,
    to_slug = EXCLUDED.to_slug,
    document_id = EXCLUDED.document_id,
    creator_id = EXCLUDED.creator_id,
    updated_at = EXCLUDED.updated_at;
END;
$$;

REVOKE ALL ON FUNCTION public.update_publication_slug_with_redirect(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_publication_slug_with_redirect(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_publication_slug_with_redirect(uuid, text) TO service_role;
