export function transformHtml(html: string): string {
  let result = html
    .replace(/<p class="[^"]*[""]?H5[""]?"[^>]*>([\s\S]*?)<\/p>/g, "<p><strong>$1</strong></p>")
    .replace(/<p><strong>([A-Z\s]+)\s+—\s+/g, '<p><strong class="anchor-standard">$1 — ')
    .replace(/<p(\s+[^>]*)?><strong>(?!.* — )(.{1,60}?)<\/strong><\/p>/g, '<h3$1>$2</h3>')
    .replace(/<strong>\s*<strong>/g, "<strong>")
    .replace(/<\/strong>\s*<\/strong>/g, "</strong>")
    .replace(/<em>\s*<em>/g, "<em>")
    .replace(/<\/em>\s*<\/em>/g, "</em>")
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