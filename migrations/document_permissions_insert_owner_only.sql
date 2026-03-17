-- Restrict document_permissions INSERT to owner bootstrap only: caller may insert
-- a permission for themselves only when the document is owned by them (creator_id = auth.uid()).
-- Prevents privilege escalation via sharing paths.

DROP POLICY IF EXISTS "Allow automatic owner permission assignment" ON public.document_permissions;

CREATE POLICY "Allow automatic owner permission assignment" ON public.document_permissions
FOR INSERT WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1
        FROM public.documents d
        WHERE d.id = document_permissions.document_id
          AND d.creator_id = (SELECT auth.uid())
    )
);
