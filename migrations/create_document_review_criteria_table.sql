-- Per-document reviewing criteria for the passive reviewer.
-- One row per document; used to condition the LLM's feedback style.

CREATE TABLE IF NOT EXISTS document_review_criteria (
    document_id UUID PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
    criteria TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE document_review_criteria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read document review criteria"
    ON document_review_criteria FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM document_permissions
            WHERE document_permissions.document_id = document_review_criteria.document_id
              AND document_permissions.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert document review criteria"
    ON document_review_criteria FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM document_permissions
            WHERE document_permissions.document_id = document_review_criteria.document_id
              AND document_permissions.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update document review criteria"
    ON document_review_criteria FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM document_permissions
            WHERE document_permissions.document_id = document_review_criteria.document_id
              AND document_permissions.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM document_permissions
            WHERE document_permissions.document_id = document_review_criteria.document_id
              AND document_permissions.user_id = auth.uid()
        )
    );

