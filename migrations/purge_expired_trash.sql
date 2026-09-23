-- Hard-delete documents that have been in trash for 30 days.
-- One statement, no arguments, no caller-supplied ids.
-- Granted to no API role. pg_cron runs it as the role that scheduled the job.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

CREATE TABLE public.document_purge_log (
  document_id uuid PRIMARY KEY,
  purged_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.document_purge_log IS
  'Ids of documents hard-deleted after 30 days in trash. No name or document content.';

ALTER TABLE public.document_purge_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.document_purge_log FROM PUBLIC;
REVOKE ALL ON TABLE public.document_purge_log FROM anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.purge_expired_trash()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  purged integer;
BEGIN
  PERFORM set_config('statement_timeout', '5s', true);

  WITH locked AS (
    SELECT id
    FROM public.documents
    WHERE deleted_at IS NOT NULL
      AND deleted_at < now() - interval '30 days'
    ORDER BY deleted_at
    LIMIT 50
    FOR UPDATE SKIP LOCKED
  ),
  removed AS (
    DELETE FROM public.documents AS d
    WHERE d.id IN (SELECT id FROM locked)
      AND d.deleted_at IS NOT NULL
      AND d.deleted_at < now() - interval '30 days'
    RETURNING d.id
  ),
  logged AS (
    INSERT INTO public.document_purge_log (document_id, purged_at)
    SELECT id, now()
    FROM removed
    RETURNING document_id
  )
  SELECT count(*)::integer INTO purged FROM logged;

  RETURN purged;
END;
$$;

COMMENT ON FUNCTION public.purge_expired_trash() IS
  'Hard-deletes up to 50 documents whose deleted_at is older than 30 days. No arguments. Not granted to API roles.';

REVOKE ALL ON FUNCTION public.purge_expired_trash() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purge_expired_trash() FROM anon, authenticated, service_role;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'purge-expired-trash'
  ) THEN
    PERFORM cron.unschedule('purge-expired-trash');
  END IF;
END $$;

SELECT cron.schedule(
  'purge-expired-trash',
  '15 4 * * *',
  $cron$SELECT public.purge_expired_trash()$cron$
);
