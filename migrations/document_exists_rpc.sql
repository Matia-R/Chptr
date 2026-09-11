-- Privileged existence check for PartyKit authorize.
-- RLS on documents hides rows the caller cannot access, so a normal SELECT
-- cannot distinguish "no such document" from "no permission". This RPC only
-- returns a boolean and does not leak document content.
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
  );
$$;

REVOKE ALL ON FUNCTION public.document_exists(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.document_exists(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.document_exists(uuid) TO service_role;
