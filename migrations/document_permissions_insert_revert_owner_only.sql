-- Revert document_permissions INSERT policy to allow insert when user_id = auth.uid()
-- (removes owner-only restriction that caused infinite recursion in Supabase).

DROP POLICY IF EXISTS "Allow automatic owner permission assignment" ON public.document_permissions;

CREATE POLICY "Allow automatic owner permission assignment" ON public.document_permissions
FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));
