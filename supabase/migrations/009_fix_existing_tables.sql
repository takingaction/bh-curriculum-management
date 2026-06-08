-- Fix existing tables that have colgroup with min-width instead of proper width/alignment

-- Function to clean up table HTML
CREATE OR REPLACE FUNCTION fix_table_html(content TEXT)
RETURNS TEXT AS $$
DECLARE
  result TEXT;
BEGIN
  -- Remove colgroup tags entirely
  result := regexp_replace(content, '<colgroup>.*?</colgroup>', '', 'gi');
  
  -- Fix tables: replace min-width with width, add proper margin for centering
  -- Pattern: <table style="min-width: XXXpx"> -> <table style="width: 75%; margin-left: auto; margin-right: auto;">
  result := regexp_replace(result, '<table([^>]*)style="min-width:\s*(\d+)px"', '<table$1style="width: 75%; margin-left: auto; margin-right: auto;"', 'gi');
  
  -- If table has no style at all but has colgroup removed, add default width/center
  result := regexp_replace(result, '<table([^>]*)>', '<table$1style="width: 75%; margin-left: auto; margin-right: auto;">', 'gi');
  
  -- Clean up any double semicolons or spacing issues
  result := regexp_replace(result, ';{2,}', ';', 'g');
  result := regexp_replace(result, ';\s*>', ';>', 'g');
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Update all lessons to fix table HTML
UPDATE lessons
SET 
  lesson_outline = fix_table_html(lesson_outline),
  learning_objectives = fix_table_html(learning_objectives),
  vocabulary = fix_table_html(vocabulary),
  materials = fix_table_html(materials),
  vapa_text_block = fix_table_html(vapa_text_block),
  ncas_text_block = fix_table_html(ncas_text_block),
  welcome_opening = fix_table_html(welcome_opening),
  actual_class_expectations = fix_table_html(actual_class_expectations),
  lesson_hook = fix_table_html(lesson_hook),
  warm_up = fix_table_html(warm_up),
  main_activity = fix_table_html(main_activity),
  instrument_expectations = fix_table_html(instrument_expectations),
  reflection = fix_table_html(reflection),
  closing_ceremony = fix_table_html(closing_ceremony),
  assessment = fix_table_html(assessment)
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