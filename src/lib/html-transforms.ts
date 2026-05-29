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
  // Handle bare strong.anchor-standard (no p wrapper)
  result = result.replace(
    /<strong class="anchor-standard">([^<]*)<\/strong>/gi,
    '<h3 class="anchor-standard">$1</h3>'
  );

  // Handle p > strong.anchor-standard
  result = result.replace(
    /<p[^>]*><strong class="anchor-standard">([^<]*)<\/strong><\/p>/gi,
    '<h3 class="anchor-standard">$1</h3>'
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