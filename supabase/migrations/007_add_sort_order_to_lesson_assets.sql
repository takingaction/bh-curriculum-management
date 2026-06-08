-- Add sort_order column to lesson_assets for manual ordering
ALTER TABLE public.lesson_assets ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Create index for efficient ordering queries
CREATE INDEX IF NOT EXISTS idx_lesson_assets_sort_order ON public.lesson_assets(lesson_id, sort_order);

-- Backfill sort_order with existing order (by created_at)
UPDATE public.lesson_assets la
SET sort_order = subquery.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY lesson_id ORDER BY created_at ASC) as rn
  FROM public.lesson_assets
) subquery
WHERE la.id = subquery.id;