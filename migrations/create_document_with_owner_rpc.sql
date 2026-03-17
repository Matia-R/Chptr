-- Create document using auth.uid() in the DB so RLS and session always match.
-- Trigger assign_owner_permission_on_document_insert adds the owner permission.
-- Idempotent: ON CONFLICT (id) DO NOTHING.

CREATE OR REPLACE FUNCTION public.create_document_with_owner(
  p_document_id uuid,
  p_name text DEFAULT 'Untitled'
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  INSERT INTO public.documents (id, creator_id, name)
  VALUES (p_document_id, auth.uid(), COALESCE(NULLIF(trim(p_name), ''), 'Untitled'))
  ON CONFLICT (id) DO NOTHING;
END;
$$;
