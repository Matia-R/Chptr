-- `/privacy` is an app route, so it cannot be claimed as a handle.
-- Keep aligned with `RESERVED_HANDLES` in src/lib/author-handle.ts.
INSERT INTO public.reserved_handles (handle)
VALUES ('privacy')
ON CONFLICT (handle) DO NOTHING;
