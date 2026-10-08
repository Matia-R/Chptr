-- Font captured with each publish. Null means Inter (documents published before this column).
ALTER TABLE document_publications
    ADD COLUMN IF NOT EXISTS font text;
