-- Store Yjs CRDT updates as binary (bytea) instead of TEXT.
-- Supabase/PostgREST send bytea as base64 in JSON; Postgres stores binary.
-- Migrates existing TEXT data (base64 or hex) into bytea.

-- document_changes.update_data: TEXT -> bytea
-- (If column is already bytea, skip: check information_schema or use a separate one-time migration.)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'document_changes'
      AND column_name = 'update_data' AND data_type = 'text'
  ) THEN
    ALTER TABLE document_changes ADD COLUMN update_data_bytea bytea;
    UPDATE document_changes
    SET update_data_bytea = CASE
      WHEN left(update_data, 2) = E'\\x' THEN decode(substring(update_data from 3), 'hex')
      ELSE decode(regexp_replace(trim(update_data), E'[\\n\\r\\s]', '', 'g'), 'base64')
    END;
    ALTER TABLE document_changes DROP COLUMN update_data;
    ALTER TABLE document_changes RENAME COLUMN update_data_bytea TO update_data;
    ALTER TABLE document_changes ALTER COLUMN update_data SET NOT NULL;
  END IF;
END $$;

-- document_snapshots.snapshot_data: TEXT -> bytea
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'document_snapshots'
      AND column_name = 'snapshot_data' AND data_type = 'text'
  ) THEN
    ALTER TABLE document_snapshots ADD COLUMN snapshot_data_bytea bytea;
    UPDATE document_snapshots
    SET snapshot_data_bytea = CASE
      WHEN left(snapshot_data, 2) = E'\\x' THEN decode(substring(snapshot_data from 3), 'hex')
      ELSE decode(regexp_replace(trim(snapshot_data), E'[\\n\\r\\s]', '', 'g'), 'base64')
    END;
    ALTER TABLE document_snapshots DROP COLUMN snapshot_data;
    ALTER TABLE document_snapshots RENAME COLUMN snapshot_data_bytea TO snapshot_data;
    ALTER TABLE document_snapshots ALTER COLUMN snapshot_data SET NOT NULL;
  END IF;
END $$;
