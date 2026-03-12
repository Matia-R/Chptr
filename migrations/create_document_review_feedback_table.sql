-- AI review feedback per block. Keyed by (document_id, content_hash) so all clients
-- see the same feedback; content_hash is derived from block markdown (stable across
-- sessions; block IDs are not stable). Enable Realtime in Supabase Dashboard:
-- Database > Replication > document_review_feedback > ON.

CREATE TABLE IF NOT EXISTS document_review_feedback (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    content_hash TEXT NOT NULL,
    suggestions JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(document_id, content_hash)
);

CREATE INDEX IF NOT EXISTS idx_document_review_feedback_document_id
    ON document_review_feedback (document_id);

ALTER TABLE document_review_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read document review feedback"
    ON document_review_feedback FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM document_permissions
            WHERE document_permissions.document_id = document_review_feedback.document_id
              AND document_permissions.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert document review feedback"
    ON document_review_feedback FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM document_permissions
            WHERE document_permissions.document_id = document_review_feedback.document_id
              AND document_permissions.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update document review feedback"
    ON document_review_feedback FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM document_permissions
            WHERE document_permissions.document_id = document_review_feedback.document_id
              AND document_permissions.user_id = auth.uid()
        )
    );
