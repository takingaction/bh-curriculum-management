-- Migration: 026_discipline_pdfs.sql
-- Creates table for discipline scope & sequence PDFs

-- Discipline PDFs table
CREATE TABLE IF NOT EXISTS discipline_pdfs (
  discipline TEXT PRIMARY KEY,
  storage_path TEXT,
  file_size INTEGER,
  generated_at TIMESTAMPTZ,
  generated_by UUID REFERENCES auth.users
);

-- RLS Policies
ALTER TABLE discipline_pdfs ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admin full access to discipline_pdfs"
  ON discipline_pdfs FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
