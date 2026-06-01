-- Add GIN index for full-text search on articles
CREATE INDEX IF NOT EXISTS articles_fulltext_idx
ON articles
USING GIN (
  to_tsvector('english', coalesce(headline, '') || ' ' || coalesce(sub_headline, '') || ' ' || coalesce(body, ''))
);
