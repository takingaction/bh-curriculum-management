-- Migration: 023_lesson_embeddings.sql
-- Creates table for vector embeddings to enable semantic search of lesson content

-- Enable pg_vector extension (may already be enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- Lesson embeddings table for semantic search
CREATE TABLE IF NOT EXISTS lesson_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  chunk_text TEXT NOT NULL,
  chunk_index INT NOT NULL DEFAULT 0,
  embedding vector(384),  -- 384 dimensions for all-MiniLM-L6-v2 model
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Composite unique constraint to prevent duplicate chunks
CREATE UNIQUE INDEX IF NOT EXISTS idx_lesson_field_chunk
  ON lesson_embeddings(lesson_id, field_name, chunk_index);

-- Index for vector similarity search (IVF flat - good balance of speed/accuracy)
CREATE INDEX IF NOT EXISTS idx_embedding_vector
  ON lesson_embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Index for quick lookups by lesson
CREATE INDEX IF NOT EXISTS idx_embeddings_lesson_id
  ON lesson_embeddings(lesson_id);

-- RLS Policies
ALTER TABLE lesson_embeddings ENABLE ROW LEVEL SECURITY;

-- Admin and service role full access
CREATE POLICY "Admin full access to lesson_embeddings"
  ON lesson_embeddings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (true);

-- Function to delete embeddings for a specific lesson (called when lesson is updated)
CREATE OR REPLACE FUNCTION delete_lesson_embeddings(p_lesson_id UUID)
RETURNS void AS $$
BEGIN
  DELETE FROM public.lesson_embeddings WHERE lesson_id = p_lesson_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to search embeddings by vector similarity
CREATE OR REPLACE FUNCTION search_lesson_embeddings(
  query_embedding vector(384),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  lesson_id UUID,
  field_name TEXT,
  chunk_text TEXT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    le.lesson_id,
    le.field_name,
    le.chunk_text,
    1 - (le.embedding <=> query_embedding) AS similarity
  FROM public.lesson_embeddings le
  WHERE 1 - (le.embedding <=> query_embedding) > match_threshold
  ORDER BY le.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
