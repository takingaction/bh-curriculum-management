-- Migration: 011_cleanup_clara_images
-- Description: Create stored procedure to cleanup CLARA_Swash_Teal_ images from storage, course_images, and lessons

CREATE OR REPLACE FUNCTION cleanup_clara_images()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_storage_count INT := 0;
  deleted_course_images_count INT := 0;
  lessons_updated_count INT := 0;
BEGIN
  -- Get count of images to delete
  SELECT COUNT(*) INTO deleted_storage_count FROM course_images WHERE filename LIKE '%CLARA_Swash_Teal_%';

  IF deleted_storage_count = 0 THEN
    RETURN json_build_object(
      'success', true,
      'message', 'No CLARA_Swash_Teal_ images found',
      'deletedFromStorage', 0,
      'deletedFromCourseImages', 0,
      'lessonsUpdated', 0
    );
  END IF;

  -- Delete from course_images table
  DELETE FROM course_images WHERE filename LIKE '%CLARA_Swash_Teal_%';
  GET DIAGNOSTICS deleted_course_images_count = ROW_COUNT;

  -- Update all lesson content columns that may contain CLARA_Swash_Teal_ img tags
  UPDATE lessons SET lesson_outline = REGEXP_REPLACE(lesson_outline, '<img[^>]*CLARA_Swash_Teal_[^>]*>', '', 'g') WHERE lesson_outline LIKE '%CLARA_Swash_Teal_%';
  UPDATE lessons SET learning_objectives = REGEXP_REPLACE(learning_objectives, '<img[^>]*CLARA_Swash_Teal_[^>]*>', '', 'g') WHERE learning_objectives LIKE '%CLARA_Swash_Teal_%';
  UPDATE lessons SET vocabulary = REGEXP_REPLACE(vocabulary, '<img[^>]*CLARA_Swash_Teal_[^>]*>', '', 'g') WHERE vocabulary LIKE '%CLARA_Swash_Teal_%';
  UPDATE lessons SET materials = REGEXP_REPLACE(materials, '<img[^>]*CLARA_Swash_Teal_[^>]*>', '', 'g') WHERE materials LIKE '%CLARA_Swash_Teal_%';
  UPDATE lessons SET vapa_text_block = REGEXP_REPLACE(vapa_text_block, '<img[^>]*CLARA_Swash_Teal_[^>]*>', '', 'g') WHERE vapa_text_block LIKE '%CLARA_Swash_Teal_%';
  UPDATE lessons SET ncas_text_block = REGEXP_REPLACE(ncas_text_block, '<img[^>]*CLARA_Swash_Teal_[^>]*>', '', 'g') WHERE ncas_text_block LIKE '%CLARA_Swash_Teal_%';
  UPDATE lessons SET welcome_opening = REGEXP_REPLACE(welcome_opening, '<img[^>]*CLARA_Swash_Teal_[^>]*>', '', 'g') WHERE welcome_opening LIKE '%CLARA_Swash_Teal_%';
  UPDATE lessons SET actual_class_expectations = REGEXP_REPLACE(actual_class_expectations, '<img[^>]*CLARA_Swash_Teal_[^>]*>', '', 'g') WHERE actual_class_expectations LIKE '%CLARA_Swash_Teal_%';
  UPDATE lessons SET lesson_hook = REGEXP_REPLACE(lesson_hook, '<img[^>]*CLARA_Swash_Teal_[^>]*>', '', 'g') WHERE lesson_hook LIKE '%CLARA_Swash_Teal_%';
  UPDATE lessons SET warm_up = REGEXP_REPLACE(warm_up, '<img[^>]*CLARA_Swash_Teal_[^>]*>', '', 'g') WHERE warm_up LIKE '%CLARA_Swash_Teal_%';
  UPDATE lessons SET main_activity = REGEXP_REPLACE(main_activity, '<img[^>]*CLARA_Swash_Teal_[^>]*>', '', 'g') WHERE main_activity LIKE '%CLARA_Swash_Teal_%';
  UPDATE lessons SET instrument_expectations = REGEXP_REPLACE(instrument_expectations, '<img[^>]*CLARA_Swash_Teal_[^>]*>', '', 'g') WHERE instrument_expectations LIKE '%CLARA_Swash_Teal_%';
  UPDATE lessons SET reflection = REGEXP_REPLACE(reflection, '<img[^>]*CLARA_Swash_Teal_[^>]*>', '', 'g') WHERE reflection LIKE '%CLARA_Swash_Teal_%';
  UPDATE lessons SET closing_ceremony = REGEXP_REPLACE(closing_ceremony, '<img[^>]*CLARA_Swash_Teal_[^>]*>', '', 'g') WHERE closing_ceremony LIKE '%CLARA_Swash_Teal_%';
  UPDATE lessons SET assessment = REGEXP_REPLACE(assessment, '<img[^>]*CLARA_Swash_Teal_[^>]*>', '', 'g') WHERE assessment LIKE '%CLARA_Swash_Teal_%';

  -- Count lessons that were updated (check any column)
  SELECT COUNT(*) INTO lessons_updated_count FROM lessons WHERE
    lesson_outline LIKE '%CLARA_Swash_Teal_%' OR
    learning_objectives LIKE '%CLARA_Swash_Teal_%' OR
    vocabulary LIKE '%CLARA_Swash_Teal_%' OR
    materials LIKE '%CLARA_Swash_Teal_%' OR
    vapa_text_block LIKE '%CLARA_Swash_Teal_%' OR
    ncas_text_block LIKE '%CLARA_Swash_Teal_%' OR
    welcome_opening LIKE '%CLARA_Swash_Teal_%' OR
    actual_class_expectations LIKE '%CLARA_Swash_Teal_%' OR
    lesson_hook LIKE '%CLARA_Swash_Teal_%' OR
    warm_up LIKE '%CLARA_Swash_Teal_%' OR
    main_activity LIKE '%CLARA_Swash_Teal_%' OR
    instrument_expectations LIKE '%CLARA_Swash_Teal_%' OR
    reflection LIKE '%CLARA_Swash_Teal_%' OR
    closing_ceremony LIKE '%CLARA_Swash_Teal_%' OR
    assessment LIKE '%CLARA_Swash_Teal_%';

  RETURN json_build_object(
    'success', true,
    'deletedFromStorage', deleted_storage_count,
    'deletedFromCourseImages', deleted_course_images_count,
    'lessonsUpdated', lessons_updated_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_clara_images() TO service_role;
