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
- `profiles` - User profiles with role (admin/teacher)
- `courses` - Course information with discipline, grade, and spotify_embed_code
- `lessons` - Individual lessons with content, timing, presentation, etc. (Spotify is now on courses table)
- `teacher_assignments` - Links teachers to courses
- `lesson_assets` - Links assets to lessons with sort_order
- `cfu_assets` - Check for Understanding assets (admin only)

### RLS Policies
- Profiles: Users can read all, update only own profile
- Courses/Lessons: Admin full access, teachers can read assigned courses
- Teacher assignments tracked via `teacher_assignments` table

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
- **Search behavior**: Case-sensitive or case-insensitive substring match on text content (ignores HTML tags)
- **Replace behavior**: Exact case from replacement input (when Force exact case = ON), or preserves original case pattern (when OFF)
- **Results**: Shows Lesson Number, Course Name, Grade, Field Label, and match snippet. Grade helps distinguish duplicate course names across different grades.
- **View button**: Opens lesson editor directly to the matching section via `?section=<fieldName>` URL param
- **Key files**:
  - `src/lib/html-utils.ts` - HTML parsing, text finding/replacing helpers (includes `replaceTextPreserveCase` for case-preserving replace)
  - `src/app/api/find-replace/route.ts` - GET (search) and PATCH (replace) API endpoints
  - `src/components/find-replace-panel.tsx` - UI component with scope selector, case options, results display
- **API endpoints**:
  - GET `/api/find-replace?search=X&scope=lesson|course|global&lessonId=X&courseId=X&caseSensitive=true|false`
  - PATCH `/api/find-replace` - Body: `{ search, replace, scope, lessonId?, courseId?, caseSensitive, forceExactCase }`

### Environment Variables Required
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Relevant Files
- `src/app/(dashboard)/admin/courses/[id]/page.tsx` - Course edit page with Spotify section
- `src/components/course-spotify-section.tsx` - Course-level Spotify modal and controls
- `src/app/(dashboard)/admin/courses/[id]/lessons/[lessonId]/page.tsx` - Main lesson edit page with two-column layout
- `src/components/editor/lesson-editor.tsx` - TipTap editor with sticky toolbar
- `src/components/editor/extensions/spell-check.ts` - Spellcheck extension
- `src/components/editor/extensions/check-for-understanding.tsx` - CFU entity
- `src/components/editor/extensions/table-with-styles.ts` - Custom table with column widths
- `src/components/editor/extensions/image-with-options.ts` - Custom image with align/width
- `src/components/lesson-assets-panel.tsx` - Lesson assets management
- `src/components/spotify-embed.tsx` - Draggable Spotify playlist modal (lesson view)
- `src/app/(dashboard)/lessons/[lessonId]/page.tsx` - Student view with SpotifyEmbed from course
- `src/components/check-for-understanding-modal.tsx` - CFU edit modal
- `src/lib/html-utils.ts` - HTML parsing, text finding/replacing for Find & Replace
- `src/app/api/find-replace/route.ts` - Find & Replace API endpoints (GET search, PATCH replace)
- `src/components/find-replace-panel.tsx` - Find & Replace UI panel
