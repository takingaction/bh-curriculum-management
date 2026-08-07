<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Project Context: Performers Ready! Curriculum Management Platform

### Overview
Vercel deployment with Supabase for admin/teacher workflow. Manages music education curriculum with rich text lesson editing.

### Key Technologies
- **Framework**: Next.js with Turbopack
- **Database/Auth**: Supabase (PostgreSQL)
- **Rich Text Editor**: TipTap with custom extensions
- **Styling**: Tailwind CSS with shadcn/ui components
- **Font**: Montserrat

### Important Implementation Notes

#### CSS Styling Conventions
- Use `style="margin-left: Npx"` for indentation (required for PDF generation)
- Clean CSS without `!important` - use specificity hierarchy
- Headers use `h3` for all bold headings (no anchor-standard class)
- All h3s treated equally - no special styling for anchor standards
- `.lesson-content` wrapper needed for CSS selectors: `#vapa_text_block td .lesson-content > h3`
- First h3 in any section gets 0.5rem top margin (first-of-type rule)
- Subsequent h3s get 1.5rem top margin
- **Empty paragraphs**: Use `min-height: 0.5rem` and `display: block` to ensure hard return gaps render correctly

#### Lesson Content Rendering
- Uses `dangerouslySetInnerHTML` instead of ReactMarkdown to preserve empty HTML tags
- Content is sanitized on save, so no XSS risk
- Empty `<p>` tags need CSS fix to render properly: `.lesson-content p:empty { min-height: 0.5rem; display: block; }`

#### Resource Link Arrows (CSS ::after)
Links to materials (resource-links) and YouTube links have arrows appended via CSS `::after` pseudo-elements:
- **Resource links** (`.resource-link`): `content: " ↗";` - upward-right arrow
- **YouTube links** (`.youtube-link` or URL contains youtube.com/youtu.be): `content: " ▶";` - play icon

These apply to both `.ProseMirror` (editor) and `.lesson-content` (student view) via `globals.css`:
```css
.lesson-content a.resource-link::after {
  content: " ↗";
  font-size: 16px;
  color: #0d7377;
  margin-left: 2px;
}
.lesson-content a.youtube-link::after,
.lesson-content a[href*="youtube.com"]::after,
.lesson-content a[href*="youtu.be"]::after {
  content: " ▶";
  font-size: 14px;
  color: #0d7377;
  margin-left: 2px;
}
```

#### Pipe Separator Fix (Resource Links)
**Problem:** When multiple resource links were added side-by-side (e.g., `Sheet Music | Piano Track`), the pipe separator was incorrectly placed inside the anchor tag: `<a>Sheet Music | </a><a>Piano Track</a>`

**SQL Migration to fix:** Replace `<a([^>]*)>([^<]*)\s+\|\s*</a>` with `<a\1>\2</a> | ` across all 15 content fields.

**Note:** This pattern occurred when teachers used the link modal to add multiple links, inadvertently including the pipe separator inside the anchor text.

#### TipTap Editor Extensions
Located in `src/components/editor/extensions/`:

**spell-check.ts** - Custom spellcheck with:
- 107K word dictionary loaded from `words-en.json`
- Common words and contractions in `commonWords` Set
- Custom words stored in `customWords` Set (persisted to localStorage)
- Handles possessives/contractions: strips `'s`, `s'`, `'ve`, `'re`, `'ll`, `'m`, `n't` before spell checking
- Handles both straight (`'`) and curly (`'` U+2019, `'`) apostrophes
- Uses ProseMirror decorations to underline misspelled words
- CSS class `.misspelled` for styling (underline wavy red)

**words-en.json** - Bundled word list from wordlist-english package (~107K words)

#### Spellcheck Word Handling
- **Apostrophe patterns**: The spellcheck preserves apostrophes in possessive/contraction patterns before checking
  - Pattern check: `/.*['\u2019]s$/i` for possessives, `/.*['\u2019]ve$/i` for contractions, etc.
  - If word matches pattern, apostrophe is preserved (not stripped) before base word check
- **Base word checking**: After preserving/stripping apostrophes, checks if base word is in dictionary
  - e.g., `today's` → preserves `'s` → checks `today` → found ✓
  - e.g., `we've` → preserves `'ve` → checks `we` → found ✓
- **Custom words**: Added via + button in editor toolbar, persisted to localStorage key `spellcheck-custom-words`
- **+ / - buttons**: Add or remove custom words, only removes words added via +, not base dictionary
- **Cross-node boundary check**: Flags text ending with `:` when followed by text starting with a letter across inline tags (e.g., `<strong>Content:</strong>Students` - flags "Content:" as potentially having missing space after colon)

#### Show Invisibles Feature
- Uses official `@tiptap/extension-invisible-characters` extension
- Toggle via `editor?.commands.toggleInvisibleCharacters()`
- Extension handles its own CSS styling (not custom CSS in globals.css)
- Shows hard returns (paragraph breaks) and soft returns (line breaks)

#### Cleanup HTML Endpoint
`POST /api/cleanup-html` - Consolidated cleanup for:
- Nested tags removal
- Malformed HTML fixing (p>strong with h3 closing, h3 with stray </strong>, h3 containing PK.MU:/PK:/MU:)
- Anchor standard removal (replacing h3.anchor-standard with plain h3)

#### Check for Understanding (CFU) Entity
- TipTap block node with ReactNodeViewRenderer
- 8 attributes: cfuId, backgroundImage, pngImage, heading, content, alignment, width, pngWidth
- 9 position options: wrap-top-left/center/right, left/center/right, wrap-bottom-left/center/right
- Default entity width: 50%, background: contain, padding: 30px 40px
- Text: 16px, weight 700, vertical-align middle, text-align left
- **Left column: 25% fixed width, image right-aligned, pngWidth (1-100, default 100) controls image width within column**
- **Click-to-edit**: Single click opens modal (with z-index, contentEditable=false fixes)
- **Unique cfuId**: Generated on insert (Date.now().toString(36) + random)
- **Editor isolation**: Only the editor containing the CFU opens its modal
- **Modal uses refs**: onCloseRef, onInsertRef for stable callback references
- **Click rate limiting**: 1-second cooldown via lastClickRef in NodeView
- **Delete with confirmation**: Delete button in modal footer (when editing), confirmation modal in editor

#### CFU Attribute Parsing (addAttributes)
CFU attributes are stored as HTML attributes on the div. TipTap writes lowercase attribute names:
- `backgroundimage` - URL for background SVG image (TipTap format)
- `pngimage` - URL for left column image
- `cfuid` / `data-cfu-id` - unique identifier
- `data-background-image` / `data-png-image` - alternative data attribute format
- `heading` / `content` - text content (also read from inner h4/p tags)
- `alignment` / `width` / `pngwidth` - positioning and sizing

**parseHTML fallback chain** (e.g., for `backgroundImage`):
1. Check `backgroundimage` attribute first (TipTap writes this)
2. Check `data-background-image` attribute
3. Parse from `style` attribute's `background-image: url(...)` as last resort

This ensures existing CFUs in database work regardless of which format their attributes are stored in.

#### CFU renderHTML Structure
**Important:** The `renderHTML` method must produce properly nested HTML structure for CSS selectors to work.

**Required structure:**
```html
<tr>
  <td class="cfu-image-cell">  <!-- 25% width, image right-aligned -->
    <img ...>                  <!-- nested inside td, NOT a sibling -->
  </td>
  <td class="cfu-text-cell">   <!-- 75% width, text left-aligned -->
    <h4>...</h4>               <!-- nested inside td, NOT a sibling -->
    <p>...</p>                 <!-- nested inside td, NOT a sibling -->
  </td>
</tr>
```

**Implementation uses `imageCell` and `textCell` arrays:**
- `imageCell: any[] = ["td", { class: "cfu-image-cell", ... }]` - td element with img nested inside
- `textCell: any[] = ["td", { class: "cfu-text-cell", ... }]` - td element with h4 and p nested inside
- Content elements (`img`, `h4`, `p`) are pushed into their parent td array, not added as siblings

**Alignment class mapping (critical for wrap-bottom positions):**
```javascript
"wrap-top-left": "cfu-wrap-top-left",
"wrap-top-right": "cfu-wrap-top-right",
"wrap-top-center": "cfu-wrap-top-center",
"wrap-bottom-left": "cfu-wrap-bottom-left",    // was incorrectly mapped to cfu-wrap-top-left
"wrap-bottom-right": "cfu-wrap-bottom-right",   // was incorrectly mapped to cfu-wrap-top-right
"wrap-bottom-center": "cfu-wrap-bottom-center", // was incorrectly mapped to cfu-wrap-top-center
"left": "cfu-left",
"right": "cfu-right",
"center": "cfu-center",
```

#### CFU SQL Migrations
- CFUs stored in 15 text fields: lesson_outline, learning_objectives, vocabulary, materials, vapa_text_block, ncas_text_block, welcome_opening, actual_class_expectations, warm_up, lesson_hook, main_activity, instrument_expectations, reflection, closing_ceremony, assessment
- Each CFU is a div with data-check-for-understanding="true" attribute
- **Padding updates**: Use regex to target only CFU div padding (e.g., `padding:\s*3px\s+60px`), not all padding in database
- **Background updates**: Must use `&quot;` encoding for URL quotes in inline styles (TipTap format)
- **Background image SVG**: Must have `preserveAspectRatio="none"` in SVG markup to stretch correctly with `background-size: 100% 100%`

#### CFU Broken HTML Structure Fix (August 2026)
**Problem:** Commit `5533b05` introduced a bug in `renderHTML` that caused `img`, `h4`, and `p` elements to be siblings of `<table>` instead of nested inside the `<td>` cells. This made CFU images render at full size instead of constrained to cell width.

**Broken pattern:**
```html
<td class="cfu-image-cell"></td>
<img src="...">                          <!-- OUTSIDE td -->
<td class="cfu-text-cell"></td>
<h4>...</h4>                             <!-- OUTSIDE td -->
<p>...</p>                               <!-- OUTSIDE td -->
```

**SQL Migration to fix:**
```sql
BEGIN;
CREATE OR REPLACE FUNCTION fix_cfu_html(html TEXT)
RETURNS TEXT AS $$
BEGIN
  html := regexp_replace(html,
    E'<td class="cfu-image-cell"([^>]*)></td>(<img[^>]+>)',
    E'<td class="cfu-image-cell"\\1>\\2</td>',
    'g');
  html := regexp_replace(html,
    E'<td class="cfu-text-cell"([^>]*)></td>(<h4[^>]*>[^<]*</h4>)<p([^>]*)>([^<]*)</p>',
    E'<td class="cfu-text-cell"\\1>\\2<p\\3>\\4</p></td>',
    'g');
  RETURN html;
END;
$$ LANGUAGE plpgsql;

UPDATE lessons SET
  lesson_outline = fix_cfu_html(lesson_outline),
  learning_objectives = fix_cfu_html(learning_objectives),
  vocabulary = fix_cfu_html(vocabulary),
  materials = fix_cfu_html(materials),
  vapa_text_block = fix_cfu_html(vapa_text_block),
  ncas_text_block = fix_cfu_html(ncas_text_block),
  welcome_opening = fix_cfu_html(welcome_opening),
  actual_class_expectations = fix_cfu_html(actual_class_expectations),
  warm_up = fix_cfu_html(warm_up),
  lesson_hook = fix_cfu_html(lesson_hook),
  main_activity = fix_cfu_html(main_activity),
  instrument_expectations = fix_cfu_html(instrument_expectations),
  reflection = fix_cfu_html(reflection),
  closing_ceremony = fix_cfu_html(closing_ceremony),
  assessment = fix_cfu_html(assessment)
WHERE id IN ('<lesson_ids>');
COMMIT;
```

**Affected courses/lessons fixed (27 total):**
- Music and Movement (2 lessons)
- The Blues (2 lessons)
- Squares (2 lessons)
- Programmatic Music (2 lessons)
- Opera and Musical Theatre (2 lessons)
- Triangles (2 lessons)
- Music Moods (2 lessons)
- Count on Me (2 lessons)
- Chants and Cheers (2 lessons)
- The Conductor (2 lessons)
- Circles (2 lessons)
- Take Me Out to the Ball Game (2 lessons)
- Dynamic Symbols (1 lesson)
- Rehearsal: Part 1 (1 lesson)
- Music Makes Me... (1 lesson)

**Detection query:**
```sql
SELECT id, title FROM lessons WHERE
  lesson_outline ~ '<td class="cfu-image-cell"[^>]*></td>\\s*<img'
  OR learning_objectives ~ '<td class="cfu-image-cell"[^>]*></td>\\s*<img'
  -- (same pattern for all 15 fields)
```

#### PDF CFU Styling (pdf-service/src/template.js)
- **CFU Block**: padding: 3px 20px, margin: 8px 0 48px 0, overflow: hidden
- **CFU font**: 10pt for both h4 title and p body (matching body font size)
- **Background image**: Uses `preserveAspectRatio="none"` on SVG to allow stretching with `background-size: 100% 100%`
- **Wrapped CFUs** (wrap-top-left, wrap-top-right, etc.): `display: flow-root` for proper float containment
- **Section headers** (`.section-header`): `clear: both` to prevent overlap with floated CFUs from previous section
- **CFU margins with !important**: All CFU alignment classes have `!important` to override inline styles
- **Lesson Outline bullets**: Uses `margin-bottom: -5px` (negative margin) to close up vertical space between bullet items
- **Key CSS patterns**:
  ```css
  .lesson-content [data-check-for-understanding="true"] {
    padding: 3px 20px !important;
    margin: 8px 0 48px 0 !important;
    overflow: hidden;
    background-size: 100% 100% !important;
  }
  .lesson-content [data-check-for-understanding][class*="wrap"] {
    display: flow-root;
  }
  .section-header {
    clear: both;
  }
  .lesson-content .cfu-wrap-top-left {
    margin: 0 20px 16px 0 !important;
  }
  /* etc for all alignment classes */
  .left-column .lesson-content li {
    margin-bottom: -5px;  /* tighter bullet spacing in lesson outline */
  }
  ```

#### Table Extensions
**table-with-styles.ts** - Custom table extension with:
- `columnWidths` attribute (array of percentage strings like ["33%", "33%", "34%"])
- `tableWidth` attribute (overall width percentage)
- `tableAlignment` attribute (left/center/right)
- `showGrid` attribute for lesson grid toggle
- `renderHTML` generates `<colgroup>` with proper inline styles
- Uses `table-layout: fixed` for colgroup widths to work

**table-cell-with-width.ts** - Simplified cell extension (no per-cell width attribute)

**Table column index fix**: Changed from `$from.index(depth)` to node reference comparison (`row.child(i) === cellNode`) to fix always returning 0 bug

#### Image Extension
**image-with-options.ts** - Custom image extension with alignment and width:
- `align` attribute: 'left' | 'center' | 'right'
  - Left: no style (default)
  - Center: `display: block; margin-left: auto; margin-right: auto;`
  - Right: `float: right;`
- `widthPercent` attribute: 1-100 (renders as `width: X%;` style)
- **Commands**: `setImageAlign`, `setImageWidth`, `deleteImage`
- **Image toolbar**: Appears when image is selected, contains align buttons, width input, delete button
- **Delete image**: Uses custom modal confirmation (not browser alert)

#### Spotify Embed Component
**spotify-embed.tsx** - Draggable and resizable Spotify playlist modal:
- Appears in top-right corner when opened
- Draggable by header (uses refs, no re-renders during drag)
- Resizable from bottom-right corner
- X button to close
- Uses direct DOM manipulation during drag to prevent iframe reload

#### YouTube Video Links in Lesson Content
**youtube-dialog.tsx** - Popup dialog for YouTube videos in lesson content:
- Auto-opens when mounted with video playing
- Parses YouTube URLs (youtu.be, youtube.com/watch, youtube.com/embed)
- "Watch on YouTube" link below video
- Closes on backdrop click or X button

**YouTube Link Detection:**
- Links containing `youtube.com` or `youtu.be` are auto-detected
- CSS shows play arrow (▶) next to YouTube links in lesson content
- Click opens YouTubeDialog with auto-playing video
- Works with existing YouTube links (no class required)
- Link modal auto-adds `youtube-link` class for new YouTube URLs

**PDF Generation:**
- Play icon (▶) added to YouTube links during PDF generation
- Uses URL pattern matching (youtube.com, youtu.be) to detect links
- Icon is embedded directly in HTML content (not CSS) for PDF compatibility
- Both class-based and URL-based detection supported

#### Lesson Editor Layout (Admin)
Two-column layout at `src/app/(dashboard)/admin/courses/[id]/lessons/[lessonId]/page.tsx`:

**Left Column (280px, sticky):**
- "General Info" button (coral when inactive, green when active)
- "Lesson Materials" button (coral when inactive, green when active)
- Divider
- 15 section buttons (green when selected, light teal when not)

**Right Column (flex-1):**
- **General Info panel**: Lesson Number, Title, Total Time inputs
- **Lesson Materials panel**: Assets panel, Presentation (Spotify is now on course level)
- **Section Editor panel**: Section label + TipTap LessonEditor with sticky toolbar

**State Management:**
- `activePanel: 'general' | 'materials' | 'section'`
- `selectedSection` tracks which content section (for section panel)
- **URL param**: `?section=<fieldName>` opens directly to that section on page load

**Editor Toolbar (sticky at top-14 z-40):**
- Contains all formatting buttons (Bold, Italic, H2, H3, Lists, etc.)
- Table context toolbar when inside table
- Image context toolbar when image is selected
- All toolbars in single sticky container

### Database Schema
- `profiles` - User profiles with role (admin/teacher), enrollment_status, enrollments array
- `courses` - Course information with discipline, grade, and spotify_embed_code
- `lessons` - Individual lessons with content, timing, presentation, etc. (Spotify is now on courses table)
- `lesson_assets` - Links assets to lessons with sort_order
- `cfu_assets` - Check for Understanding assets (admin only)

### Enrollment System
Single source of truth: `profile.enrollments` array controls course access for all users (including admins).

**Enrollment values:**
- `"ALL"` - Access to all courses
- `"MUSIC"` - All music discipline courses
- `"DANCE"` - All dance discipline courses
- `"THEATRE"` - All theatre discipline courses
- `"MUSIC_GRADE_3"` - A specific single course (discipline + grade)

**Examples:**
- `["ALL"]` → everything
- `["MUSIC"]` → all music courses
- `["MUSIC", "DANCE"]` → all music + all dance
- `["MUSIC", "DANCE_GRADE_K"]` → all music + one specific dance course
- `["MUSIC_GRADE_3", "MUSIC_GRADE_4"]` → only Music grades 3 and 4

**Dashboard filtering:** All users (admin and teacher) are filtered by their `profile.enrollments`.

### RLS Policies
- Profiles: Users can read all, update only own profile (admin can update all)
- Courses/Lessons: All users filtered by `profile.enrollments` at application level

### Common Tasks

#### Adding new TipTap extension
1. Create file in `src/components/editor/extensions/`
2. Import and add to extensions array in `lesson-editor.tsx`
3. Follow TipTap Extension API pattern with `addProseMirrorPlugins()` for decorations

#### Spellcheck troubleshooting
- If words still flagged, check:
  1. Is the apostrophe type correct (straight vs curly)?
  2. Is the pattern in the possessive/contraction regex?
  3. Is the base word in dictionary?
- To add words temporarily: Use + button in editor
- To add words permanently: Add to `commonWords` in spell-check.ts

#### Find & Replace Feature
- **Location**: Collapsible panel at top of lesson editor and student lesson view (admin only)
- **Scope options**: Lesson, Course (with course dropdown), or Global
- **Find field**: Checkbox below "Match case exactly" - ON = case sensitive, OFF = case insensitive (default: OFF)
- **Replace field**: Checkbox "Force exact case" - ON = exact replacement, OFF = preserve original case pattern (default: ON)
- **Search behavior**: Case-sensitive or case-insensitive substring match on text content (ignores HTML tags). Can find text that spans across inline tag boundaries (e.g., `<strong>Content:</strong>Students` - can find "Content:Students")
- **Replace behavior**: Exact case from replacement input (when Force exact case = ON), or preserves original case pattern (when OFF). Both find and replace now handle cross-segment matches.
- **Results**: Shows Lesson Number, Course Name, Grade, Field Label, and match snippet. Grade helps distinguish duplicate course names across different grades.
- **View button**: Opens lesson editor directly to the matching section via `?section=<fieldName>` URL param
- **Key files**:
  - `src/lib/html-utils.ts` - HTML parsing, text finding/replacing helpers (includes `replaceTextPreserveCase` for case-preserving replace)
  - `src/app/api/find-replace/route.ts` - GET (search) and PATCH (replace) API endpoints
  - `src/components/find-replace-panel.tsx` - UI component with scope selector, case options, results display
- **API endpoints**:
  - GET `/api/find-replace?search=X&scope=lesson|course|global&lessonId=X&courseId=X&caseSensitive=true|false`
  - PATCH `/api/find-replace` - Body: `{ search, replace, scope, lessonId?, courseId?, caseSensitive, forceExactCase }`

#### Internal Section Links
- **Purpose**: Link text within one lesson section to another section of the same lesson (e.g., "Lesson Hook" text linking to the "Lesson Hook" section)
- **Implementation**: Uses anchor links with `#section_key` format (e.g., `#lesson_hook`)
- **Link Modal**: Added "Sections" tab showing all 15 lesson sections
- **Insert behavior**: Clicking a section inserts link with `href="#section_key"` and `class="section-link"`
- **Visual styling**: Section links styled in teal (`#0d7377`) to distinguish from external links (red) and resource links
- **Student view**: Each section renders with `id={section.key}`, so clicking section links scrolls to that section

#### Page Break Images
- `last-page.png` - Full-width flush image before Assessment section (Assessment is the last content page)
- Stored in `/public/images/` in Next.js repo, served at `{APP_URL}/images/`
- CSS class `.page-break-image` with `object-fit: contain`, `break-before: page`
- page3.png no longer used (VAPA/NCAS sections no longer have page break images)

#### PDF Generation
- **Architecture**: Dedicated Puppeteer service on Render.com, separate from Vercel (Vercel's 250MB serverless limit can't accommodate Puppeteer's ~170MB Chromium)
- **GitHub repo**: `https://github.com/takingaction/pdf-service`
- **Render service**: `https://pdf-service-m3mc.onrender.com` (Free tier - may have cold start latency)
- **API endpoints**:
  - `POST /pdf` - Accepts `{ html: string, filename?: string }` → returns `application/pdf`
  - `POST /lesson-pdf` - Accepts `{ lesson: object, course: object, filename?: string }` → returns `application/pdf`
  - `POST /debug-html` - Returns rendered HTML for testing
  - `GET /health` - Health check
- **Lesson PDF sections** (in order):
  1. Lesson Outline
  2. Learning Objectives
  3. Vocabulary
  4. Materials
  5. VAPA Standards
  6. NCAS Standards
  7. Welcome and Opening Check-In
  8. Class Expectations and Procedures
  9. Warm Up
  10. Lesson "Hook"
  11. Main Activity
  12. Instrument Expectations
  13. Reflection
  14. Closing Ceremony
  15. Assessment
- **PDF Layout**:
  - **Page 1 (Title Page)**: "PERFORMERS READY!" logo, course name and grade on coral background, hero image fills remainder. `@page :first { margin: 0; }`
  - **Page 2 (Two-Column)**: "LESSON PLAN: CLASS N" header + `"Lesson Title"` in curly quotes. Left column = Lesson Outline (70/30 split); Right column = Learning Objectives, Vocabulary, Materials. Uses default `@page { margin: 0.5in; }`
  - **Pages 3+ (Full-Width)**: All remaining sections in full-width stacked layout with 0.5in margins
  - **Assessment Page (Last)**: Full bleed page (`@page assessment { margin: 0; }`) with fake 0.5in side margins via `padding: 0 0.5in` on `.assessment-section`. Contains last-page.png (flush), assessment table, logo-end.png (35% width centered)
  - **Section Headers**: VAPA/NCAS = gray (#D1D3DB); All others = coral (#e37c64)
- **PDF features**:
  - Uses `courses.pdf_image_url` for title page hero image (separate from website `image_url`)
  - Letter size with 0.5in margins on pages 2+
  - Assessment page uses named `@page assessment { margin: 0; }` with fake side margins via padding
  - Sections only included if content exists (not null/empty)
  - CSS support for tables, images (alignment), lists, bold/italic
  - CFU blocks: no gray background, no vertical line, alignment classes match lesson view, 20px margins with `!important` for text wrap
  - Puppeteer footer template for page numbers (abandoned due to @sparticuz/chromium limitations)
  - Section headers: 16px margin-top ensures consistent spacing above headers when content spills to next page
- **Key files in pdf-service**:
  - `src/index.js` - Express server with Puppeteer PDF generation
  - `src/template.js` - HTML template builder for lesson PDFs
  - `render.yaml` - Render deployment configuration
- **PDF API endpoints** (Next.js):
  - `GET /api/lessons/[lessonId]/pdf/info` - Get PDF metadata (exists, generated_at, file_size, filename)
  - `GET /api/lessons/[lessonId]/pdf` - View or download PDF (via ?download=true/false)
  - `POST /api/lessons/[lessonId]/pdf/generate` - Generate PDF, upload to Supabase Storage, update metadata
  - `GET /api/lessons/[lessonId]/pdf/diagnostics` - Diagnostic endpoint for debugging PDF issues
- **PDF error handling**: Generate endpoint returns detailed diagnostics on failure including PDF service URL, response status, HTML vs JSON detection, and extracted error messages

#### Batch PDF Regeneration Tool
Admin tool for regenerating all lesson PDFs at `/admin/pdf-regenerate`.

**Database tables**:
- `batch_pdf_jobs` - Tracks batch job status (pending/processing/completed/cancelled), progress counts, created_by
- `batch_pdf_results` - Individual lesson results with status (pending/success/failed), error messages, retry_count

**API endpoints**:
- `POST /api/batch/pdf-regenerate` - Start new batch (clears old stuck/cancelled jobs first, preserves history)
- `GET /api/batch/current` - Get current running job or most recent
- `GET /api/batch/[jobId]/pending` - Get pending lessons for resume
- `GET /api/batch/[jobId]?page=N&pageSize=20&status=success|failed` - Paginated results with course/lesson info and PDF file size
- `POST /api/batch/[jobId]/results` - Submit result for a lesson
- `POST /api/batch/[jobId]/retry-failed` - Reset all failed results to pending and sync counters
- `POST /api/batch/[jobId]/sync-counters` - Re-sync job counters from database (fixes out-of-sync counts)
- `POST /api/batch/[jobId]/cancel` - Cancel a running batch job
- `POST /api/batch/clear-stuck` - Clear stuck processing jobs

**Processing flow**:
1. Admin clicks "Start New Batch" → confirmation modal → creates fresh job for all lessons
2. OR "Resume Batch" → processes only pending lessons from existing stuck job
3. Client fetches all lesson IDs and processes sequentially (1 at a time)
4. Each lesson: POST to `/api/lessons/[id]/pdf/generate` → retry once if failed → submit result
5. Results refresh after each lesson completes

**UI features**:
- **Stuck job detection**: When job is "processing" but not actively running, shows "Resume Batch", "Cancel Batch", "Start New Batch" buttons
- **Resume Batch**: Picks up from where previous run left off, processes only pending lessons
- **Sync Counters**: Button to re-sync job counters from database (fixes display when counters drift)
- **Retry Failed**: Resets all failed results to pending for retry
- Progress bar + counters (success/fail/total)
- Filter tabs (All/Success/Failed) - sortable results by Title or PDF Size
- Paginated results table with Discipline, Grade, Lesson #, Title, PDF Size, Status
- Row actions: [Log] [Edit Lesson] [View PDF]
- Log modal shows simplified error reason (e.g., "File size exceeded", "Generation timed out") plus full diagnostics
- Confirmation modal before starting/resuming batch

**Note**: On Render Starter plan, PDFs process sequentially (~20 sec each, ~4 hours for 720 lessons)

### Environment Variables Required
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PDF_SERVICE_URL` - URL for PDF generation service (e.g., `https://pdf-service-m3mc.onrender.com`)
- `COOKIE_DOMAIN=.www.performersready.com` - Cookie domain for production only

### Cookie Domain Configuration
Custom domain `www.performersready.com` requires explicit cookie domain for auth to work.

**Environment Variable:**
- `COOKIE_DOMAIN=.www.performersready.com` - Set in Vercel for production only (not needed locally)

**Files that set cookies:**
- `src/lib/supabase/server.ts` - `createClient()` sets auth cookies
- `src/app/auth/callback/route.ts` - OAuth/magic link callback sets session cookies

**Cookie domain:** `.www.performersready.com` (leading dot covers both www and apex redirect)

**Why this is needed:**
- When app was on `.vercel.app`, cookies were scoped to that domain
- After adding custom domain, cookies need explicit domain to work on `www.performersready.com`
- Apex domain `performersready.com` redirects (307/308) to www, so all auth happens on www

**Supabase Dashboard settings:**
- Authentication > URL Configuration > Site URL: `https://www.performersready.com`
- Redirect URLs must include: `https://www.performersready.com/auth/callback`

**Dropdown signout fix (RESOLVED):**
- Log Out uses POST form instead of GET link to prevent prefetch-triggered signout
- All dropdown links have `prefetch={false}` to avoid unnecessary RSC requests
- Issue: Next.js was prefetching `/auth/signout` on dropdown open, which has a GET handler that deleted all cookies
- Fix: Converted to POST form, dropdown no longer clears cookies on open
- Logout redirect uses 303 to convert POST to GET (NextResponse.redirect defaults to 307 which preserves POST method, causing 405 on /login)

**Teacher signup duplicate key fix (RESOLVED):**
- Database has `handle_new_user` trigger that auto-creates profile when auth user is inserted
- `/api/teachers/signup/route.ts` was using `INSERT` for profile after creating auth user
- This caused "duplicate key value violates unique constraint 'profiles_pkey'" error
- Fix: Changed to `UPDATE ... .eq("id", authData.user.id)` since trigger already created the profile

**TK/PK grade enrollment mismatch fix (RESOLVED):**
- Enrollment system stores keys as `MUSIC_GRADE_PK`, `DANCE_GRADE_PK`, etc. (not TK)
- `enrollments-select.tsx` was using "TK" in GRADES array, creating `MUSIC_GRADE_TK` keys
- Dashboard filter matches `course.discipline_GRADE_course.grade` against enrollments
- Course grade "PK" didn't match enrollment "TK" → TK courses invisible to users
- Fix: Changed `GRADES` array in `enrollments-select.tsx` from `["TK", "K", ...]` to `["PK", "K", ...]`

**Dashboard course card ordering:**
- Courses now display in proper grade order: PK, K, 1, 2, 3, 4, 5, 6
- Applied `gradeOrder` sorting in `src/app/(dashboard)/dashboard/page.tsx`

**Login page fixes:**
- Added password reset hint below Sign In button: "Forgot your password? Log in with a magic link and update your password in your profile area."
- Fixed login box and magic link confirmation box positioning with `pt-40` to clear fixed header

**Signup confirmation box:**
- Fixed signup confirmation box position with `paddingTop: '180px'` to clear fixed header

#### Mobile Responsive Layout
All pages now have mobile-responsive layouts using Tailwind's `md:` breakpoint (768px).

**Mobile section picker (bottom sheet):**
- Student lesson view (`/lessons/[id]`) and admin lesson editor now hide the sidebar on mobile
- Floating teal button at bottom-center opens a bottom sheet with section navigation
- Uses shadcn/ui `Sheet` component with `side="bottom"`
- `SheetTrigger` styles applied directly (not via `asChild` to avoid nested button issues)

**Student lesson view (`src/app/(dashboard)/lessons/[lessonId]/page.tsx`):**
- Header: Image 30% width with square proportions on mobile (`w-[30%] h-[30vw]`), full 250px on desktop
- Columns stack vertically on mobile, horizontal on desktop (`flex-col md:flex-row`)
- Sidebar hidden on mobile (`hidden md:block`)

**Teacher course view (`src/app/(dashboard)/dashboard/courses/[courseId]/course-client.tsx`):**
- Same header stacking as lesson view
- Image: `w-[30%] h-[30vw]` mobile, `w-[250px] h-[250px]` desktop

**Admin lesson editor (`src/app/(dashboard)/admin/courses/[id]/lessons/[lessonId]/page-client.tsx`):**
- Sticky header stacks vertically on mobile
- Left links (Back to Course | View Lesson) stack vertically
- Right buttons wrap and Delete button hidden on mobile (`hidden md:inline-flex`)
- Sidebar hidden on mobile (`hidden md:block`)

**Admin course edit (`src/app/(dashboard)/admin/courses/[id]/page.tsx`):**
- Image, title, and action buttons all stack vertically on mobile
- Image: `w-[30%] aspect-square` on mobile, `sm:w-20 sm:h-20` on desktop
- Uses `InlineDeleteButton` client component for mobile (inline confirm dialog)
- Edit form fields stack and wrap on mobile

#### Bypass Code System (Password Reset for Users Who Can't Receive Emails)
Admin tool for users who cannot receive magic link or password reset emails.

**Database tables:**
- `bypass_codes` - Individual bypass codes tied to specific emails
- `universal_tokens` - Single universal token that works with any valid email

**Bypass codes:**
- Code format: `PR-YYYY-XXXX` (4 random chars after year)
- Tied to specific email address
- 48 hour expiration
- Single use (marked as used after password reset)
- 100 codes per admin per day limit

**Universal token:**
- Same format as bypass codes (indistinguishable)
- Works with ANY valid email in the system
- Unlimited uses
- Stored separately in `universal_tokens` table
- Admin can regenerate (invalidates old) or delete

**API endpoints:**
- `GET /api/admin/bypass-codes` - List all codes and universal token
- `POST /api/admin/bypass-codes` - Generate code (body: `{email}`) or universal token (body: `{universal: true}`)
- `DELETE /api/admin/bypass-codes` - Delete universal token
- `POST /api/bypass/reset` - Reset password with code (validates universal or regular code)

**Key files:**
- `src/lib/bypass-utils.ts` - Code generation and validation helpers
- `src/app/api/admin/bypass-codes/route.ts` - Admin endpoints
- `src/app/api/bypass/reset/route.ts` - Public reset endpoint
- `src/app/(dashboard)/admin/user-access/page.tsx` - Admin UI
- `src/app/bypass/page.tsx` - Public password reset page

**SQL migration:**
```sql
CREATE TABLE IF NOT EXISTS public.bypass_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.universal_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);
```

**Workflow:**
1. Admin goes to `/admin/user-access`
2. For universal: Click "Generate Universal Token" → copy and share with all users
3. For specific user: Enter email → click "Generate Code" → share with that user
4. Users go to `/bypass`, enter email + code + new password
5. Universal token: Any email with account works; Regular code: Email must match

#### Teacher Activity Analytics
Admin tool for tracking teacher engagement and site usage at `/admin/analytics`.

**Database table:**
- `user_activity_log` - Tracks user actions (login, view_lesson, view_course)

**Tracked actions:**
- `login` - Recorded in auth callback when user signs in
- `view_lesson` - Recorded when teacher views a lesson page
- `view_course` - Recorded when teacher views a course page

**API endpoint:**
- `GET /api/analytics/teacher-activity` - Returns aggregated activity metrics
  - Query params: `days` (7/30/90), `sort`, `order`, `limit`, `offset`
  - Returns: summary stats + per-teacher metrics (sortable, paginated)

**Summary metrics:**
- `totalTeachers` - Total number of teachers
- `activeLast7Days` / `activeLast30Days` - Teachers with any activity in period
- `avgDaysActivePerWeek` - Average unique days active (for active teachers)
- `dailyActiveRate` - Percentage of teachers active today
- `mostActiveDay` - Most common day of week for activity (aggregate)

**Per-teacher metrics:**
- `days_active_last_7` / `days_active_last_30` - Unique days with activity
- `logins_7d` / `logins_30d` - Number of logins
- `lessons_viewed_7d` / `lessons_viewed_30d` - Number of lesson pages visited
- `courses_viewed_7d` / `courses_viewed_30d` - Number of course pages visited
- `total_actions_7d` / `total_actions_30d` - Sum of all actions
- `last_active` - Timestamp of most recent activity
- `is_daily_active` - Had activity today
- `is_weekly_active` - Active 4+ days in last 7 days

**UI features:**
- Summary cards: Total Teachers, Active (7d/30d), Avg Days/Week, Daily Active Rate, Most Active Day
- Sortable table with columns: Name, Days Active, Logins, Lessons Viewed, Courses Viewed, Total Actions, Last Active, Status
- Date range filter (7d/30d/90d)
- Status badges: Daily Active (green), Weekly Active (teal), Active (gray), Inactive (light gray)
- Pagination (25 per page)
- Link in admin dropdown menu

**Key files:**
- `supabase/migrations/022_teacher_activity_log.sql` - Database migration
- `src/app/api/analytics/teacher-activity/route.ts` - API endpoint
- `src/app/(dashboard)/admin/analytics/page.tsx` - Admin page (server component)
- `src/app/(dashboard)/admin/analytics/page-client.tsx` - Admin page (client component)
- `src/app/api/activity/log/route.ts` - Activity logging endpoint
- `src/app/auth/callback/route.ts` - Login tracking added here
- `src/app/(dashboard)/lessons/[lessonId]/page.tsx` - Lesson view tracking
- `src/app/(dashboard)/dashboard/courses/[courseId]/page.tsx` - Course view tracking
- `src/components/user-menu.tsx` - Analytics link in admin dropdown

#### AI Chat Assistant
Feature for exploring lesson content and answering questions about music/dance/theatre education.

**Widget Access**: Restricted to specific users only:
- `ron@myherocreative.com`
- `emili@betterhumanseducation.com`

**API Route**: `POST /api/chat`
- Accepts: `{ message, scope?, lessonId?, courseId?, conversationHistory?, searchQuery?, page?, pageSize? }`
- Returns: `{ response: string, links: [], results: SearchResult[], totalResults?, hasMore? }`

**Widget UI** (`src/components/ai-chat-widget.tsx`):
- **Two modes**: "Ask" (chat with AI) and "Search Content" (explicit keyword search)
- **Search Content tab** has scope selector: Lesson, Course, Global
- **Course dropdown** shows when scope is "Course" (defaults to current course)
- **Results panel**: Shows paginated results with "Load More" button
- **Results styling**: Match Find & Replace - Lesson # - Course - Grade - Section with highlighted snippet
- **Result links**: Point to teacher lesson view (`/lessons/{id}`) NOT admin
- **Chat history**: Persists in localStorage (max 50 messages), cleared on "Clear chat"
- **Back to Top button**: Moved to bottom-left on lesson pages to avoid overlap with widget

**Keyword Search** (via Search Content tab):
- Uses `findMatchesInContent()` from `html-utils.ts` (same as Find & Replace)
- Searches all 15 lesson content fields
- Case-insensitive substring matching across HTML content
- Results capped at 10 per page with pagination

**Smart Query Detection**:
1. **Course list queries** (`isCourseListQuery`): "list my courses", "show courses", etc.
   - Queries courses table directly, filtered by user enrollments
   - Returns formatted list grouped by discipline/grade

2. **Standard queries** (`isStandardQuery`): "Anchor Standard X", "VAPA standard", "NCAS standard"
   - Auto-searches VAPA and NCAS text blocks specifically
   - Extracts "Anchor Standard N" as exact phrase (not generic "Standard N")
   - Returns results with "Found X references across Y lessons" message

3. **General AI questions**: Falls through to Anthropic Claude for music/dance/theatre education questions

**Response formatting**:
- Search results show: Course, Grade, Lesson #, Section label, snippet with `<mark>` highlighting
- Uses `dangerouslySetInnerHTML` for snippet rendering
- CSS for `<mark>`: yellow background (#fef08a)

**Files**:
- `src/app/api/chat/route.ts` - API endpoint with query detection and search
- `src/components/ai-chat-widget.tsx` - Chat widget UI with two modes
- `src/components/chat-context.tsx` - React context for page context (lessonId/courseId)
- `src/components/set-chat-context.tsx` - Sets context on lesson/course pages
- `src/app/(dashboard)/layout.tsx` - Conditionally renders widget for authorized users
- `src/app/globals.css` - Added `mark { background-color: #fef08a; }` for highlighting

**Environment Variables**:
- `ANTHROPIC_API_KEY` - Anthropic API key (required for AI responses)

#### Lesson Version Control (AI-Powered)
Feature allowing teachers to create/modify lessons via AI chat and save versions.

**Access**: Restricted to admin users only (`ron@myherocreative.com`, `emili@betterhumanseducation.com`)

**Database tables**:
- `lesson_versions` - Stores AI-modified lesson content with version metadata
- `lesson_version_pdf_usage` - Tracks weekly PDF generation limits per user

**Version data model**:
- `id` - UUID primary key
- `lesson_id` - References lessons table
- `version_number` - Auto-incremented per lesson (1, 2, 3)
- `version_name` - Optional custom name
- `content` - JSONB with field names as keys, each containing `{ html: string, original_length: number }`
- `modification_reason` - Free-form text (optional)
- `created_by` - User ID who created the version
- `pdf_storage_path` - Supabase storage path for generated PDF
- `pdf_generated_at` - Timestamp of last PDF generation
- `is_approved` - Boolean flag
- `deleted_at` - Soft delete timestamp

**RLS Policies**:
- Users can CRUD their own versions only
- Admins can view all versions (read-only)
- Max 3 active versions per lesson (enforced by database trigger)

**Version ownership**:
- Versions are linked to the user who creates them via `created_by`
- Teachers can only see/manage their own versions
- Admins can view all versions but cannot edit/delete others' versions

**Flow**:
1. Teacher views lesson and opens AI Chat widget
2. Teacher asks AI to modify content (e.g., "Make this lesson 30 minutes shorter")
3. AI provides modification preview with `modifiedFields` array
4. Teacher clicks "Save as Version" button
5. SaveVersionDialog opens with name and reason fields
6. Version is saved with modified content merged from original

**Version PDF generation**:
- `POST /api/lessons/[lessonId]/versions/[versionId]/pdf` - Generate PDF for a version
- `GET /api/lessons/[lessonId]/versions/[versionId]/pdf` - View/download existing PDF
- Weekly limit: 20 PDFs per user (resets Monday)
- PDF includes original lesson title in header, version name in page 2 label

**Key files**:
- `src/lib/version-utils.ts` - Version utilities, constants, types
- `src/components/version-tab-bar.tsx` - Version list UI in lesson sidebar
- `src/components/version-tabs.tsx` - Version tabs for admin editor
- `src/components/version-preview.tsx` - Version content preview dialog
- `src/components/generate-pdf-dialog.tsx` - Version PDF generation dialog
- `src/components/save-version-dialog.tsx` - Save version dialog with name/reason
- `src/app/(dashboard)/lessons/[lessonId]/page.tsx` - Student lesson view with version support
- `src/app/api/lessons/[lessonId]/versions/route.ts` - GET/POST versions
- `src/app/api/lessons/[lessonId]/versions/[versionId]/route.ts` - GET/PATCH/DELETE single version
- `src/app/api/lessons/[lessonId]/versions/[versionId]/pdf/route.ts` - Version PDF generation
- `src/app/api/pdf-usage/route.ts` - Weekly PDF usage tracking
- `supabase/migrations/024_lesson_versions.sql` - Database migration

### Relevant Files
- `src/app/(dashboard)/admin/courses/[id]/page.tsx` - Course edit page with Spotify section
- `src/components/course-spotify-section.tsx` - Course-level Spotify modal and controls (includes SpotifyEmbed preview)
- `src/components/inline-delete-button.tsx` - Inline delete button for mobile (Client Component)
- `src/app/(dashboard)/admin/courses/[id]/lessons/[lessonId]/page.tsx` - Main lesson edit page with two-column layout and PDF tab
- `src/components/editor/lesson-editor.tsx` - TipTap editor with sticky toolbar
- `src/components/editor/extensions/spell-check.ts` - Spellcheck extension
- `src/components/editor/extensions/check-for-understanding.tsx` - CFU entity
- `src/components/editor/extensions/table-with-styles.ts` - Custom table with column widths
- `src/components/editor/extensions/image-with-options.ts` - Custom image with align/width
- `src/components/lesson-assets-panel.tsx` - Lesson assets management
- `src/components/spotify-embed.tsx` - Draggable Spotify playlist modal (lesson view)
- `src/components/youtube-dialog.tsx` - YouTube video popup modal (lesson content)
- `src/app/(dashboard)/lessons/[lessonId]/page.tsx` - Student/teacher view with SpotifyEmbed from course
  - Has floating teal "Back to Top" button at bottom right (appears after scrolling 500px)
- `src/app/(dashboard)/dashboard/courses/[courseId]/page.tsx` - Teacher course view with lessons table
  - Shows course image (250x250 teal box) and summary above lessons table
- `src/components/check-for-underunderstanding-modal.tsx` - CFU edit modal
- `src/app/(auth)/login/page.tsx` - Login page with password/magic link options
- `src/app/(auth)/signup/page.tsx` - Trial signup page
- `src/lib/html-utils.ts` - HTML parsing, text finding/replacing for Find & Replace
- `src/app/api/find-replace/route.ts` - Find & Replace API endpoints (GET search, PATCH replace)
- `src/app/api/lessons/[lessonId]/pdf/info/route.ts` - GET PDF metadata (exists, generated_at, file_size)
- `src/app/api/lessons/[lessonId]/pdf/route.ts` - GET PDF (view or download)
- `src/app/api/lessons/[lessonId]/pdf/generate/route.ts` - POST to generate PDF
- `src/app/api/lessons/[lessonId]/pdf/diagnostics/route.ts` - GET diagnostics for debugging
- `src/app/api/batch/pdf-regenerate/route.ts` - Start batch PDF regeneration (clears stuck jobs first, preserves history)
- `src/app/api/batch/current/route.ts` - Get current/last batch job status
- `src/app/api/batch/[jobId]/route.ts` - Get paginated results with PDF file size for batch job
- `src/app/api/batch/[jobId]/pending/route.ts` - Get pending lessons for resume
- `src/app/api/batch/[jobId]/results/route.ts` - Submit result for a lesson in batch
- `src/app/api/batch/[jobId]/retry-failed/route.ts` - Reset failed results to pending
- `src/app/api/batch/[jobId]/sync-counters/route.ts` - Re-sync job counters from database
- `src/app/api/batch/[jobId]/cancel/route.ts` - Cancel a running batch job
- `src/app/api/batch/clear-stuck/route.ts` - Clear stuck processing jobs
- `src/app/(dashboard)/admin/pdf-regenerate/page.tsx` - Admin batch PDF regeneration UI
- `pdf-service/` - External Puppeteer PDF generation microservice (see PDF Generation section)
- `src/components/find-replace-panel.tsx` - Find & Replace UI panel
- `src/app/(dashboard)/admin/analytics/page.tsx` - Teacher activity analytics page (server component)
- `src/app/(dashboard)/admin/analytics/page-client.tsx` - Teacher activity analytics page (client component)
- `src/app/api/analytics/teacher-activity/route.ts` - Teacher activity API endpoint
- `src/app/api/activity/log/route.ts` - Activity logging endpoint
- `src/app/api/chat/route.ts` - AI chat API endpoint with query detection and search
- `src/components/ai-chat-widget.tsx` - Chat widget UI with Ask and Search Content modes
- `src/components/chat-context.tsx` - React context for page context (lessonId/courseId)
- `src/components/set-chat-context.tsx` - Sets context on lesson/course pages

#### Public Homepage
Landing page at `/` with the following sections:
- `src/app/page.tsx` - Main page assembling all homepage sections
- `src/components/home/Header.tsx` - Fixed header with logo, About Us link, Sign In button (has `id="main-header"`)
- `src/components/home/HeroSection.tsx` - Full-screen hero with background image and overlay
- `src/components/home/ElementaryArtsSection.tsx` - Text left, image right, peach background
- `src/components/home/GradeLevelSection.tsx` - Two-column layout: title/text left, grade descriptions right
- `src/components/home/VideoSection.tsx` - Click-to-open video popup with native dialog element
- `src/components/home/UnlockSection.tsx` - Image left, text right with pricing info
- `src/components/home/CallToActionSection.tsx` - Contact info and Calendly CTA button
- `src/components/home/Footer.tsx` - Copyright with dynamic year
- `public/images/` - Local copies of homepage images (logo.png, hero-bg.jpg, kids-dancing.png, video-thumbnail.jpg, opportunities-image.png)

**MigrationNotice Component** (`src/components/home/MigrationNotice.tsx`):
- Dismissible banner above hero section notifying users of platform migration
- Dynamically positions itself below header using header's `offsetHeight` (listens for resize)
- X button dismisses the banner; floating info button appears to re-show it
- Uses CSS variables `--header-height` and `--banner-height` for content spacing
- Banner text includes magic link sign-in info and support email (opens in new tab)
