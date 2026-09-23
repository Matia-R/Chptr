-- Partial index for the 30-day trash purge.
-- CREATE INDEX CONCURRENTLY cannot run inside a transaction. Do not apply this
-- file with apply_migration — run it as a single execute_sql / psql statement.

CREATE INDEX CONCURRENTLY IF NOT EXISTS documents_trashed_deleted_at_idx
  ON public.documents (deleted_at)
  WHERE deleted_at IS NOT NULL;
