import TurndownService from "turndown";

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
});

turndown.addRule("table", {
  filter: "table",
  replacement: (content) => {
    const rows = content.trim().split("\n");
    if (rows.length < 2) return content;
    const headerRow = rows[0];
    const dataRows = rows.slice(2);
    let md = headerRow.replace(/\|/g, " | ").trim() + "\n";
    md += headerRow.replace(/\|/g, "---").replace(/---/g, "---").trim() + "\n";
    dataRows.forEach((row) => {
      md += row.replace(/\|/g, " | ").trim() + "\n";
    });
    return "\n" + md + "\n";
  },
});

turndown.addRule("images", {
  filter: "img",
  replacement: (content, node) => {
    const img = node as HTMLImageElement;
    const alt = img.alt || "";
    const src = img.src || "";
    return `![${alt}](${src})`;
  },
});

export function htmlToMarkdown(html: string): string {
  if (!html) return "";
  return turndown.turndown(html);
}
