import { TableCell } from "@tiptap/extension-table-cell";

export const TableCellWithWidth = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => {
          return element.getAttribute("width") || null;
        },
        renderHTML: (attributes) => {
          if (attributes.width) {
            return { width: attributes.width };
          }
          return {};
        },
      },
    };
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