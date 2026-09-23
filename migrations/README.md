# Database migrations

Files here are the **source of truth** for DDL. They are applied to the linked Supabase project using **`apply_migration`** (Supabase) so runs are tracked in the hosted migration history—not by pasting into the SQL Editor or by `npm dev`.

`apply_migration` wraps the body in a transaction. Do **not** send `CREATE INDEX CONCURRENTLY` through it.

When you add a new `.sql` file:

1. Keep it in this folder (reviewable, versioned).
2. Apply transactional files through Supabase **`apply_migration`** with a `snake_case` name (e.g. `document_publications`) and the full file body.
3. Apply `documents_active_last_updated_idx.sql` and `documents_trashed_deleted_at_idx.sql` as a single `execute_sql` (or psql autocommit) statement. If that errors with `cannot run inside a transaction block`, use `psql` instead.

Older tables in your project may have been created before this repo’s filenames lined up with migration names; duplicate `CREATE POLICY` statements will fail if you re-run a file blindly—prefer **one migration per change** going forward.

| File | Purpose |
|------|--------|
| `partykit_document_state.sql` | Collaborative editing: full Y.Doc state per document (`document_state`) + RLS |
| `document_exists_rpc.sql` | Privileged existence check for PartyKit connect (403 vs 404) |
| `drop_document_changes_and_snapshots.sql` | Removes legacy `document_changes` / `document_snapshots` tables |
| `document_publications.sql` | Public published docs: `/[owner segment]/[slug]`, RLS |
| `document_publication_redirects.sql` | Path redirects after username/slug changes; redirect-before-publication lookup |
| `document_soft_delete.sql` | `documents.deleted_at`, trash/restore RPCs, hide trashed from `document_exists` |
| `documents_active_last_updated_idx.sql` | Partial recency index on active `documents` — **not** via `apply_migration` |
| `purge_expired_trash.sql` | 30-day hard delete: `purge_expired_trash()`, id-only audit log, `pg_cron` job |
| `purge_expired_trash_batch.sql` | Hourly, 1,000 expired documents per run. Raise the cron frequency later if trash volume needs a faster drain. |
| `documents_trashed_deleted_at_idx.sql` | Partial index on trashed `documents.deleted_at` — **not** via `apply_migration` |
