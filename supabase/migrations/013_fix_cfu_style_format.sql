-- Fix CFU background-image style format to match TipTap's expected format
-- Maintains padding: 5px 20px, background-size: 100% 100%, uses &quot; for URL encoding

CREATE OR REPLACE FUNCTION fix_cfu_background_style()
RETURNS integer AS $$
DECLARE
  lesson_row RECORD;
  field_name text;
  field_value text;
  new_value text;
  url_match text;
  old_style text;
  new_style text;
  width_match text;
  fixed_count integer := 0;
  fields text[] := ARRAY[
    'lesson_outline', 'learning_objectives', 'vocabulary', 'materials',
    'vapa_text_block', 'ncas_text_block', 'welcome_opening', 'actual_class_expectations',
    'warm_up', 'lesson_hook', 'main_activity', 'instrument_expectations',
    'reflection', 'closing_ceremony', 'assessment'
  ];
BEGIN
  FOR lesson_row IN SELECT id FROM lessons LOOP
    FOREACH field_name IN ARRAY fields LOOP
      EXECUTE format('SELECT %I FROM lessons WHERE id = %L', field_name, lesson_row.id) INTO field_value;
      
      IF field_value IS NOT NULL AND field_value ~* 'data-check-for-understanding' THEN
        -- Find the background-image URL
        IF field_value ~* 'background-image:\s*url\([^)]+\)' THEN
          url_match := substring(field_value from 'background-image:\s*url\([^)]+\)');
          
          -- Extract just the URL
          url_match := replace(url_match, 'background-image:', '');
          url_match := trim(replace(replace(replace(url_match, 'url(', ''), ')', ''), ' ', ''));
          -- Handle both &quot; and regular quotes
          url_match := replace(url_match, '&quot;', '');
          url_match := replace(url_match, '''', '');
          
          -- Find current width from style
          IF field_value ~* 'width:\s*[0-9]+%' THEN
            width_match := 'width: ' || substring(field_value from 'width:\s*([0-9]+%)')[1];
          ELSE
            width_match := 'width: 50%';
          END IF;
          
          -- Build new style
          new_style := 'background-image: url(&quot;' || url_match || '&quot;); background-size: 100% 100%; background-position: center center; background-repeat: no-repeat; padding: 5px 20px; ' || width_match;
          
          -- Replace entire style attribute within CFU divs
          -- Match style="..." that comes after data-check-for-understanding
          new_value := regexp_replace(
            field_value,
            '(<div[^>]*data-check-for-understanding[^>]*)\s+style="[^"]*"',
            '\1 style="' || new_style || '"',
            'gi'
          );
          
          -- Only update if something changed
          IF new_value != field_value THEN
            EXECUTE format('UPDATE lessons SET %I = %L WHERE id = %L', field_name, new_value, lesson_row.id);
            fixed_count := fixed_count + 1;
          END IF;
        END IF;
      END IF;
    END LOOP;
  END LOOP;
  
  RETURN fixed_count;
END;
$$ LANGUAGE plpgsql;

-- Run the function
SELECT fix_cfu_background_style() AS lessons_fixed;
