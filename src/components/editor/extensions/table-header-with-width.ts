import { TableHeader } from "@tiptap/extension-table-header";

export const TableHeaderWithWidth = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      alignment: {
        default: "left",
        parseHTML: (element) => {
          return element.style.textAlign || "left";
        },
        renderHTML: (attributes) => {
          return {
            style: `text-align: ${attributes.alignment}`,
          };
        },
      },
    };
  },
});
