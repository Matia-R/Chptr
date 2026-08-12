-- Path-exact redirects for published docs after owner segment / slug changes.
-- Lookup order on public pages: redirect first, then publication — so old URLs
-- keep resolving even if another user later claims the same username+slug.

CREATE TABLE IF NOT EXISTS document_publication_redirects (
    from_owner_username TEXT NOT NULL,
    from_slug TEXT NOT NULL,
    to_owner_username TEXT NOT NULL,
    to_slug TEXT NOT NULL,
    document_id UUID NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (from_owner_username, from_slug),
    CONSTRAINT document_publication_redirects_from_username_format CHECK (
        from_owner_username ~ '^[a-z0-9_-]{2,50}$'
    ),
    CONSTRAINT document_publication_redirects_to_username_format CHECK (
        to_owner_username ~ '^[a-z0-9_-]{2,50}$'
    ),
    CONSTRAINT document_publication_redirects_from_slug_format CHECK (
        from_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
        AND char_length(from_slug) BETWEEN 1 AND 200
    ),
    CONSTRAINT document_publication_redirects_to_slug_format CHECK (
        to_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
        AND char_length(to_slug) BETWEEN 1 AND 200
    ),
    CONSTRAINT document_publication_redirects_not_identity CHECK (
        from_owner_username <> to_owner_username
        OR from_slug <> to_slug
    )
);

CREATE INDEX IF NOT EXISTS document_publication_redirects_to_path_idx
    ON document_publication_redirects (to_owner_username, to_slug);

CREATE INDEX IF NOT EXISTS document_publication_redirects_document_id_idx
    ON document_publication_redirects (document_id);

CREATE INDEX IF NOT EXISTS document_publication_redirects_creator_id_idx
    ON document_publication_redirects (creator_id);

ALTER TABLE document_publication_redirects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read document publication redirects"
ON document_publication_redirects FOR SELECT USING (true);

CREATE POLICY "Document editors insert publication redirects"
ON document_publication_redirects FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1
        FROM document_permissions dp
        WHERE
            dp.document_id = document_publication_redirects.document_id
            AND dp.user_id = (SELECT auth.uid())
    )
    AND creator_id = (
        SELECT d.creator_id
        FROM documents d
        WHERE d.id = document_publication_redirects.document_id
    )
);

CREATE POLICY "Document editors update publication redirects"
ON document_publication_redirects FOR UPDATE USING (
    EXISTS (
        SELECT 1
        FROM document_permissions dp
        WHERE
            dp.document_id = document_publication_redirects.document_id
            AND dp.user_id = (SELECT auth.uid())
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM document_permissions dp
        WHERE
            dp.document_id = document_publication_redirects.document_id
            AND dp.user_id = (SELECT auth.uid())
    )
    AND creator_id = (
        SELECT d.creator_id
        FROM documents d
        WHERE d.id = document_publication_redirects.document_id
    )
);

CREATE POLICY "Document editors delete publication redirects"
ON document_publication_redirects FOR DELETE USING (
    EXISTS (
        SELECT 1
        FROM document_permissions dp
        WHERE
            dp.document_id = document_publication_redirects.document_id
            AND dp.user_id = (SELECT auth.uid())
    )
);
