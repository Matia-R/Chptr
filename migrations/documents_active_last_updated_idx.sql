-- Partial recency index of active documents.
-- CREATE INDEX CONCURRENTLY cannot run inside a transaction. Do not apply this
-- file with apply_migration — run it as a single execute_sql / psql statement.

CREATE INDEX CONCURRENTLY IF NOT EXISTS documents_active_last_updated_idx
  ON public.documents (last_updated DESC)
  WHERE deleted_at IS NULL;
