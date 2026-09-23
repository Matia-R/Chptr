-- One batched delete per pg_cron run, hourly at minute 15.
-- 1,000 parent rows per run limits cascading deletes.
-- Raise this cron frequency later if trash volume needs a faster drain.
-- Same function, same predicate, still no arguments and no API grants.

CREATE OR REPLACE FUNCTION public.purge_expired_trash()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  purged integer;
BEGIN
  PERFORM set_config('lock_timeout', '5s', true);

  WITH locked AS (
    SELECT id
    FROM public.documents
    WHERE deleted_at IS NOT NULL
      AND deleted_at < now() - interval '30 days'
    ORDER BY deleted_at
    LIMIT 1000
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
  'Hard-deletes up to 1000 documents whose deleted_at is older than 30 days. No arguments. Not granted to API roles. Invoked hourly by pg_cron. Raise the cron frequency if trash volume needs a faster drain.';

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

-- Session timeout is set before the purge statement. set_config inside the
-- function does not bound that statement on PostgreSQL before 13.
SELECT cron.schedule(
  'purge-expired-trash',
  '15 * * * *',
  $cron$SET statement_timeout = '60s'; SELECT public.purge_expired_trash();$cron$
);
