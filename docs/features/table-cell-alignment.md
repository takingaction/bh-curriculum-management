# Feature: Table Cell Content Alignment

## Status
**Implemented**

## Overview
Added ability to align content within table cells (left, center, right) independently from table positioning.

## Files Created
- `src/components/editor/extensions/table-header-with-width.ts` - TableHeader extension with alignment attribute
- `src/components/editor/extensions/table-cell-with-width.ts` - TableCell extension with alignment attribute

## Files Modified
- `src/components/editor/lesson-editor.tsx`
  - Imported `TableHeaderWithWidth` instead of `TableHeader`
  - Added `cellAlignment` state
  - Added `updateCellAlignment()` function using TipTap's `setCellAttribute` command
  - Added "Cell Align:" buttons in the table toolbar
  - Updated `syncTableState()` and `forceSyncTableState()` to track cell alignment and sync toolbar

## Toolbar Layout
```
Align: [L] [C] [R]  |  Cell Align: [L] [C] [R]  |  Col Width: [__]%  |  Lesson Grid: [x]
```

- **Align:** - Controls table position on page (left/center/right)
- **Cell Align:** - Controls content alignment within a cell (left/center/right)

## Usage
1. Place cursor inside a table cell
2. Click "Cell Align:" button (L, C, or R) to change content alignment within that cell
3. The toolbar button for the current alignment will be highlighted

## Implementation Details

### TipTap Command
```typescript
editor.chain().focus().setCellAttribute('alignment', alignment).run()
```

### Cell Alignment Detection
When cursor moves between cells, `syncTableState()` and `forceSyncTableState()` read the cell's `alignment` attribute and update the `cellAlignment` state to highlight the correct toolbar button.

### Default Alignment
New cells default to "left" alignment.
