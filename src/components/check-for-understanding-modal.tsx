"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";

interface CFUAsset {
  id: string;
  name: string;
  image_url: string;
  asset_type: "background" | "png";
}

interface CheckForUnderstandingModalProps {
  open: boolean;
  onClose: () => void;
  onInsert: (attributes: {
    backgroundImage: string;
    pngImage: string;
    heading: string;
    content: string;
    alignment: string;
    width: string;
  }) => void;
  initialAttributes?: {
    cfuId?: string | null;
    backgroundImage: string;
    pngImage: string;
    heading: string;
    content: string;
    alignment: string;
    width: string;
  } | null;
  isEditing?: boolean;
}

const POSITIONS = [
  { value: "wrap-top-left", label: "↖" },
  { value: "wrap-top-center", label: "↑" },
  { value: "wrap-top-right", label: "↗" },
  { value: "left", label: "←" },
  { value: "center", label: "•" },
  { value: "right", label: "→" },
  { value: "wrap-bottom-left", label: "↙" },
  { value: "wrap-bottom-center", label: "↓" },
  { value: "wrap-bottom-right", label: "↘" },
];

export function CheckForUnderstandingModal({
  open,
  onClose,
  onInsert,
  initialAttributes,
  isEditing,
}: CheckForUnderstandingModalProps) {
  const [assets, setAssets] = useState<CFUAsset[]>([]);
  const [bg, setBg] = useState("");
  const [png, setPng] = useState("");
  const [heading, setHeading] = useState("");
  const [content, setContent] = useState("");
  const [alignment, setAlignment] = useState("center");
  const [width, setWidth] = useState("50%");
  const [hasCfuId, setHasCfuId] = useState(false);

  const onCloseRef = useRef(onClose);
  const onInsertRef = useRef(onInsert);

  onCloseRef.current = onClose;
  onInsertRef.current = onInsert;

  useEffect(() => {
    if (open && assets.length === 0) {
      fetch("/api/cfu-assets")
        .then(res => res.json())
        .then(data => {
          if (data.assets) setAssets(data.assets);
        })
        .catch(console.error);
    }
  }, [open, assets.length]);

  useEffect(() => {
    if (open) {
if (initialAttributes) {
        setBg(initialAttributes.backgroundImage || "");
        setPng(initialAttributes.pngImage || "");
        setHeading(initialAttributes.heading || "");
        setContent(initialAttributes.content || "");
        setAlignment(initialAttributes.alignment || "center");
        setWidth(initialAttributes.width || "50%");
        setHasCfuId(!!initialAttributes.cfuId);
      } else {
        setBg("");
        setPng("");
        setHeading("");
        setContent("");
        setAlignment("center");
        setWidth("50%");
        setHasCfuId(false);
      }
    }
  }, [open, initialAttributes]);

  const handleInsert = () => {
    const attrs = { backgroundImage: bg, pngImage: png, heading, content, alignment, width };
    onInsertRef.current?.(attrs);
    onCloseRef.current?.();
  };

  const handleUpdate = () => {
    console.log("handleUpdate called, hasCfuId:", hasCfuId, "bg:", bg ? "set" : "empty");
    if (!hasCfuId) {
      alert("No cfuId - cannot update. Please delete and re-insert this CFU.");
      return;
    }
    const attrs = { backgroundImage: bg, pngImage: png, heading, content, alignment, width };
    console.log("handleUpdate calling onInsertRef with:", attrs);
    onInsertRef.current?.(attrs);
    console.log("handleUpdate calling onCloseRef");
    onCloseRef.current?.();
  };

  const backgrounds = assets.filter(a => a.asset_type === "background");
  const pngs = assets.filter(a => a.asset_type === "png");

  if (!open) return null;

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={(e) => { if (e.target === e.currentTarget) onCloseRef.current?.(); }}
    >
      <div style={{ background: "white", borderRadius: 12, padding: 24, width: "90%", maxWidth: 500, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h2 style={{ margin: 0 }}>Check for Understanding</h2>
            {isEditing && !hasCfuId && (
              <span style={{ background: "#ef4444", color: "white", padding: "2px 8px", borderRadius: 4, fontSize: 12 }}>
                No ID - cannot update
              </span>
            )}
          </div>
          <button onClick={onCloseRef.current} style={{ padding: 4, border: "none", background: "transparent", cursor: "pointer" }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <Label>Background</Label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              {backgrounds.map(a => (
                <div key={a.id} onClick={() => setBg(a.image_url)} style={{ cursor: "pointer", border: bg === a.image_url ? "3px solid #0d7377" : "3px solid transparent", borderRadius: 8, overflow: "hidden" }}>
                  <img src={a.image_url} alt={a.name} style={{ width: 60, height: 60, objectFit: "cover" }} />
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label>PNG Image</Label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              {pngs.map(a => (
                <div key={a.id} onClick={() => setPng(a.image_url)} style={{ cursor: "pointer", border: png === a.image_url ? "3px solid #0d7377" : "3px solid transparent", borderRadius: 8, overflow: "hidden", background: "repeating-conic-gradient(#ccc 0% 25%, white 0% 50%) 50% / 10px 10px" }}>
                  <img src={a.image_url} alt={a.name} style={{ width: 60, height: 60, objectFit: "contain" }} />
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label>Heading</Label>
            <Input value={heading} onChange={e => setHeading(e.target.value)} style={{ marginTop: 4 }} />
          </div>

          <div>
            <Label>Content</Label>
            <textarea value={content} onChange={e => setContent(e.target.value)} rows={3} style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 6, marginTop: 4 }} />
          </div>

          <div>
            <Label>Width</Label>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
              <Input type="number" min={10} max={100} value={parseInt(width) || 50} onChange={e => setWidth(e.target.value + "%")} style={{ width: 80 }} />
              <span>%</span>
            </div>
          </div>

          <div>
            <Label>Position</Label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4, marginTop: 4 }}>
              {POSITIONS.map(p => (
                <button type="button" key={p.value} onClick={() => setAlignment(p.value)} style={{ padding: 8, border: alignment === p.value ? "2px solid #0d7377" : "1px solid #ccc", borderRadius: 4, background: alignment === p.value ? "#0d7377" : "white", color: alignment === p.value ? "white" : "black", cursor: "pointer" }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 24 }}>
          <button type="button" onClick={onCloseRef.current} style={{ padding: "8px 16px", border: "1px solid #ccc", borderRadius: 6, background: "white", cursor: "pointer" }}>
            Cancel
          </button>
          {!isEditing ? (
            <button type="button" onClick={handleInsert} disabled={!bg} style={{ padding: "8px 16px", border: "none", borderRadius: 6, background: bg ? "#0d7377" : "#ccc", color: "white", cursor: bg ? "pointer" : "not-allowed" }}>
              Insert
            </button>
          ) : (
            <button type="button" onClick={handleUpdate} disabled={!bg || !hasCfuId} style={{ padding: "8px 16px", border: "none", borderRadius: 6, background: (bg && hasCfuId) ? "#0d7377" : "#ccc", color: "white", cursor: (bg && hasCfuId) ? "pointer" : "not-allowed" }}>
              Update
            </button>
          )}
        </div>
      </div>
    </div>
  );
}