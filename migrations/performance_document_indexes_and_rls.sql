-- Performance: Supabase Advisor recommendations for document-related actions
-- 1) Unindexed foreign keys → add indexes
-- 2) Auth RLS init plan → use (select auth.uid()) so it's evaluated once per query

-- -----------------------------------------------------------------------------
-- 1. Indexes for foreign keys (speeds up JOINs and permission lookups)
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_document_permissions_user_id
  ON public.document_permissions (user_id);

CREATE INDEX IF NOT EXISTS idx_documents_creator_id
  ON public.documents (creator_id);

-- -----------------------------------------------------------------------------
-- 2. document_changes: fix RLS to use (select auth.uid()) once per query
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read document changes" ON public.document_changes;
CREATE POLICY "Users can read document changes" ON public.document_changes
FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM public.document_permissions
    WHERE document_permissions.document_id = document_changes.document_id
      AND document_permissions.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can insert document changes" ON public.document_changes;
CREATE POLICY "Users can insert document changes" ON public.document_changes
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.document_permissions
    WHERE document_permissions.document_id = document_changes.document_id
      AND document_permissions.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can delete document changes" ON public.document_changes;
CREATE POLICY "Users can delete document changes" ON public.document_changes
FOR DELETE USING (
  EXISTS (
    SELECT 1
    FROM public.document_permissions
    WHERE document_permissions.document_id = document_changes.document_id
      AND document_permissions.user_id = (SELECT auth.uid())
  )
);

-- -----------------------------------------------------------------------------
-- 3. document_snapshots: fix RLS to use (select auth.uid()) once per query
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read document snapshots" ON public.document_snapshots;
CREATE POLICY "Users can read document snapshots" ON public.document_snapshots
FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM public.document_permissions
    WHERE document_permissions.document_id = document_snapshots.document_id
      AND document_permissions.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can insert and update document snapshots" ON public.document_snapshots;
CREATE POLICY "Users can insert and update document snapshots" ON public.document_snapshots
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.document_permissions
    WHERE document_permissions.document_id = document_snapshots.document_id
      AND document_permissions.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can update document snapshots" ON public.document_snapshots;
CREATE POLICY "Users can update document snapshots" ON public.document_snapshots
FOR UPDATE USING (
  EXISTS (
    SELECT 1
    FROM public.document_permissions
    WHERE document_permissions.document_id = document_snapshots.document_id
      AND document_permissions.user_id = (SELECT auth.uid())
  )
);
