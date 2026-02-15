-- CRDT-based document changes table
-- Each row represents a single Yjs update from any client
-- Unique constraint prevents duplicate updates

CREATE TABLE IF NOT EXISTS document_changes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    client_id TEXT NOT NULL,           -- Unique client identifier
    clock BIGINT NOT NULL,             -- Yjs logical clock for this update
    update_data TEXT NOT NULL,         -- Base64-encoded Yjs update binary
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

-- Prevent duplicate updates from same client
UNIQUE(document_id, client_id, clock) );

-- Index for fast document lookup
CREATE INDEX IF NOT EXISTS idx_document_changes_document_id ON document_changes (document_id);

-- Index for ordering by creation time
CREATE INDEX IF NOT EXISTS idx_document_changes_created_at ON document_changes (document_id, created_at);

-- RLS policies (assuming you have RLS enabled)
ALTER TABLE document_changes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read changes for documents they have permission to access
CREATE POLICY "Users can read document changes" ON document_changes FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM document_permissions
            WHERE
                document_permissions.document_id = document_changes.document_id
                AND document_permissions.user_id = auth.uid ()
        )
    );

-- Policy: Users can insert changes for documents they have permission to access
CREATE POLICY "Users can insert document changes" ON document_changes FOR
INSERT
WITH
    CHECK (
        EXISTS (
            SELECT 1
            FROM document_permissions
            WHERE
                document_permissions.document_id = document_changes.document_id
                AND document_permissions.user_id = auth.uid ()
        )
    );