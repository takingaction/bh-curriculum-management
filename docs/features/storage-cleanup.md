# Storage Cleanup - CLARA_Swash_Teal_ Images

## Problem
334 images with "CLARA_Swash_Teal_" in their filenames were stored but not properly linked or used in lessons. They needed to be cleaned up from:
1. Storage bucket
2. `course_images` table
3. Lesson content (broken `<img>` tags)

## Solution

### Migration: 011_cleanup_clara_images.sql
Creates `cleanup_clara_images()` stored procedure that:
1. Finds all images with `CLARA_Swash_Teal_` in filename
2. Deletes them from `course_images` table
3. Updates all lesson content columns to remove broken `<img>` tags

```sql
-- Run in Supabase SQL Editor
\i supabase/migrations/011_cleanup_clara_images.sql
```

### API: /api/storage/cleanup-clara
Calls the stored procedure.

```bash
curl -X POST http://localhost:3000/api/storage/cleanup-clara
```

Returns:
```json
{
  "success": true,
  "deletedFromStorage": 334,
  "deletedFromCourseImages": 334,
  "lessonsUpdated": 0
}
```

## Storage API Notes
Supabase does not allow direct deletion from storage tables via SQL. The cleanup must use:
- Storage REST API: `DELETE /storage/v1/object/course-images/{path}`
- Or use the Supabase Dashboard → Storage → manually delete files

The stored procedure only handles the database records and lesson content updates.
