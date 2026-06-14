"use client";

import { mergeAttributes } from "@tiptap/core";
import Image from "@tiptap/extension-image";

export interface ImageWithOptionsOptions {
  HTMLAttributes: Record<string, any>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    imageWithOptions: {
      setImageAlign: (align: "left" | "center" | "right") => ReturnType;
      setImageWidth: (widthPercent: number) => ReturnType;
    };
  }
}

export const ImageWithOptions = Image.extend<ImageWithOptionsOptions>({
  addAttributes() {
    return {
      ...this.parent?.(),
      align: {
        default: "left",
        parseHTML: (element) => {
          const style = element.getAttribute("style") || "";
          if (style.includes("float: center") || style.includes("float:center")) return "center";
          if (style.includes("float: right") || style.includes("float:right")) return "right";
          return "left";
        },
        renderHTML: (attributes) => {
          if (attributes.align === "left") return {};
          return { style: `float: ${attributes.align};` };
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
          if (attributes.widthPercent === 100) return {};
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
    };
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "img",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-align": HTMLAttributes.align,
        "data-width-percent": HTMLAttributes.widthPercent,
      }),
    ];
  },
});