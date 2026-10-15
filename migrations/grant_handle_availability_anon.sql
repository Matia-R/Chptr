-- Signup checks handle availability before an account exists.
-- The function is SECURITY DEFINER and returns only a status word.
GRANT EXECUTE ON FUNCTION public.handle_availability(text, uuid) TO anon;
