"use client";

import { mergeAttributes } from "@tiptap/core";
import Image from "@tiptap/extension-image";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    imageWithOptions: {
      setImageAlign: (align: "left" | "center" | "right") => ReturnType;
      setImageWidth: (widthPercent: number) => ReturnType;
      deleteImage: () => ReturnType;
    };
  }
}

export const ImageWithOptions = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      align: {
        default: "left",
        parseHTML: (element) => {
          const style = element.getAttribute("style") || "";
          if (style.includes("display: block") && style.includes("margin-left: auto") && style.includes("margin-right: auto")) return "center";
          if (style.includes("float: right") || style.includes("float:right")) return "right";
          return "left";
        },
        renderHTML: (attributes) => {
          if (attributes.align === "center") {
            return { style: "display: block; margin-left: auto; margin-right: auto;" };
          }
          if (attributes.align === "right") {
            return { style: "float: right;" };
          }
          return {};
        },
      },
      widthPercent: {
        default: 100,
        parseHTML: (element) => {
          const style = element.getAttribute("style") || "";
          const match = style.match(/width:\s*(\d+)%/);
          return match ? parseInt(match[1]) : 100;
        },
        renderHTML: (attributes) => {
          return { style: `width: ${attributes.widthPercent}%;` };
        },
      },
    };
  },

  addCommands() {
    return {
      setImageAlign:
        (align) =>
        ({ commands }) => {
          return commands.updateAttributes("image", { align });
        },
      setImageWidth:
        (widthPercent) =>
        ({ commands }) => {
          return commands.updateAttributes("image", { widthPercent });
        },
      deleteImage:
        () =>
        ({ commands }) => {
          return commands.deleteNode("image");
        },
    };
  },
});