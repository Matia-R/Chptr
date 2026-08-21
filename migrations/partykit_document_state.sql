-- PartyKit document state table
-- Replaces document_changes + document_snapshots with a single table
-- PartyKit server is the only writer, storing full Y.Doc state

-- Create new simplified table
CREATE TABLE IF NOT EXISTS document_state (
    document_id UUID NOT NULL PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
    state_data BYTEA NOT NULL,              -- Full Y.Doc state (Y.encodeStateAsUpdate)
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for querying by update time (useful for cleanup/analytics)
CREATE INDEX IF NOT EXISTS idx_document_state_updated_at ON document_state (updated_at);

-- RLS policies
ALTER TABLE document_state ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read state for documents they have permission to access
CREATE POLICY "Users can read document state" ON document_state FOR
SELECT USING (
    EXISTS (
        SELECT 1
        FROM document_permissions
        WHERE document_permissions.document_id = document_state.document_id
          AND document_permissions.user_id = auth.uid()
    )
);

-- Policy: Users can insert state for documents they have permission to access
CREATE POLICY "Users can insert document state" ON document_state FOR
INSERT WITH CHECK (
    EXISTS (
        SELECT 1
        FROM document_permissions
        WHERE document_permissions.document_id = document_state.document_id
          AND document_permissions.user_id = auth.uid()
    )
);

-- Policy: Users can update state for documents they have permission to access
CREATE POLICY "Users can update document state" ON document_state FOR
UPDATE USING (
    EXISTS (
        SELECT 1
        FROM document_permissions
        WHERE document_permissions.document_id = document_state.document_id
          AND document_permissions.user_id = auth.uid()
    )
);

-- Optional: Drop old tables if migrating (uncomment when ready)
-- DROP TABLE IF EXISTS document_changes;
-- DROP TABLE IF EXISTS document_snapshots;
