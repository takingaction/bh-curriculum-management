import { Node, mergeAttributes, NodeViewProps } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import { useRef } from "react";

function CheckForUnderstandingNodeView({ node, getPos }: NodeViewProps) {
  const lastClickRef = useRef(0);

  const { backgroundImage, pngImage, heading, content, alignment, width, cfuId } = node.attrs as {
    backgroundImage: string;
    pngImage: string;
    heading: string;
    content: string;
    alignment: string;
    width: string;
    cfuId: string;
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
      },
    }));
  };

  return (
    <NodeViewWrapper>
      <div
        data-check-for-understanding="true"
        data-cfu-id={cfuId || ""}
        className={cssClass}
        style={{
          backgroundImage: backgroundImage ? `url('${backgroundImage}')` : undefined,
          backgroundSize: "contain",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          borderRadius: "8px",
          padding: "30px",
          margin: "16px 0",
          minHeight: "150px",
          outline: "none",
          width: (node.attrs.width as string) || "50%",
          cursor: "pointer",
        }}
        onClick={handleClick}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={{ width: "25%", verticalAlign: "middle", padding: "8px", textAlign: "center" }}>
                {pngImage && (
                  <img src={pngImage} style={{ maxWidth: "100%", height: "auto" }} />
                )}
              </td>
              <td style={{ width: "75%", verticalAlign: "middle", textAlign: "left", padding: "8px" }}>
                {heading && (
                  <h4 style={{ margin: "0 0 8px 0", fontSize: "14px", fontWeight: "700", color: "#333" }}>
                    {heading}
                  </h4>
                )}
                {content && (
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#333" }}>{content}</p>
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
      },
      backgroundImage: {
        default: "",
      },
      pngImage: {
        default: "",
      },
      heading: {
        default: "",
      },
      content: {
        default: "",
      },
      alignment: {
        default: "center",
      },
      width: {
        default: "50%",
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-check-for-understanding]",
        getAttrs: (dom) => {
          const el = dom as HTMLElement;
          return {
            cfuId: el.getAttribute("cfuid") || el.getAttribute("data-cfu-id") || null,
            backgroundImage: el.getAttribute("backgroundimage") || "",
            pngImage: el.getAttribute("pngimage") || "",
            heading: el.getAttribute("heading") || "",
            content: el.getAttribute("content") || "",
            alignment: el.getAttribute("alignment") || "center",
            width: el.getAttribute("width") || "50%",
          };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const alignment = node.attrs.alignment || "center";
    const backgroundImage = node.attrs.backgroundImage || "";
    const pngImage = node.attrs.pngImage || "";
    const heading = node.attrs.heading || "";
    const content = node.attrs.content || "";
    const width = node.attrs.width || "50%";
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

    const childElements: any[] = [
      "table",
      { style: "width: 100%; border-collapse: collapse;" },
    ];

    const imageCell: any[] = [
      "td",
      { class: "cfu-image-cell", style: "width: 25%; vertical-align: middle; text-align: center; padding: 8px;" },
    ];
    if (pngImage) {
      imageCell.push(["img", { src: pngImage, style: "max-width: 100%; height: auto;" }]);
    }

    const textCell: any[] = [
      "td",
      { class: "cfu-text-cell", style: "width: 75%; vertical-align: middle; text-align: left; padding: 8px;" },
    ];
    if (heading) {
      textCell.push(["h4", { style: "margin: 0 0 8px 0; font-size: 18px; color: #333;" }, heading]);
    }
    if (content) {
      textCell.push(["p", { style: "margin: 0; color: #333;" }, content]);
    }

    childElements.push([
      "tr",
      imageCell,
      textCell,
    ]);

    return [
      "div",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-check-for-understanding": "true",
        "cfuid": cfuId,
        "data-cfu-id": cfuId,
        class: cssClass,
        style: `background-image: url('${backgroundImage}'); background-size: contain; background-position: center; background-repeat: no-repeat; padding: 20px; width: ${width};`,
      }),
      childElements,
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