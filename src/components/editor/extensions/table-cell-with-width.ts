import { TableCell } from "@tiptap/extension-table-cell";

export const TableCellWithWidth = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => {
          const style = element.getAttribute("style") || "";
          const match = style.match(/width:\s*(\d+(?:\.\d+)?)%/);
          return match ? match[1] + "%" : null;
        },
        renderHTML: (attributes) => {
          if (attributes.width) {
            return { style: `width: ${attributes.width};` };
          }
          return {};
        },
      },
    };
  },

  renderHTML({ node, HTMLAttributes }) {
    const width = node.attrs.width;
    const style = width ? `width: ${width};` : "";
    
    return [
      "td",
      mergeAttributes(HTMLAttributes, {
        style: style + (HTMLAttributes.style || ""),
      }),
      0,
    ];
  },
});

function mergeAttributes(...objects: Record<string, any>[]) {
  const result: Record<string, any> = {};
  objects.forEach((obj) => {
    if (obj) {
      Object.keys(obj).forEach((key) => {
        if (key === "style") {
          result[key] = (result[key] || "") + (obj[key] || "");
        } else {
          result[key] = obj[key];
        }
      });
    }
  });
  return result;
}