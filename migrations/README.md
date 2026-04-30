# Database migrations

Files here are the **source of truth** for DDL. They are applied to the linked Supabase project using **`apply_migration`** (Supabase) so runs are tracked in the hosted migration history—not by pasting into the SQL Editor or by `npm dev`.

When you add a new `.sql` file:

1. Keep it in this folder (reviewable, versioned).
2. Apply it through Supabase **`apply_migration`** with a `snake_case` name (e.g. `document_publications`) and the full file body.

Older tables in your project may have been created before this repo’s filenames lined up with migration names; duplicate `CREATE POLICY` statements will fail if you re-run a file blindly—prefer **one migration per change** going forward.

| File | Purpose |
|------|--------|
| `document_publications.sql` | Public published docs: `/[owner segment]/[slug]`, RLS |
