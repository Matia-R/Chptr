-- Allow authenticated users to create documents when they set themselves as creator.
-- Without this, RLS blocks INSERT on documents (default deny), so no row is created
-- and the subsequent document_permissions insert fails with FK violation.

CREATE POLICY "Users can create documents as creator" ON public.documents
FOR INSERT
WITH CHECK (creator_id = (SELECT auth.uid()));
