-- Add data-alignment attribute to existing CFUs based on alignment value
-- This ensures parseHTML can read the alignment correctly

UPDATE lessons SET
  lesson_outline = regexp_replace(
    lesson_outline,
    'alignment="([^"]+)"',
    'alignment="\1" data-alignment="\1"',
    'g'
  )
WHERE lesson_outline ~* 'data-check-for-understanding'
  AND lesson_outline ~* 'alignment='
  AND lesson_outline !~ 'data-alignment=';

UPDATE lessons SET
  learning_objectives = regexp_replace(
    learning_objectives,
    'alignment="([^"]+)"',
    'alignment="\1" data-alignment="\1"',
    'g'
  )
WHERE learning_objectives ~* 'data-check-for-understanding'
  AND learning_objectives ~* 'alignment='
  AND learning_objectives !~ 'data-alignment=';

UPDATE lessons SET
  vocabulary = regexp_replace(
    vocabulary,
    'alignment="([^"]+)"',
    'alignment="\1" data-alignment="\1"',
    'g'
  )
WHERE vocabulary ~* 'data-check-for-understanding'
  AND vocabulary ~* 'alignment='
  AND vocabulary !~ 'data-alignment=';

UPDATE lessons SET
  materials = regexp_replace(
    materials,
    'alignment="([^"]+)"',
    'alignment="\1" data-alignment="\1"',
    'g'
  )
WHERE materials ~* 'data-check-for-understanding'
  AND materials ~* 'alignment='
  AND materials !~ 'data-alignment=';

UPDATE lessons SET
  vapa_text_block = regexp_replace(
    vapa_text_block,
    'alignment="([^"]+)"',
    'alignment="\1" data-alignment="\1"',
    'g'
  )
WHERE vapa_text_block ~* 'data-check-for-understanding'
  AND vapa_text_block ~* 'alignment='
  AND vapa_text_block !~ 'data-alignment=';

UPDATE lessons SET
  ncas_text_block = regexp_replace(
    ncas_text_block,
    'alignment="([^"]+)"',
    'alignment="\1" data-alignment="\1"',
    'g'
  )
WHERE ncas_text_block ~* 'data-check-for-understanding'
  AND ncas_text_block ~* 'alignment='
  AND ncas_text_block !~ 'data-alignment=';

UPDATE lessons SET
  welcome_opening = regexp_replace(
    welcome_opening,
    'alignment="([^"]+)"',
    'alignment="\1" data-alignment="\1"',
    'g'
  )
WHERE welcome_opening ~* 'data-check-for-understanding'
  AND welcome_opening ~* 'alignment='
  AND welcome_opening !~ 'data-alignment=';

UPDATE lessons SET
  actual_class_expectations = regexp_replace(
    actual_class_expectations,
    'alignment="([^"]+)"',
    'alignment="\1" data-alignment="\1"',
    'g'
  )
WHERE actual_class_expectations ~* 'data-check-for-understanding'
  AND actual_class_expectations ~* 'alignment='
  AND actual_class_expectations !~ 'data-alignment=';

UPDATE lessons SET
  warm_up = regexp_replace(
    warm_up,
    'alignment="([^"]+)"',
    'alignment="\1" data-alignment="\1"',
    'g'
  )
WHERE warm_up ~* 'data-check-for-understanding'
  AND warm_up ~* 'alignment='
  AND warm_up !~ 'data-alignment=';

UPDATE lessons SET
  lesson_hook = regexp_replace(
    lesson_hook,
    'alignment="([^"]+)"',
    'alignment="\1" data-alignment="\1"',
    'g'
  )
WHERE lesson_hook ~* 'data-check-for-understanding'
  AND lesson_hook ~* 'alignment='
  AND lesson_hook !~ 'data-alignment=';

UPDATE lessons SET
  main_activity = regexp_replace(
    main_activity,
    'alignment="([^"]+)"',
    'alignment="\1" data-alignment="\1"',
    'g'
  )
WHERE main_activity ~* 'data-check-for-understanding'
  AND main_activity ~* 'alignment='
  AND main_activity !~ 'data-alignment=';

UPDATE lessons SET
  instrument_expectations = regexp_replace(
    instrument_expectations,
    'alignment="([^"]+)"',
    'alignment="\1" data-alignment="\1"',
    'g'
  )
WHERE instrument_expectations ~* 'data-check-for-understanding'
  AND instrument_expectations ~* 'alignment='
  AND instrument_expectations !~ 'data-alignment=';

UPDATE lessons SET
  reflection = regexp_replace(
    reflection,
    'alignment="([^"]+)"',
    'alignment="\1" data-alignment="\1"',
    'g'
  )
WHERE reflection ~* 'data-check-for-understanding'
  AND reflection ~* 'alignment='
  AND reflection !~ 'data-alignment=';

UPDATE lessons SET
  closing_ceremony = regexp_replace(
    closing_ceremony,
    'alignment="([^"]+)"',
    'alignment="\1" data-alignment="\1"',
    'g'
  )
WHERE closing_ceremony ~* 'data-check-for-understanding'
  AND closing_ceremony ~* 'alignment='
  AND closing_ceremony !~ 'data-alignment=';

UPDATE lessons SET
  assessment = regexp_replace(
    assessment,
    'alignment="([^"]+)"',
    'alignment="\1" data-alignment="\1"',
    'g'
  )
WHERE assessment ~* 'data-check-for-understanding'
  AND assessment ~* 'alignment='
  AND assessment !~ 'data-alignment=';
