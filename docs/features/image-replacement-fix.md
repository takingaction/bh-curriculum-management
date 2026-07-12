# Image Replacement Fix

## Problem
When replacing an image in the media library modal:
1. Old image remained in storage after "replacement"
2. New database records were created instead of updating existing ones
3. Filenames like `dance_2.png` became `dance_21.png`, `dance_22.png` on repeated replacements

## Solution

### /api/upload/lesson-image/route.ts
- Added `existingImageId` parameter
- If provided, performs UPDATE instead of INSERT on `course_images` table
- Storage uses `upsert: true` to overwrite file at same path

### media-library.tsx
- `handleReplace()` now:
  1. Deletes old image from storage using REST API (direct, not via API route)
  2. Uploads new file with `existingImageId` to update database record
  3. Preserves original image ID

## Key Changes

### Upload endpoint accepts existingImageId
```typescript
const existingImageId = formData.get("existingImageId") as string | null;
// ...
if (existingImageId) {
  result = await supabaseAdmin
    .from("course_images")
    .update({ filename, storage_path, public_url })
    .eq("id", existingImageId)
    .select()
    .single();
} else {
  result = await supabaseAdmin
    .from("course_images")
    .insert({ course_id, filename, storage_path, public_url })
    .select()
    .single();
}
```

### handleReplace deletes from storage first
```typescript
await fetch(
  `${supabaseUrl}/storage/v1/object/course-images/${oldImage.storage_path}`,
  {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${supabaseServiceKey}`,
      "apikey": supabaseServiceKey,
    },
  }
);
```

## Related
- Supabase Storage does not allow direct SQL deletion from storage tables
- Must use Storage REST API or dashboard for file operations
