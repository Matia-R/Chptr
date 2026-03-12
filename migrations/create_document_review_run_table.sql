-- Throttle passive review: at most one batch run per document per cooldown window.
-- Prevents duplicate LLM calls when multiple tabs report blocks.

CREATE TABLE IF NOT EXISTS document_review_run (
    document_id UUID NOT NULL PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
    last_run_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE document_review_run ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read document review run"
    ON document_review_run FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM document_permissions
            WHERE document_permissions.document_id = document_review_run.document_id
              AND document_permissions.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert document review run"
    ON document_review_run FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM document_permissions
            WHERE document_permissions.document_id = document_review_run.document_id
              AND document_permissions.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update document review run"
    ON document_review_run FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM document_permissions
            WHERE document_permissions.document_id = document_review_run.document_id
              AND document_permissions.user_id = auth.uid()
        )
    );

-- Atomic claim: only one runner per document per cooldown. Returns true if this caller claimed.
CREATE OR REPLACE FUNCTION try_claim_document_review_run(
    p_document_id UUID,
    p_cooldown_interval INTERVAL DEFAULT '2 minutes'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM document_permissions
    WHERE document_id = p_document_id AND user_id = auth.uid()
  ) THEN
    RETURN FALSE;
  END IF;
  INSERT INTO document_review_run (document_id, last_run_at)
  VALUES (p_document_id, NOW())
  ON CONFLICT (document_id) DO UPDATE
  SET last_run_at = NOW()
  WHERE document_review_run.last_run_at < NOW() - p_cooldown_interval;
  GET DIAGNOSTICS r = ROW_COUNT;
  RETURN r > 0;
END;
$$;
