-- Early-access waitlist from the landing page.
-- One row per address. Nothing else about the person is stored.
--
-- Only the Next.js server writes here, with the service role, and it can only
-- insert. No API role can read the list. Read it from the dashboard or psql.

CREATE TABLE IF NOT EXISTS public.waitlist_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT waitlist_signups_email_key UNIQUE (email),
  -- The server lowercases and trims first, so one address cannot join twice.
  CONSTRAINT waitlist_signups_email_format CHECK (
    email = lower(btrim(email))
    AND char_length(email) BETWEEN 3 AND 254
    AND email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  )
);

COMMENT ON TABLE public.waitlist_signups IS
  'Early-access waitlist. Email and signup time only. Insert-only for service_role.';

ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.waitlist_signups FROM PUBLIC;
REVOKE ALL ON TABLE public.waitlist_signups FROM anon, authenticated, service_role;
GRANT INSERT ON TABLE public.waitlist_signups TO service_role;
