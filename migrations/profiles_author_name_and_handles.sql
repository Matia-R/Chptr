-- Author byline + handle reservations.
-- `profiles.username` stays the public handle (`/{username}/{slug}`).
-- `first_name` / `last_name` are left in place until every reader has moved
-- to `author_name`.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS author_name text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_author_name_length;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_author_name_length CHECK (
    author_name IS NULL OR char_length(author_name) <= 100
  );

-- Byline: trimmed first + last, then the current username.
UPDATE public.profiles
SET author_name = NULLIF(
  left(
    btrim(
      concat_ws(
        ' ',
        NULLIF(btrim(first_name), ''),
        NULLIF(btrim(last_name), '')
      )
    ),
    100
  ),
  ''
)
WHERE author_name IS NULL OR btrim(author_name) = '';

UPDATE public.profiles
SET author_name = NULLIF(left(btrim(username), 100), '')
WHERE (author_name IS NULL OR btrim(author_name) = '')
  AND NULLIF(btrim(username), '') IS NOT NULL;

-- Profiles that published through the old first+last URL fallback have no
-- username. Adopt the live publication segment so those URLs keep matching
-- the handle. A segment already owned by another profile is left alone.
WITH latest AS (
  SELECT DISTINCT ON (dp.creator_id)
    dp.creator_id,
    dp.owner_username
  FROM public.document_publications dp
  ORDER BY dp.creator_id, dp.updated_at DESC
),
candidates AS (
  SELECT
    latest.creator_id,
    latest.owner_username,
    row_number() OVER (
      PARTITION BY latest.owner_username
      ORDER BY latest.creator_id
    ) AS claim_rank
  FROM latest
  JOIN public.profiles p ON p.id = latest.creator_id
  WHERE p.username IS NULL OR btrim(p.username) = ''
)
UPDATE public.profiles p
SET username = candidates.owner_username
FROM candidates
WHERE p.id = candidates.creator_id
  AND candidates.claim_rank = 1
  AND NOT EXISTS (
    SELECT 1
    FROM public.profiles other
    WHERE other.id <> p.id
      AND other.username IS NOT NULL
      AND lower(btrim(other.username)) = lower(candidates.owner_username)
  );

-- App routes that cannot be claimed as handles. Keep this list aligned with
-- `RESERVED_HANDLES` in src/lib/author-handle.ts.
CREATE TABLE IF NOT EXISTS public.reserved_handles (
  handle text PRIMARY KEY,
  CONSTRAINT reserved_handles_format CHECK (handle ~ '^[a-z0-9_-]{2,50}$')
);

INSERT INTO public.reserved_handles (handle)
VALUES
  ('api'),
  ('documents'),
  ('account'),
  ('login'),
  ('signup'),
  ('welcome'),
  ('onboarding'),
  ('confirm-signup'),
  ('error'),
  ('auth')
ON CONFLICT (handle) DO NOTHING;

ALTER TABLE public.reserved_handles ENABLE ROW LEVEL SECURITY;

-- Previous handles stay unavailable so old published URLs are not reclaimed.
CREATE TABLE IF NOT EXISTS public.profile_handle_reservations (
  handle text PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profile_handle_reservations_format CHECK (
    handle ~ '^[a-z0-9_-]{2,50}$'
  )
);

ALTER TABLE public.profile_handle_reservations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS profile_handle_reservations_profile_id_idx
  ON public.profile_handle_reservations (profile_id);

INSERT INTO public.profile_handle_reservations (handle, profile_id)
SELECT DISTINCT lower(r.from_owner_username), r.creator_id
FROM public.document_publication_redirects r
JOIN public.profiles p ON p.id = r.creator_id
WHERE lower(r.from_owner_username) IS DISTINCT FROM lower(btrim(coalesce(p.username, '')))
  AND NOT EXISTS (
    SELECT 1
    FROM public.profiles other
    WHERE other.id <> r.creator_id
      AND other.username IS NOT NULL
      AND lower(btrim(other.username)) = lower(r.from_owner_username)
  )
ON CONFLICT (handle) DO NOTHING;

INSERT INTO public.profile_handle_reservations (handle, profile_id)
SELECT DISTINCT dp.owner_username, dp.creator_id
FROM public.document_publications dp
JOIN public.profiles p ON p.id = dp.creator_id
WHERE dp.owner_username IS DISTINCT FROM lower(btrim(coalesce(p.username, '')))
  AND NOT EXISTS (
    SELECT 1
    FROM public.profiles other
    WHERE other.id <> dp.creator_id
      AND other.username IS NOT NULL
      AND lower(btrim(other.username)) = dp.owner_username
  )
ON CONFLICT (handle) DO NOTHING;

-- No client policies: availability and claims go through SECURITY DEFINER code.

CREATE OR REPLACE FUNCTION public.handle_availability(p_handle text, p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized text := NULLIF(lower(btrim(coalesce(p_handle, ''))), '');
BEGIN
  IF normalized IS NULL
     OR char_length(normalized) < 2
     OR char_length(normalized) > 50
     OR normalized !~ '^[a-z0-9_-]+$' THEN
    RETURN 'invalid';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = p_user_id
      AND username IS NOT NULL
      AND lower(btrim(username)) = normalized
  ) THEN
    RETURN 'own';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.reserved_handles WHERE handle = normalized
  ) THEN
    RETURN 'reserved';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id <> p_user_id
      AND username IS NOT NULL
      AND lower(btrim(username)) = normalized
  ) THEN
    RETURN 'taken';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profile_handle_reservations
    WHERE handle = normalized
      AND profile_id <> p_user_id
  ) THEN
    RETURN 'reserved';
  END IF;

  RETURN 'available';
END;
$$;

REVOKE ALL ON FUNCTION public.handle_availability(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_availability(text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_profile_handle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_handle text;
  new_handle text;
BEGIN
  IF NEW.author_name IS NOT NULL THEN
    NEW.author_name := NULLIF(btrim(NEW.author_name), '');
    IF NEW.author_name IS NOT NULL AND char_length(NEW.author_name) > 100 THEN
      RAISE EXCEPTION 'Author name is too long' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.username IS NOT NULL AND btrim(NEW.username) = '' THEN
    NEW.username := NULL;
  END IF;

  old_handle := CASE
    WHEN TG_OP = 'UPDATE' THEN NULLIF(lower(btrim(OLD.username)), '')
    ELSE NULL
  END;
  new_handle := NULLIF(lower(btrim(NEW.username)), '');

  IF new_handle IS NOT NULL AND old_handle IS DISTINCT FROM new_handle THEN
    IF char_length(new_handle) < 2
       OR char_length(new_handle) > 50
       OR new_handle !~ '^[a-z0-9_-]+$' THEN
      RAISE EXCEPTION 'Invalid handle' USING ERRCODE = '23514';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended('chptr.handle:' || new_handle, 0));

    IF EXISTS (
      SELECT 1 FROM public.reserved_handles WHERE handle = new_handle
    ) THEN
      RAISE EXCEPTION 'That username is reserved.' USING ERRCODE = '23514';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id <> NEW.id
        AND username IS NOT NULL
        AND lower(btrim(username)) = new_handle
    ) THEN
      RAISE EXCEPTION 'That username is already taken.' USING ERRCODE = '23505';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.profile_handle_reservations
      WHERE handle = new_handle
        AND profile_id <> NEW.id
    ) THEN
      RAISE EXCEPTION 'That username is reserved.' USING ERRCODE = '23505';
    END IF;

    DELETE FROM public.profile_handle_reservations
    WHERE handle = new_handle
      AND profile_id = NEW.id;
  END IF;

  IF old_handle IS NOT NULL
     AND old_handle IS DISTINCT FROM new_handle
     AND old_handle ~ '^[a-z0-9_-]{2,50}$' THEN
    INSERT INTO public.profile_handle_reservations (handle, profile_id)
    VALUES (old_handle, NEW.id)
    ON CONFLICT (handle) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_enforce_handle ON public.profiles;
CREATE TRIGGER profiles_enforce_handle
  BEFORE INSERT OR UPDATE OF username, author_name
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_profile_handle();

-- Email and OAuth signups can finish with no author name and no handle.
-- A username is stored only when metadata includes one; missing values stay null.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  meta_author text;
  meta_username text;
BEGIN
  meta_author := NULLIF(
    left(
      btrim(
        coalesce(
          NULLIF(btrim(NEW.raw_user_meta_data ->> 'author_name'), ''),
          NULLIF(
            concat_ws(
              ' ',
              NULLIF(btrim(NEW.raw_user_meta_data ->> 'first_name'), ''),
              NULLIF(btrim(NEW.raw_user_meta_data ->> 'last_name'), '')
            ),
            ''
          )
        )
      ),
      100
    ),
    ''
  );
  meta_username := NULLIF(btrim(NEW.raw_user_meta_data ->> 'username'), '');

  INSERT INTO public.profiles (
    id,
    author_name,
    first_name,
    last_name,
    username,
    default_avatar_background_color
  )
  VALUES (
    NEW.id,
    meta_author,
    NULLIF(btrim(NEW.raw_user_meta_data ->> 'first_name'), ''),
    NULLIF(btrim(NEW.raw_user_meta_data ->> 'last_name'), ''),
    meta_username,
    coalesce(NEW.raw_user_meta_data ->> 'default_avatar_background_color', 'blue')
  );
  RETURN NEW;
END;
$function$;
