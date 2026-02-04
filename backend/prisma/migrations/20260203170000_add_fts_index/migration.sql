-- CreateIndex
CREATE INDEX "publications_fts_idx" ON "publications"
USING GIN (to_tsvector('portuguese', COALESCE("title", '') || ' ' || COALESCE("content", '')));
