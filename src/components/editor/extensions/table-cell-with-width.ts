import { TableCell } from "@tiptap/extension-table-cell";

export const TableCellWithWidth = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
    };
  },
});