-- Migration: 015_batch_pdf_regeneration.sql
-- Creates tables for batch PDF regeneration tool

-- Batch PDF Jobs table
CREATE TABLE IF NOT EXISTS batch_pdf_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed')),
  total_count INTEGER NOT NULL DEFAULT 0,
  processed_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Batch PDF Results table
CREATE TABLE IF NOT EXISTS batch_pdf_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES batch_pdf_jobs(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES lessons(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_batch_pdf_results_job_id ON batch_pdf_results(job_id);
CREATE INDEX IF NOT EXISTS idx_batch_pdf_results_status ON batch_pdf_results(status);
CREATE INDEX IF NOT EXISTS idx_batch_pdf_jobs_status ON batch_pdf_jobs(status);
CREATE INDEX IF NOT EXISTS idx_batch_pdf_jobs_created_at ON batch_pdf_jobs(created_at DESC);

-- RLS Policies
ALTER TABLE batch_pdf_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_pdf_results ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admin full access to batch_pdf_jobs"
  ON batch_pdf_jobs FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admin full access to batch_pdf_results"
  ON batch_pdf_results FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
