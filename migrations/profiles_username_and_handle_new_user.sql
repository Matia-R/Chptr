-- Username on profiles + sync from auth metadata (signup stores username in raw_user_meta_data).
-- Needed when email confirmation is on: no session after signUp, so only this trigger creates the row.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_unique
  ON public.profiles (lower(trim(username)))
  WHERE username IS NOT NULL AND trim(username) <> '';

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  insert into public.profiles (id, first_name, last_name, username, default_avatar_background_color)
  values (
    new.id,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
    new.raw_user_meta_data ->> 'default_avatar_background_color'
  );
  return new;
end;
$function$;

-- Existing users: copy username from user_metadata if present
UPDATE public.profiles p
SET username = nullif(trim(u.raw_user_meta_data ->> 'username'), '')
FROM auth.users u
WHERE u.id = p.id
  AND p.username IS NULL
  AND nullif(trim(u.raw_user_meta_data ->> 'username'), '') IS NOT NULL;
