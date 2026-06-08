-- Fix existing tables that have colgroup with min-width instead of proper width/alignment
-- This is a CONSERVATIVE fix that only removes colgroup and fixes min-width

-- Function to clean up table HTML
CREATE OR REPLACE FUNCTION fix_table_html(content TEXT)
RETURNS TEXT AS $$
DECLARE
  result TEXT;
BEGIN
  -- Remove colgroup tags entirely (non-greedy match)
  result := regexp_replace(content, '<colgroup[^>]*>.*?</colgroup>', '', 'gi');

  -- Fix tables: replace min-width with width, add proper margin for centering
  -- Only fix tables that have min-width style
  result := regexp_replace(result, '<table([^>]*)style="min-width:\s*(\d+)px"', '<table$1style="width: 75%; margin-left: auto; margin-right: auto;"', 'gi');

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Update all lessons to fix table HTML (only those with colgroup)
UPDATE lessons
SET
  lesson_outline = COALESCE(fix_table_html(lesson_outline), lesson_outline),
  learning_objectives = COALESCE(fix_table_html(learning_objectives), learning_objectives),
  vocabulary = COALESCE(fix_table_html(vocabulary), vocabulary),
  materials = COALESCE(fix_table_html(materials), materials),
  vapa_text_block = COALESCE(fix_table_html(vapa_text_block), vapa_text_block),
  ncas_text_block = COALESCE(fix_table_html(ncas_text_block), ncas_text_block),
  welcome_opening = COALESCE(fix_table_html(welcome_opening), welcome_opening),
  actual_class_expectations = COALESCE(fix_table_html(actual_class_expectations), actual_class_expectations),
  lesson_hook = COALESCE(fix_table_html(lesson_hook), lesson_hook),
  warm_up = COALESCE(fix_table_html(warm_up), warm_up),
  main_activity = COALESCE(fix_table_html(main_activity), main_activity),
  instrument_expectations = COALESCE(fix_table_html(instrument_expectations), instrument_expectations),
  reflection = COALESCE(fix_table_html(reflection), reflection),
  closing_ceremony = COALESCE(fix_table_html(closing_ceremony), closing_ceremony),
  assessment = COALESCE(fix_table_html(assessment), assessment)
WHERE
  lesson_outline ~ '<colgroup>' OR
  learning_objectives ~ '<colgroup>' OR
  vocabulary ~ '<colgroup>' OR
  materials ~ '<colgroup>' OR
  vapa_text_block ~ '<colgroup>' OR
  ncas_text_block ~ '<colgroup>' OR
  welcome_opening ~ '<colgroup>' OR
  actual_class_expectations ~ '<colgroup>' OR
  lesson_hook ~ '<colgroup>' OR
  warm_up ~ '<colgroup>' OR
  main_activity ~ '<colgroup>' OR
  instrument_expectations ~ '<colgroup>' OR
  reflection ~ '<colgroup>' OR
  closing_ceremony ~ '<colgroup>' OR
  assessment ~ '<colgroup>';