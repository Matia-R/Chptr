-- Required author onboarding. The completion timestamp is not a client-writable
-- flag: only `complete_author_onboarding` may set it, and only together with a
-- nonblank author name and a valid unique handle.
--
-- Apply this after `profiles_author_name_and_handles.sql`. Existing profiles
-- that already have both fields are backfilled so they are not sent through
-- onboarding. Profiles missing either field stay incomplete.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;

INSERT INTO public.reserved_handles (handle)
VALUES ('onboarding')
ON CONFLICT (handle) DO NOTHING;

-- Backfill before the guard trigger exists, so this write is not rejected.
UPDATE public.profiles
SET onboarding_completed_at = COALESCE(updated_at, now())
WHERE onboarding_completed_at IS NULL
  AND NULLIF(btrim(author_name), '') IS NOT NULL
  AND char_length(btrim(author_name)) <= 100
  AND NULLIF(lower(btrim(username)), '') IS NOT NULL
  AND lower(btrim(username)) ~ '^[a-z0-9_-]{2,50}$'
  AND NOT EXISTS (
    SELECT 1
    FROM public.reserved_handles
    WHERE handle = lower(btrim(username))
  );

CREATE OR REPLACE FUNCTION public.guard_profile_onboarding()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  completing text := current_setting('chptr.onboarding_completion', true);
BEGIN
  IF NEW.onboarding_completed_at IS NOT NULL
     AND (
       TG_OP = 'INSERT'
       OR OLD.onboarding_completed_at IS DISTINCT FROM NEW.onboarding_completed_at
     )
     AND completing IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'Onboarding completion cannot be set directly'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.onboarding_completed_at IS NOT NULL
     AND NEW.onboarding_completed_at IS NULL THEN
    RAISE EXCEPTION 'Onboarding completion cannot be cleared'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.onboarding_completed_at IS NOT NULL THEN
    IF NULLIF(btrim(NEW.author_name), '') IS NULL THEN
      RAISE EXCEPTION 'Author name is required' USING ERRCODE = '23514';
    END IF;
    IF NULLIF(btrim(NEW.username), '') IS NULL THEN
      RAISE EXCEPTION 'Handle is required' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_onboarding ON public.profiles;
CREATE TRIGGER profiles_guard_onboarding
  BEFORE INSERT OR UPDATE
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_onboarding();

CREATE OR REPLACE FUNCTION public.complete_author_onboarding(
  p_author_name text,
  p_username text
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  completed timestamptz;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  -- Local to this transaction, so a later client update cannot reuse it.
  PERFORM set_config('chptr.onboarding_completion', '1', true);

  UPDATE public.profiles
  SET
    author_name = NULLIF(btrim(p_author_name), ''),
    username = NULLIF(btrim(p_username), ''),
    onboarding_completed_at = COALESCE(onboarding_completed_at, now()),
    updated_at = now()
  WHERE id = uid
  RETURNING onboarding_completed_at INTO completed;

  IF completed IS NULL THEN
    RAISE EXCEPTION 'Profile not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN completed;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_author_onboarding(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_author_onboarding(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.complete_author_onboarding(text, text) TO authenticated;
