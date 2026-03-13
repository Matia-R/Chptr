-- Snapshot + tail compaction: one compressed Yjs state per document
-- Compaction writes here and deletes covered rows from document_changes

CREATE TABLE IF NOT EXISTS document_snapshots (
    document_id UUID NOT NULL PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
    snapshot_data TEXT NOT NULL,
    snapshot_cutoff_created_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- RLS: same as document_changes (read/insert for users with document permission)
ALTER TABLE document_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read document snapshots" ON document_snapshots FOR
SELECT USING (
    EXISTS (
        SELECT 1
        FROM document_permissions
        WHERE document_permissions.document_id = document_snapshots.document_id
          AND document_permissions.user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert and update document snapshots" ON document_snapshots FOR
INSERT WITH CHECK (
    EXISTS (
        SELECT 1
        FROM document_permissions
        WHERE document_permissions.document_id = document_snapshots.document_id
          AND document_permissions.user_id = auth.uid()
    )
);

CREATE POLICY "Users can update document snapshots" ON document_snapshots FOR
UPDATE USING (
    EXISTS (
        SELECT 1
        FROM document_permissions
        WHERE document_permissions.document_id = document_snapshots.document_id
          AND document_permissions.user_id = auth.uid()
    )
);

-- Allow users with document permission to delete changes (needed for compaction)
CREATE POLICY "Users can delete document changes" ON document_changes FOR
DELETE USING (
    EXISTS (
        SELECT 1
        FROM document_permissions
        WHERE document_permissions.document_id = document_changes.document_id
          AND document_permissions.user_id = auth.uid()
    )
);
