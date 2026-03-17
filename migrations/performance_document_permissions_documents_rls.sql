-- Performance: fix Auth RLS init plan for document_permissions and documents
-- Uses (select auth.uid()) so it is evaluated once per query, not per row.
-- If your policies were created with different USING/WITH CHECK expressions,
-- run "SHOW CREATE POLICY ..." in Supabase SQL and adapt these statements.

-- document_permissions
DROP POLICY IF EXISTS "Users can read their own document permissions" ON public.document_permissions;
CREATE POLICY "Users can read their own document permissions" ON public.document_permissions
FOR SELECT USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Allow automatic owner permission assignment" ON public.document_permissions;
-- Typical pattern: allow insert when assigning permission for current user (e.g. owner)
CREATE POLICY "Allow automatic owner permission assignment" ON public.document_permissions
FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

-- documents
DROP POLICY IF EXISTS "Users can update their own documents" ON public.documents;
CREATE POLICY "Users can update their own documents" ON public.documents
FOR UPDATE USING (creator_id = (SELECT auth.uid()));

-- Optional: document_review_feedback, document_review_run, document_review_criteria
-- also had auth RLS init plan warnings. Apply the same fix there: use
-- (SELECT auth.uid()) instead of auth.uid() in each policy. See:
-- https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan
