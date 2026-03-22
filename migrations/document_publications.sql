-- Published snapshots for public SEO-friendly pages at /{owner_username}/{slug}

CREATE TABLE IF NOT EXISTS document_publications (
    document_id UUID NOT NULL PRIMARY KEY REFERENCES documents (id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    owner_username TEXT NOT NULL,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    body_html TEXT NOT NULL,
    blocks_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT document_publications_slug_format CHECK (
        slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
        AND char_length(slug) BETWEEN 1 AND 200
    ),
    CONSTRAINT document_publications_username_format CHECK (
        owner_username ~ '^[a-z0-9_-]{2,50}$'
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS document_publications_owner_username_slug_key ON document_publications (owner_username, slug);

CREATE INDEX IF NOT EXISTS document_publications_owner_username_idx ON document_publications (owner_username);

ALTER TABLE document_publications ENABLE ROW LEVEL SECURITY;

-- Anyone can read published pages (anon + authenticated)
CREATE POLICY "Public read document publications" ON document_publications FOR SELECT USING (true);

CREATE POLICY "Document editors insert publication" ON document_publications FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1
        FROM document_permissions dp
        WHERE
            dp.document_id = document_publications.document_id
            AND dp.user_id = auth.uid ()
    )
    AND creator_id = (
        SELECT d.creator_id
        FROM documents d
        WHERE d.id = document_publications.document_id
    )
);

CREATE POLICY "Document editors update publication" ON document_publications FOR UPDATE USING (
    EXISTS (
        SELECT 1
        FROM document_permissions dp
        WHERE
            dp.document_id = document_publications.document_id
            AND dp.user_id = auth.uid ()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM document_permissions dp
        WHERE
            dp.document_id = document_publications.document_id
            AND dp.user_id = auth.uid ()
    )
    AND creator_id = (
        SELECT d.creator_id
        FROM documents d
        WHERE d.id = document_publications.document_id
    )
);

CREATE POLICY "Document editors delete publication" ON document_publications FOR DELETE USING (
    EXISTS (
        SELECT 1
        FROM document_permissions dp
        WHERE
            dp.document_id = document_publications.document_id
            AND dp.user_id = auth.uid ()
    )
);
