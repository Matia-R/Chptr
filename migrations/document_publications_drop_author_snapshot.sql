-- Revert denormalized author columns; public pages read from `profiles` instead.
ALTER TABLE document_publications
    DROP COLUMN IF EXISTS author_display_name,
    DROP COLUMN IF EXISTS author_avatar_url;
