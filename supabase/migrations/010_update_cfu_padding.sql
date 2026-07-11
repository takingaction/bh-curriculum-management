-- Migration: Update CFU outer padding from 40px to 40px 60px (vertical 40px, horizontal 60px)
-- This affects stored HTML in lessons table that contains Check for Understanding blocks

CREATE OR REPLACE FUNCTION fix_cfu_padding(content TEXT)
RETURNS TEXT AS $$
BEGIN
  IF content IS NULL THEN
    RETURN NULL;
  END IF;

  IF content ~ 'data-check-for-understanding' THEN
    RETURN REPLACE(content, 'padding: 40px;', 'padding: 40px 60px;');
  END IF;

  RETURN content;
END;
$$ LANGUAGE plpgsql;

-- Update all lessons containing CFUs
UPDATE lessons
SET
  lesson_outline = fix_cfu_padding(lesson_outline),
  learning_objectives = fix_cfu_padding(learning_objectives),
  vocabulary = fix_cfu_padding(vocabulary),
  materials = fix_cfu_padding(materials),
  vapa_text_block = fix_cfu_padding(vapa_text_block),
  ncas_text_block = fix_cfu_padding(ncas_text_block),
  welcome_opening = fix_cfu_padding(welcome_opening),
  actual_class_expectations = fix_cfu_padding(actual_class_expectations),
  lesson_hook = fix_cfu_padding(lesson_hook),
  warm_up = fix_cfu_padding(warm_up),
  main_activity = fix_cfu_padding(main_activity),
  instrument_expectations = fix_cfu_padding(instrument_expectations),
  reflection = fix_cfu_padding(reflection),
  closing_ceremony = fix_cfu_padding(closing_ceremony),
  assessment = fix_cfu_padding(assessment)
WHERE
  lesson_outline ~ 'data-check-for-understanding' OR
  learning_objectives ~ 'data-check-for-understanding' OR
  vocabulary ~ 'data-check-for-understanding' OR
  materials ~ 'data-check-for-understanding' OR
  vapa_text_block ~ 'data-check-for-understanding' OR
  ncas_text_block ~ 'data-check-for-understanding' OR
  welcome_opening ~ 'data-check-for-understanding' OR
  actual_class_expectations ~ 'data-check-for-understanding' OR
  lesson_hook ~ 'data-check-for-understanding' OR
  warm_up ~ 'data-check-for-understanding' OR
  main_activity ~ 'data-check-for-understanding' OR
  instrument_expectations ~ 'data-check-for-understanding' OR
  reflection ~ 'data-check-for-understanding' OR
  closing_ceremony ~ 'data-check-for-understanding' OR
  assessment ~ 'data-check-for-understanding';
