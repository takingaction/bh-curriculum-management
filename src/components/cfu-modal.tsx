"use client";

import { useState, useEffect, useRef } from "react";

interface CFUModalState {
  open: boolean;
  onClose: () => void;
  onInsert: (attributes: any) => void;
  initialAttributes: any;
  isEditing: boolean;
}

let globalModalState: CFUModalState | null = null;
let forceUpdate: (() => void) | null = null;

export function openCFUModal(attrs: any) {
  if (globalModalState && forceUpdate) {
    globalModalState.open = true;
    globalModalState.initialAttributes = attrs;
    globalModalState.isEditing = true;
    forceUpdate();
  }
}

export function CheckForUnderstandingModal() {
  const [renderKey, setRenderKey] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [attrs, setAttrs] = useState<any>(null);
  const [assets, setAssets] = useState<any[]>([]);
  const [bg, setBg] = useState("");
  const [png, setPng] = useState("");
  const [heading, setHeading] = useState("");
  const [content, setContent] = useState("");
  const [alignment, setAlignment] = useState("center");
  const [width, setWidth] = useState("50%");

  useEffect(() => {
    forceUpdate = () => setRenderKey(k => k + 1);
    globalModalState = {
      open: false,
      onClose: () => {
        setIsOpen(false);
        globalModalState && (globalModalState.open = false);
      },
      onInsert: (newAttrs: any) => {
        console.log("CFU Modal: onInsert called with", newAttrs);
        if (globalModalState) {
          globalModalState.onInsert(newAttrs);
        }
      },
      initialAttributes: null,
      isEditing: false,
    };

    fetch("/api/cfu-assets")
      .then(r => r.json())
      .then(d => d.assets && setAssets(d.assets))
      .catch(console.error);

    return () => {
      globalModalState = null;
      forceUpdate = null;
    };
  }, []);

  useEffect(() => {
    if (isOpen && attrs) {
      setBg(attrs.backgroundImage || "");
      setPng(attrs.pngImage || "");
      setHeading(attrs.heading || "");
      setContent(attrs.content || "");
      setAlignment(attrs.alignment || "center");
      setWidth(attrs.width || "50%");
    }
  }, [isOpen, attrs]);

  if (!isOpen) return null;

  console.log("CFU Modal rendering, attrs:", attrs);

  const handleUpdate = () => {
    console.log("CFU Modal: handleUpdate called");
    const result = {
      backgroundImage: bg,
      pngImage: png,
      heading,
      content,
      alignment,
      width,
    };
    console.log("CFU Modal: calling onInsert with", result);
    globalModalState?.onInsert(result);
    globalModalState?.onClose();
  };

  const handleCancel = () => {
    console.log("CFU Modal: handleCancel called");
    globalModalState?.onClose();
  };

  const handleCloseClick = () => {
    console.log("CFU Modal: handleCloseClick called");
    globalModalState?.onClose();
  };

  const backgrounds = assets.filter((a: any) => a.asset_type === "background");
  const pngs = assets.filter((a: any) => a.asset_type === "png");

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 99999, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "white", borderRadius: 12, padding: 24, width: "90%", maxWidth: 500, maxHeight: "90vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>Check for Understanding</h2>
          <button onClick={handleCloseClick} style={{ padding: 4, border: "none", background: "transparent", cursor: "pointer" }}>
            ✕
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ fontWeight: "bold", display: "block", marginBottom: 4 }}>Background</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {backgrounds.map((a: any) => (
                <div key={a.id} onClick={() => { console.log("bg selected:", a.image_url); setBg(a.image_url); }} style={{ cursor: "pointer", border: bg === a.image_url ? "3px solid #0d7377" : "3px solid transparent", borderRadius: 8, padding: 2 }}>
                  <img src={a.image_url} alt={a.name} style={{ width: 60, height: 60, objectFit: "cover", display: "block" }} />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontWeight: "bold", display: "block", marginBottom: 4 }}>Heading</label>
            <input type="text" value={heading} onChange={e => setHeading(e.target.value)} style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 6, boxSizing: "border-box" }} />
          </div>

          <div>
            <label style={{ fontWeight: "bold", display: "block", marginBottom: 4 }}>Content</label>
            <textarea value={content} onChange={e => setContent(e.target.value)} rows={3} style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 6, boxSizing: "border-box" }} />
          </div>

          <div>
            <label style={{ fontWeight: "bold", display: "block", marginBottom: 4 }}>Width %</label>
            <input type="number" min={10} max={100} value={parseInt(width) || 50} onChange={e => setWidth(e.target.value + "%")} style={{ width: 80, padding: 8, border: "1px solid #ccc", borderRadius: 6 }} />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 24 }}>
          <button onClick={handleCancel} style={{ padding: "10px 20px", border: "1px solid #ccc", borderRadius: 6, background: "white", cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={handleUpdate} disabled={!bg} style={{ padding: "10px 20px", border: "none", borderRadius: 6, background: bg ? "#0d7377" : "#ccc", color: "white", cursor: bg ? "pointer" : "not-allowed" }}>
            Update
          </button>
        </div>
      </div>
    </div>
  );
}