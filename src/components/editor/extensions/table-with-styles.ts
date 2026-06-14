import { Table } from "@tiptap/extension-table";

export const TableWithStyles = Table.configure({
  resizable: true,
  cellMinWidth: 0,
});

export const TableWithStylesExtension = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: "100%",
        parseHTML: (element) => {
          return element.getAttribute("data-width") ||
            element.style.width ||
            "100%";
        },
        renderHTML: (attributes) => {
          return {
            "data-width": attributes.width,
          };
        },
      },
      alignment: {
        default: "center",
        parseHTML: (element) => {
          return element.getAttribute("data-alignment") ||
            (element.style.marginLeft === "0" ? "left" :
             element.style.marginRight === "0" ? "right" : "center");
        },
        renderHTML: (attributes) => {
          return {
            "data-alignment": attributes.alignment,
          };
        },
      },
      showGrid: {
        default: true,
        parseHTML: (element) => {
          const attr = element.getAttribute("data-show-grid");
          return attr === null || attr === "true";
        },
        renderHTML: (attributes) => {
          return {
            "data-show-grid": attributes.showGrid ? "true" : "false",
          };
        },
      },
      columnWidths: {
        default: null,
        parseHTML: (element) => {
          const colgroup = element.querySelector("colgroup");
          if (colgroup) {
            const cols = colgroup.querySelectorAll("col");
            return Array.from(cols).map(col => col.style.width || "0%");
          }
          return null;
        },
        renderHTML: (attributes) => {
          return {
            "data-column-widths": attributes.columnWidths ? attributes.columnWidths.join(",") : "",
          };
        },
      },
    };
  },

  renderHTML({ node, HTMLAttributes }) {
    const width = node.attrs.width || "100%";
    const alignment = node.attrs.alignment || "center";
    const showGrid = node.attrs.showGrid !== false;
    const marginLeft = alignment === "left" ? "0" : "auto";
    const marginRight = alignment === "right" ? "0" : "auto";
    const columnWidths = node.attrs.columnWidths;

    const cols: any[] = [];
    if (columnWidths && columnWidths.length > 0) {
      columnWidths.forEach((w: string) => {
        cols.push(["col", { style: `width: ${w};` }]);
      });
    }

    const colgroup: any = ["colgroup", {}, ...cols];

    return [
      "table",
      {
        ...HTMLAttributes,
        "data-width": width,
        "data-alignment": alignment,
        "data-show-grid": showGrid ? "true" : "false",
        style: `width: ${width}; margin-left: ${marginLeft}; margin-right: ${marginRight}; table-layout: fixed;`,
      },
      colgroup,
      ["tbody", 0],
    ];
  },
});