export function transformHtml(html: string): string {
  return html
    .replace(/<p class="[^"]*[""]?H5[""]?"[^>]*>([\s\S]*?)<\/p>/g, "<p><strong>$1</strong></p>")
    .replace(/>\s+</g, "><")
    .replace(/\s{2,}/g, " ");
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