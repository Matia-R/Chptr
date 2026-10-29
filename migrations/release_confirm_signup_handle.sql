-- `/confirm-signup` is no longer a route. Email verification happens on `/signup`.
DELETE FROM public.reserved_handles
WHERE handle = 'confirm-signup';
