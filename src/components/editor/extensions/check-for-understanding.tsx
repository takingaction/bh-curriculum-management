import { Node, mergeAttributes, NodeViewProps } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import { useRef } from "react";

function CheckForUnderstandingNodeView({ node, getPos }: NodeViewProps) {
  const lastClickRef = useRef(0);

  const { backgroundImage, pngImage, heading, content, alignment, width, cfuId, pngWidth } = node.attrs as {
    backgroundImage: string;
    pngImage: string;
    heading: string;
    content: string;
    alignment: string;
    width: string;
    cfuId: string;
    pngWidth: number;
  };

  const alignmentClasses: Record<string, string> = {
    "wrap-top-left": "cfu-wrap-top-left",
    "wrap-top-right": "cfu-wrap-top-right",
    "wrap-top-center": "cfu-wrap-top-center",
    "wrap-bottom-left": "cfu-wrap-bottom-left",
    "wrap-bottom-right": "cfu-wrap-bottom-right",
    "wrap-bottom-center": "cfu-wrap-bottom-center",
    "left": "cfu-left",
    "right": "cfu-right",
    "center": "cfu-center",
  };

  const cssClass = alignmentClasses[alignment] || "cfu-center";

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const now = Date.now();
    if (now - lastClickRef.current < 1000) return;
    lastClickRef.current = now;

    window.dispatchEvent(new CustomEvent("cfu-edit-modal", {
      detail: {
        cfuId: cfuId || null,
        backgroundImage,
        pngImage,
        heading,
        content,
        alignment,
        width: width || "50%",
        pngWidth: pngWidth || 100,
      },
    }));
  };

  return (
    <NodeViewWrapper>
      <div
        data-check-for-understanding="true"
        data-cfu-id={cfuId || ""}
        className={cssClass}
        contentEditable={false}
        style={{
          backgroundImage: backgroundImage ? `url("${backgroundImage}")` : undefined,
          backgroundSize: "100% 100%",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          borderRadius: "8px",
          padding: "3px 100px",
          margin: "16px 0",
          minHeight: "150px",
          outline: "none",
          width: (node.attrs.width as string) || "50%",
          cursor: "pointer",
          position: "relative",
          zIndex: 10,
          pointerEvents: "auto",
        }}
        onClick={handleClick}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={{ width: "25%", verticalAlign: "middle", padding: "8px", textAlign: "right" }}>
                {pngImage && (
                  <img src={pngImage} style={{ maxWidth: `${pngWidth || 100}%`, height: "auto", display: "block", marginLeft: "auto" }} />
                )}
              </td>
              <td style={{ width: "75%", verticalAlign: "middle", textAlign: "left", padding: "8px" }}>
                {heading && (
                  <h4 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#333" }}>
                    {heading}
                  </h4>
                )}
                {content && (
                  <p style={{ margin: "4px 0 0 0", fontSize: "16px", color: "#333" }}>{content}</p>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </NodeViewWrapper>
  );
}

export interface CheckForUnderstandingOptions {
  HTMLAttributes: Record<string, any>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    checkForUnderstanding: {
      insertCheckForUnderstanding: (attributes: {
        backgroundImage: string;
        pngImage: string;
        heading: string;
        content: string;
        alignment: string;
      }) => ReturnType;
    };
  }
}

export const CheckForUnderstanding = Node.create<CheckForUnderstandingOptions>({
  name: "checkForUnderstanding",

  group: "block",

  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      cfuId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-cfu-id") || element.getAttribute("cfuid") || null,
        renderHTML: (attributes) => ({ "data-cfu-id": attributes.cfuId }),
      },
      backgroundImage: {
        default: "",
        parseHTML: (element) => {
          const dataAttr = element.getAttribute("data-background-image");
          if (dataAttr) return dataAttr;
          const style = element.getAttribute("style") || "";
          const match = style.match(/background-image:\s*url\(["']?([^"']+)["']?\)/);
          return match ? match[1] : "";
        },
        renderHTML: (attributes) => ({ "data-background-image": attributes.backgroundImage }),
      },
      pngImage: {
        default: "",
        parseHTML: (element) => {
          const dataAttr = element.getAttribute("data-png-image");
          if (dataAttr) return dataAttr;
          const imgEl = element.querySelector("img");
          return imgEl ? imgEl.src : "";
        },
        renderHTML: (attributes) => ({ "data-png-image": attributes.pngImage }),
      },
      heading: {
        default: "",
        parseHTML: (element) => {
          const h4 = element.querySelector("h4");
          return h4 ? h4.textContent || "" : "";
        },
        renderHTML: () => ({}),
      },
      content: {
        default: "",
        parseHTML: (element) => {
          const p = element.querySelector("p");
          return p ? p.textContent || "" : "";
        },
        renderHTML: () => ({}),
      },
      alignment: {
        default: "center",
        parseHTML: (element) => element.getAttribute("alignment") || element.getAttribute("data-alignment") || "center",
        renderHTML: (attributes) => ({ "data-alignment": attributes.alignment }),
      },
      width: {
        default: "50%",
        parseHTML: (element) => {
          const style = element.getAttribute("style") || "";
          const match = style.match(/width:\s*(\d+%)/);
          return match ? match[1] : "50%";
        },
        renderHTML: () => ({}),
      },
      pngWidth: {
        default: 100,
        parseHTML: (element) => {
          const img = element.querySelector("img");
          if (!img) return 100;
          const style = img.getAttribute("style") || "";
          const match = style.match(/max-width:\s*(\d+)%/);
          return match ? parseInt(match[1]) : 100;
        },
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-check-for-understanding]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const alignment = node.attrs.alignment || "center";
    const backgroundImage = node.attrs.backgroundImage || "";
    const pngImage = node.attrs.pngImage || "";
    const heading = node.attrs.heading || "";
    const content = node.attrs.content || "";
    const width = node.attrs.width || "50%";
    const pngWidth = node.attrs.pngWidth || 100;
    const cfuId = node.attrs.cfuId || "";

    const alignmentClasses: Record<string, string> = {
      "wrap-top-left": "cfu-wrap-top-left",
      "wrap-top-right": "cfu-wrap-top-right",
      "wrap-top-center": "cfu-wrap-top-center",
      "wrap-bottom-left": "cfu-wrap-bottom-left",
      "wrap-bottom-right": "cfu-wrap-bottom-right",
      "wrap-bottom-center": "cfu-wrap-bottom-center",
      "left": "cfu-left",
      "right": "cfu-right",
      "center": "cfu-center",
    };

    const cssClass = alignmentClasses[alignment] || "cfu-center";

    const imageContent = pngImage ? (["img", { src: pngImage, style: `max-width: ${pngWidth}%; height: auto; display: block; margin-left: auto;` }] as const) : null;
    const headingContent = heading ? (["h4", { style: "margin: 0; font-size: 18px; font-weight: 700; color: #333;" }, heading] as const) : null;
    const contentContent = content ? (["p", { style: "margin: 0; color: #333;" }, content] as const) : null;

    const imageCell: any[] = ["td", { class: "cfu-image-cell", style: "width: 25%; vertical-align: middle; text-align: right; padding: 8px; border: none;" }];
    if (imageContent) imageCell.push(imageContent);

    const textCell: any[] = ["td", { class: "cfu-text-cell", style: "width: 75%; vertical-align: middle; text-align: left; padding: 8px; border: none;" }];
    if (headingContent) textCell.push(headingContent);
    if (contentContent) textCell.push(contentContent);

    return [
      "div",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-check-for-understanding": "true",
        class: cssClass,
        style: `background-image: url('${backgroundImage}'); background-size: 100% 100%; background-position: center; background-repeat: no-repeat; padding: 3px 60px; width: ${width};`,
      }),
      [
        "table",
        { style: "width: 100%; border-collapse: collapse; border: none;" },
        [
          "tr",
          imageCell,
          textCell,
        ],
      ],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CheckForUnderstandingNodeView);
  },

  addCommands() {
    return {
      insertCheckForUnderstanding:
        (attributes) =>
        ({ chain }) => {
          return chain().insertContent({ type: this.name, attrs: attributes }).run();
        },
    };
  },
});
