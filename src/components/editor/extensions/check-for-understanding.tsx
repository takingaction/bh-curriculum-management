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
          backgroundImage: backgroundImage ? `url('${backgroundImage}')` : undefined,
          backgroundSize: "contain",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          borderRadius: "8px",
          padding: "30px 100px",
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
      pngWidth: {
        default: 100,
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
            pngWidth: parseInt(el.getAttribute("pngwidth") || "100") || 100,
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

    const childElements: any[] = [
      "table",
      { style: "width: 100%; border-collapse: collapse;" },
    ];

    const imageCell: any[] = [
      "td",
      { class: "cfu-image-cell", style: "width: 25%; vertical-align: middle; text-align: right; padding: 8px;" },
    ];
    if (pngImage) {
      imageCell.push(["img", { src: pngImage, style: `max-width: ${pngWidth}%; height: auto; display: block; margin-left: auto;` }]);
    }

    const textCell: any[] = [
      "td",
      { class: "cfu-text-cell", style: "width: 75%; vertical-align: middle; text-align: left; padding: 8px;" },
    ];
    if (heading) {
      textCell.push(["h4", { style: "margin: 0; font-size: 18px; font-weight: 700; color: #333;" }, heading]);
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
        style: `background-image: url('${backgroundImage}'); background-size: contain; background-position: center; background-repeat: no-repeat; padding: 40px 60px; width: ${width};`,
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