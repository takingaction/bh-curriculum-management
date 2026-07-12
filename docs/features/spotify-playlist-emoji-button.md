# Spotify Playlist Emoji Button

## Overview
Added a button in the TipTap editor toolbar that inserts a clickable emoji (ᯤ) into lesson content. When students click the emoji in the lesson view, it opens the course's Spotify playlist modal.

## Implementation

### Editor Toolbar Button
**File:** `src/components/editor/lesson-editor.tsx`

Added a 🎵 button after the "Upload" button that inserts:
```html
<a href="#spotify-playlist" class="spotify-playlist-link">ᯤ</a>
```

### CSS Styling
**File:** `src/app/globals.css`

Added Spotify green styling for the new link class:
```css
.ProseMirror a.spotify-playlist-link,
.lesson-content a.spotify-playlist-link {
  color: #1DB954 !important;
  text-decoration: none !important;
  cursor: pointer;
}
```

### Student View Click Handler
**File:** `src/app/(dashboard)/lessons/[lessonId]/page.tsx`

Updated the `renderContent` onClick handler to detect `spotify-playlist-link` clicks and call `setShowSpotify(true)`.

## Behavior

- **Admin**: Click the 🎵 button in the toolbar to insert the emoji into any lesson section
- **Student**: Click the (ᯤ) emoji anywhere in the lesson to open the Spotify playlist modal (same modal accessible via "Spotify Playlist" button in lesson header)
