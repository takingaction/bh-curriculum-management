export function transformHtml(html: string): string {
  let result = html;

  // 1. Convert H5 class paragraphs to strong
  result = result.replace(/<p class="[^"]*[""]?H5[""]?"[^>]*>([\s\S]*?)<\/p>/g, "<p><strong>$1</strong></p>");

  // 2. Flatten nested strong/em tags
  result = result
    .replace(/<strong>\s*<strong>/g, "<strong>")
    .replace(/<\/strong>\s*<\/strong>/g, "</strong>")
    .replace(/<em>\s*<em>/g, "<em>")
    .replace(/<\/em>\s*<\/em>/g, "</em>");

  // 3. Convert VAPA/NCAS anchor standards to h3 with anchor-standard class
  // Matches headings containing "Anchor Standard" (case insensitive)
  result = result.replace(
    /<p(\s+[^>]*)?><strong>([^<]*Anchor Standard[^<]*)<\/strong><\/p>/gi,
    '<h3$1 class="anchor-standard">$2</h3>'
  );

  // 4. Convert all remaining bold headings to h3 (preserving style attributes)
  result = result.replace(
    /<p(\s+[^>]*)?><strong>(?!.* — )(.{1,60}?)<\/strong><\/p>/g,
    '<h3$1>$2</h3>'
  );

  // 5. Clean up whitespace
  result = result
    .replace(/>\s+</g, "><")
    .replace(/\s{2,}/g, " ");

  return result;
}

export function extractImagePaths(html: string): string[] {
  const imgRegex = /<img[^>]+src="([^"]+)"/g;
  const paths: string[] = [];
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    paths.push(match[1]);
  }
  return paths;
}