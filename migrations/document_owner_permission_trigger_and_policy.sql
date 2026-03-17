-- Assign owner permission automatically when a document is created.
--
-- 1. Trigger on documents: after INSERT, add one row to document_permissions for
--    the creator as owner. RLS still applies to the trigger's insert (session user),
--    so the INSERT policy must allow that row (user_id = auth.uid()).
-- 2. document_permissions INSERT: allow only user_id = auth.uid(). Referencing
--    document_permissions or documents in WITH CHECK caused infinite recursion.

-- -----------------------------------------------------------------------------
-- 1. Trigger function: assign owner permission on document insert
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_owner_permission_on_document_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.document_permissions (document_id, user_id, permission)
  VALUES (NEW.id, NEW.creator_id, 'owner');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS after_insert_document_assign_owner_permission ON public.documents;
CREATE TRIGGER after_insert_document_assign_owner_permission
  AFTER INSERT ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_owner_permission_on_document_insert();

-- -----------------------------------------------------------------------------
-- 2. document_permissions INSERT: self only (allows trigger; avoids recursion)
--    Any WITH CHECK that referenced document_permissions or documents caused
--    infinite recursion. RLS cannot enforce "owner only" here; API must not
--    create owner permission for existing documents.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow automatic owner permission assignment" ON public.document_permissions;

CREATE POLICY "Allow automatic owner permission assignment" ON public.document_permissions
FOR INSERT
WITH CHECK (user_id = (SELECT auth.uid()));
