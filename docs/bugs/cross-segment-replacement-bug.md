# Bug: Cross-Segment Replacement Logic in Find & Replace

## Status
**FIXED** - Implementation complete

## Location
`src/lib/html-utils.ts`
- `replaceTextInHTML()` - lines 328-344 (fixed)
- `replaceTextPreserveCase()` - lines 434-464 (fixed)

## Problem Description

When a search term spans multiple text nodes in HTML (e.g., `<strong>wo</strong>lf`), the replacement string was distributed incorrectly across the segments.

### Example Scenario

**HTML:** `<p><strong>wo</strong>lf</p>`
**Search:** `wolf`
**Replace:** `sheep`

**Before Fix - Expected Result:** Incorrect distribution (e.g., "sh" + "eep" instead of "she" + "ep")
**After Fix - Expected Result:** `<p><strong>she</strong>ep</p>`

### Root Cause (Before Fix)

The code calculated `replaceStart` and `replaceEnd` based on the original match's segment lengths, not distributing the replacement string proportionally:

```javascript
const segmentLengths = match.segments.map(seg => seg.flatEnd - seg.flatStart + 1);
// segmentLengths = [2, 2] for "wo" and "lf"

const replaceStart = segmentLengths.slice(0, i).reduce((a, b) => a + b, 0);
const replaceEnd = replaceStart + segMatchedLength;  // BUG: Used original segment length
```

### Fix Applied

The replacement string is now distributed proportionally across segments:

```javascript
const numSegments = match.segments.length;
const replaceLength = replace.length;
const basePortion = Math.floor(replaceLength / numSegments);
const remainder = replaceLength % numSegments;

for (let i = numSegments - 1; i >= 0; i--) {
  const segPortion = i === numSegments - 1
    ? basePortion + remainder
    : basePortion;
  const replaceStart = i * basePortion + Math.min(i, remainder);
  const replaceEnd = replaceStart + segPortion;
  const segReplacement = replace.slice(replaceStart, replaceEnd);
  // ...
}
```

## Test Case

```javascript
// Input HTML with cross-segment match
const html = '<p><strong>wo</strong>lf</p>';
const search = 'wolf';
const replace = 'sheep';

const result = replaceTextInHTML(html, search, replace);
// Expected: '<p><strong>she</strong>ep</p>'
```

## Additional Fix: Case Preservation

For `replaceTextPreserveCase()`, the original text portion used for case matching is also now calculated proportionally:

```javascript
const origLength = match.originalText.length;
const origBasePortion = Math.floor(origLength / numSegments);
const origRemainder = origLength % numSegments;

const origSegPortion = i === numSegments - 1
  ? origBasePortion + origRemainder
  : origBasePortion;
const origStart = i * origBasePortion + Math.min(i, origRemainder);
const origEnd = origStart + origSegPortion;
const origPortion = match.originalText.slice(origStart, origEnd);

const segReplacement = applyCase(origPortion, segReplacementRaw);
```

This ensures case patterns are correctly preserved when replacing cross-segment matches.

## Verification

Run the following tests to verify the fix:

1. **Simple replacement (non-cross-segment):**
   ```javascript
   replaceTextInHTML('<p>wolf</p>', 'wolf', 'sheep');
   // Should return: '<p>sheep</p>'
   ```

2. **Cross-segment replacement with same length:**
   ```javascript
   replaceTextInHTML('<p><strong>wo</strong>lf</p>', 'wolf', 'sheep');
   // Should return: '<p><strong>she</strong>ep</p>'
   ```

3. **Cross-segment replacement with different length:**
   ```javascript
   replaceTextInHTML('<p><strong>wo</strong>lf</p>', 'wolf', 'cat');
   // Should return: '<p><strong>ca</strong>t</p>'
   ```

4. **Case preservation (replaceTextPreserveCase):**
   ```javascript
   replaceTextPreserveCase('<p><strong>WO</strong>LF</p>', 'wolf', 'cat');
   // Should return: '<p><strong>CA</strong>T</p>'
   ```
