-- Add WITH CHECK to document_snapshots UPDATE policy so the new row is validated
-- (prevents reassignment of document_id to a document the user cannot access).
-- PostgreSQL does not support altering a policy to add WITH CHECK; drop and recreate.

DROP POLICY IF EXISTS "Users can update document snapshots" ON document_snapshots;

CREATE POLICY "Users can update document snapshots" ON document_snapshots FOR
UPDATE USING (
    EXISTS (
        SELECT 1
        FROM document_permissions
        WHERE document_permissions.document_id = document_snapshots.document_id
          AND document_permissions.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM document_permissions
        WHERE document_permissions.document_id = document_snapshots.document_id
          AND document_permissions.user_id = auth.uid()
    )
);
