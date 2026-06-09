"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TableWithStyles, TableWithStylesExtension } from "./extensions/table-with-styles";
import { CheckForUnderstanding } from "./extensions/check-for-understanding";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { Paragraph } from "@tiptap/extension-paragraph";
import InvisibleCharacters, { HardBreakNode, ParagraphNode } from "@tiptap/extension-invisible-characters";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEffect, useRef, useState } from "react";
import { MediaLibrary } from "@/components/media-library";
import { ImageIcon, CodeIcon, EyeIcon, EyeOffIcon, LinkIcon, ChevronLeft, ChevronRight, Plus, Minus, AlignLeft, AlignCenter, AlignRight, Lightbulb } from "lucide-react";
import { TableInsertDialog } from "@/components/ui/table-insert-dialog";
import { SpellCheckExtension } from "./extensions/spell-check";
import { CheckForUnderstandingModal } from "@/components/check-for-understanding-modal";

const ParagraphWithStyle = Paragraph.extend({
  addAttributes() {
    return {
      style: {
        default: null,
        parseHTML: (element) => element.getAttribute("style"),
        renderHTML: (attributes) => {
          if (attributes.style) {
            return { style: attributes.style };
          }
          return {};
        },
      },
    };
  },
});

interface LessonEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  lessonId?: string;
  courseId?: string;
}

export function LessonEditor({ content, onChange, placeholder, lessonId, courseId }: LessonEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [sourceContent, setSourceContent] = useState(content);
  const [showTableGrid, setShowTableGrid] = useState(false);
  const [showInvisibles, setShowInvisibles] = useState(false);
  const [addWordModalOpen, setAddWordModalOpen] = useState(false);
  const [removeWordModalOpen, setRemoveWordModalOpen] = useState(false);
  const [cannotRemoveModalOpen, setCannotRemoveModalOpen] = useState(false);
  const [wordUnderCursor, setWordUnderCursor] = useState("");
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkNewWindow, setLinkNewWindow] = useState(false);
  const [showTableInsertDialog, setShowTableInsertDialog] = useState(false);
  const [tableWidth, setTableWidth] = useState(100);
  const [tableAlignment, setTableAlignment] = useState("center");
  const [tableContextKey, setTableContextKey] = useState(0);
  const [widthInputFocused, setWidthInputFocused] = useState(false);
  const [showCFUModal, setShowCFUModal] = useState(false);
  const [editingCFUAttrs, setEditingCFUAttrs] = useState<any>(null);
  const editingCFUAttrsRef = useRef<any>(null);
  const tableElementRef = useRef<HTMLElement | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
        paragraph: false,
        link: false,
      }),
      ParagraphWithStyle,
      TableWithStylesExtension,
      CheckForUnderstanding,
      TableRow,
      TableCell,
      TableHeader,
      Image,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: "noopener noreferrer",
        },
      }),
      SpellCheckExtension,
      InvisibleCharacters.configure({
        visible: false,
        builders: [new HardBreakNode(), new ParagraphNode()],
        injectCSS: true,
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          `prose max-w-none min-h-[150px] px-4 py-3 focus:outline-none border border-[#e5e5e0] rounded-lg overflow-hidden${showTableGrid ? " show-table-grid" : ""}`,
        spellcheck: "false",
      },
    },
  });

  const isInsideTable = () => {
    if (!editor) return false;
    const { selection } = editor.state;
    const { $from } = selection;
    for (let d = $from.depth; d > 0; d--) {
      const node = $from.node(d);
      if (node.type.name === "table") return true;
    }
    return false;
  };

  const syncTableState = () => {
    if (!editor) return;
    const { state } = editor;
    const { selection } = state;
    const $from = selection.$from;

    for (let depth = $from.depth; depth > 0; depth--) {
      const node = $from.node(depth);
      if (node.type.name === "table") {
        const attrs = node.attrs;
        const width = attrs.width || "100%";
        const alignment = attrs.alignment || "center";
        const numWidth = parseInt(width.replace("%", ""));
        if (numWidth >= 1 && numWidth <= 100) {
          setTableWidth(numWidth);
        } else {
          setTableWidth(100);
        }
        setTableAlignment(alignment);
        return;
      }
    }
  };

  const forceSyncTableState = () => {
    if (!editor) return;
    const { state } = editor;
    const { selection } = state;
    const $from = selection.$from;

    let tableNode = null;
    let tableDepth = 0;
    for (let depth = $from.depth; depth > 0; depth--) {
      const node = $from.node(depth);
      if (node.type.name === "table") {
        tableNode = node;
        tableDepth = depth;
        break;
      }
    }

    if (tableNode) {
      const pos = $from.before(tableDepth);
      const nodeAtPos = state.doc.nodeAt(pos);
      if (nodeAtPos) {
        const attrs = nodeAtPos.attrs;
        const width = attrs.width || "100%";
        const alignment = attrs.alignment || "center";
        const numWidth = parseInt(width.replace("%", ""));
        setTableWidth(numWidth >= 1 && numWidth <= 100 ? numWidth : 100);
        setTableAlignment(alignment);
      }
    }
  };

  useEffect(() => {
    if (!editor) return;
    const handleSelectionUpdate = () => {
      setTableContextKey(k => k + 1);
      if (isInsideTable()) {
        syncTableState();
      }
    };
    editor.on("selectionUpdate", handleSelectionUpdate);

    const handleTransaction = () => {
      if (isInsideTable()) {
        forceSyncTableState();
      }
    };
    editor.on("transaction", handleTransaction);

    setTimeout(() => {
      if (isInsideTable()) {
        syncTableState();
      }
    }, 100);

    return () => {
      editor.off("selectionUpdate", handleSelectionUpdate);
      editor.off("transaction", handleTransaction);
    };
  }, [editor]);

  useEffect(() => {
    let lastEventTime = 0;
    const handleCFUEditModal = (e: CustomEvent) => {
      const now = Date.now();
      if (now - lastEventTime < 2000) return;
      lastEventTime = now;
      console.log("Lesson Editor: setting attrs and opening modal", e.detail.backgroundImage);
      editingCFUAttrsRef.current = e.detail;
      setEditingCFUAttrs(e.detail);
      setShowCFUModal(true);
    };
    window.addEventListener("cfu-edit-modal", handleCFUEditModal as EventListener);
    return () => {
      window.removeEventListener("cfu-edit-modal", handleCFUEditModal as EventListener);
    };
  }, []);

  const getCurrentMarginLeft = () => {
    if (!editor) return 0;
    const { selection } = editor.state;
    const { $from } = selection;
    const node = $from.node();
    if (!node || node.type.name !== "paragraph") return 0;
    const style = node.attrs.style || "";
    const match = style.match(/margin-left:\s*(\d+)px/);
    return match ? parseInt(match[1]) : 0;
  };

  const setMarginLeft = (px: number) => {
    if (!editor) return;
    const style = px > 0 ? `margin-left: ${px}px` : "";
    editor.chain().focus().updateAttributes("paragraph", { style }).run();
  };

  const increaseIndent = () => {
    const current = getCurrentMarginLeft();
    if (current < 80) {
      setMarginLeft(current + 10);
    }
  };

  const decreaseIndent = () => {
    const current = getCurrentMarginLeft();
    if (current > 0) {
      setMarginLeft(current - 10);
    }
  };

  const insertTableWithOptions = (options: {
    cols: number;
    rows: number;
    width: string;
    alignment: string;
    withHeaderRow: boolean;
  }) => {
    if (!editor) return;
    const { cols, rows, width, alignment, withHeaderRow } = options;

    editor.chain().focus().insertTable({ rows, cols, withHeaderRow }).run();

    const widthValue = width.includes("%") ? width : `${width}%`;
    const { state } = editor;
    const { selection } = state;
    const $from = selection.$from;

    for (let depth = $from.depth; depth > 0; depth--) {
      const node = $from.node(depth);
      if (node.type.name === "table") {
        const pos = $from.before(depth);
        const tableNode = state.doc.nodeAt(pos);
        if (tableNode) {
          const newAttrs = { ...tableNode.attrs, width: widthValue, alignment };
          const tr = state.tr.setNodeMarkup(pos, undefined, newAttrs);
          editor.view.dispatch(tr);
        }
        break;
      }
    }
    setTableWidth(parseInt(widthValue) || 100);
    setTableAlignment(alignment);
    onChange(editor.getHTML());
  };

  const insertCheckForUnderstanding = (attributes: {
    backgroundImage: string;
    pngImage: string;
    heading: string;
    content: string;
    alignment: string;
    width: string;
  }) => {
    if (!editor) return;

    const originalAttrs = editingCFUAttrsRef.current;
    console.log("insertCheckForUnderstanding:", { originalAttrs, newAttrs: attributes });

    if (originalAttrs && originalAttrs.cfuId) {
      const { state } = editor;
      console.log("Searching for cfuId:", originalAttrs.cfuId);
      let foundPos = -1;
      let nodeCount = 0;
      let cfuCount = 0;
      state.doc.descendants((node, pos) => {
        nodeCount++;
        if (node.type.name === "checkForUnderstanding") {
          cfuCount++;
          console.log("CFU node at", pos, "cfuId:", JSON.stringify(node.attrs.cfuId), "searching for:", JSON.stringify(originalAttrs.cfuId));
          if (String(node.attrs.cfuId) === String(originalAttrs.cfuId)) {
            foundPos = pos;
          }
        }
        return true;
      });
      console.log("Total nodes checked:", nodeCount, "CFUs found:", cfuCount);

      if (foundPos >= 0) {
        console.log("Found CFU at pos", foundPos, "updating with", attributes);
        const tr = state.tr.setNodeMarkup(foundPos, undefined, { ...attributes, cfuId: originalAttrs.cfuId });
        editor.view.dispatch(tr);
      } else {
        console.log("CFU not found by cfuId, inserting new");
        editor.chain().focus().insertContent({ type: "checkForUnderstanding", attrs: attributes }).run();
      }
      editingCFUAttrsRef.current = null;
      setEditingCFUAttrs(null);
    } else if (originalAttrs && !originalAttrs.cfuId) {
      alert("This CFU has no unique ID. Please delete it and insert a new one.");
    } else {
      const newCfuId = Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
      console.log("No originalAttrs, inserting new CFU with cfuId:", newCfuId);
      editor.chain().focus().insertContent({ type: "checkForUnderstanding", attrs: { ...attributes, cfuId: newCfuId } }).run();
      editingCFUAttrsRef.current = null;
      setEditingCFUAttrs(null);
    }
    onChange(editor.getHTML());
  };

  const getTableElementFromSelection = (): HTMLElement | null => {
    if (!editor) return null;
    const { state } = editor;
    const { selection } = state;
    const { $from } = selection;
    for (let d = $from.depth; d > 0; d--) {
      if ($from.node(d).type.name === "table") {
        const pos = $from.start(d);
        const domNode = editor.view.nodeDOM(pos);
        if (domNode && domNode instanceof HTMLElement) {
          return domNode;
        }
        const tableEls = editor.view.dom.querySelectorAll("table");
        for (const tableEl of tableEls) {
          const bbox = tableEl.getBoundingClientRect();
          const editorRect = editor.view.dom.getBoundingClientRect();
          if (bbox.top >= editorRect.top && bbox.bottom <= editorRect.bottom) {
            return tableEl as HTMLElement;
          }
        }
        return null;
      }
    }
    return null;
  };

  const updateTableWidth = (width: number) => {
    if (!editor) return;
    const { state } = editor;
    const { selection } = state;
    const $from = selection.$from;

    for (let depth = $from.depth; depth > 0; depth--) {
      const node = $from.node(depth);
      if (node.type.name === "table") {
        const pos = $from.before(depth);
        const tableNode = state.doc.nodeAt(pos);
        if (tableNode) {
          const newAttrs = { ...tableNode.attrs, width: `${width}%` };
          const tr = state.tr.setNodeMarkup(pos, undefined, newAttrs);
          editor.view.dispatch(tr);
          setTableWidth(width);
          onChange(editor.getHTML());
        }
        break;
      }
    }
  };

  const updateTableAlignment = (alignment: string) => {
    if (!editor) return;
    const { state } = editor;
    const { selection } = state;
    const $from = selection.$from;

    for (let depth = $from.depth; depth > 0; depth--) {
      const node = $from.node(depth);
      if (node.type.name === "table") {
        const pos = $from.before(depth);
        const tableNode = state.doc.nodeAt(pos);
        if (tableNode) {
          const newAttrs = { ...tableNode.attrs, alignment };
          const tr = state.tr.setNodeMarkup(pos, undefined, newAttrs);
          editor.view.dispatch(tr);
          setTableAlignment(alignment);
          onChange(editor.getHTML());
        }
        break;
      }
    }
  };

  const getWordAtCursor = () => {
    if (!editor) return "";
    const { selection } = editor.state;
    const { $from, to } = selection;
    const text = $from.parent.textContent;
    if (!text) return "";

    const relativePos = $from.parentOffset;
    const textBefore = text.slice(0, relativePos);
    const textAfter = text.slice(relativePos);

    const wordBeforeMatch = textBefore.match(/[\p{L}\p{M}'-]+$/u);
    const wordAfterMatch = textAfter.match(/^[\p{L}\p{M}'-]+/u);

    const wordBefore = wordBeforeMatch ? wordBeforeMatch[0] : "";
    const wordAfter = wordAfterMatch ? wordAfterMatch[0] : "";

    return wordBefore + wordAfter;
  };

  const handleAddWordClick = () => {
    const word = getWordAtCursor();
    setWordUnderCursor(word);
    setAddWordModalOpen(true);
  };

  const handleRemoveWordClick = () => {
    const word = getWordAtCursor();
    setWordUnderCursor(word);
    const spellCheckStorage = editor?.storage as { spellCheck?: { isCustomWord: (word: string) => boolean } };
    const isCustom = spellCheckStorage?.spellCheck?.isCustomWord(word);
    if (isCustom) {
      setRemoveWordModalOpen(true);
    } else {
      setCannotRemoveModalOpen(true);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !lessonId || !courseId) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("lessonId", lessonId);
    formData.append("courseId", courseId);

    try {
      const res = await fetch("/api/upload/lesson-image", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.imageUrl) {
        editor?.chain().focus().setImage({ src: data.imageUrl, alt: data.fileName }).run();
      }
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  if (!editor) {
    return (
      <div className="border border-[#e5e5e0] rounded-lg min-h-[150px] bg-[#f5f5f0] animate-pulse" />
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1 border border-[#e5e5e0] rounded-lg p-2 bg-white">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`h-8 px-2 ${editor.isActive("bold") ? "bg-[#f5f5f0]" : ""}`}
        >
          <span className="font-bold">B</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`h-8 px-2 ${editor.isActive("italic") ? "bg-[#f5f5f0]" : ""}`}
        >
          <span className="italic">I</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`h-8 px-2 ${editor.isActive("strike") ? "bg-[#f5f5f0]" : ""}`}
        >
          <span className="line-through">S</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setLinkUrl("");
            setLinkNewWindow(false);
            if (editor.isActive("link")) {
              const attrs = editor.getAttributes("link");
              setLinkUrl(attrs.href || "");
              setLinkNewWindow(attrs.target === "_blank");
            }
            setLinkModalOpen(true);
          }}
          className={`h-8 px-2 ${editor.isActive("link") ? "bg-[#f5f5f0]" : ""}`}
          title="Insert Link"
        >
          <LinkIcon className="w-4 h-4" />
        </Button>

        <div className="w-px h-6 bg-[#e5e5e0] mx-1 self-center" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`h-8 px-2 ${editor.isActive("heading", { level: 2 }) ? "bg-[#f5f5f0]" : ""}`}
        >
          H2
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`h-8 px-2 ${editor.isActive("heading", { level: 3 }) ? "bg-[#f5f5f0]" : ""}`}
        >
          H3
        </Button>

        <div className="w-px h-6 bg-[#e5e5e0] mx-1 self-center" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`h-8 px-2 ${editor.isActive("bulletList") ? "bg-[#f5f5f0]" : ""}`}
        >
          •
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`h-8 px-2 ${editor.isActive("orderedList") ? "bg-[#f5f5f0]" : ""}`}
        >
          1.
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().sinkListItem("listItem").run()}
          className="h-8 px-1 text-gray-500"
          title="Increase List Level"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().liftListItem("listItem").run()}
          className="h-8 px-1 text-gray-500"
          title="Decrease List Level"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        <div className="w-px h-6 bg-[#e5e5e0] mx-1 self-center" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowTableInsertDialog(true)}
          className="h-8 px-2 text-sm"
        >
          Table
        </Button>

        <Button
          type="button"
          variant={showTableGrid ? "default" : "ghost"}
          size="sm"
          onClick={() => setShowTableGrid(!showTableGrid)}
          className="h-8 px-2 text-xs"
          title="Toggle Table Grid"
        >
          Grid
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowCFUModal(true)}
          className="h-8 px-2 text-xs"
          title="Insert Check for Understanding"
        >
          <Lightbulb className="w-4 h-4" />
        </Button>

        <Button
          type="button"
          variant={showInvisibles ? "default" : "ghost"}
          size="sm"
          onClick={() => {
            setShowInvisibles(!showInvisibles);
            editor?.commands.toggleInvisibleCharacters();
          }}
          className="h-8 px-2 text-xs"
          title="Toggle Hidden Characters"
        >
          {showInvisibles ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleAddWordClick}
          className="h-8 px-2 text-xs font-bold"
          title="Add Word to Dictionary"
        >
          +
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleRemoveWordClick}
          className="h-8 px-2 text-xs font-bold"
          title="Remove Word from Dictionary"
        >
          −
        </Button>

        <div className="w-px h-6 bg-[#e5e5e0] mx-1 self-center" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => courseId && setShowMediaLibrary(true)}
          disabled={!courseId}
          className="h-8 px-2 text-sm"
          title={courseId ? "Browse Media Library" : "Save lesson first to enable image upload"}
        >
          <ImageIcon className="w-4 h-4" />
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || !courseId}
          className="h-8 px-2 text-sm"
          title={courseId ? "Upload Image" : "Save lesson first to enable image upload"}
        >
          {uploading ? "..." : "Upload"}
        </Button>

        <div className="w-px h-6 bg-[#e5e5e0] mx-1 self-center" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="h-8 px-2"
        >
          Undo
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="h-8 px-2"
        >
          Redo
        </Button>

        <div className="w-px h-6 bg-[#e5e5e0] mx-1 self-center" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={decreaseIndent}
          className="h-8 px-2 text-xs font-mono"
          title="Outdent"
        >
          ←
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={increaseIndent}
          className="h-8 px-2 text-xs font-mono"
          title="Indent"
        >
          →
        </Button>

        <div className="w-px h-6 bg-[#e5e5e0] mx-1 self-center" />

        <Button
          type="button"
          variant={showSource ? "default" : "ghost"}
          size="sm"
          onClick={() => {
            if (showSource) {
              editor?.commands.setContent(sourceContent);
            } else {
              setSourceContent(editor?.getHTML() || "");
            }
            setShowSource(!showSource);
          }}
          className="h-8 px-2"
          title="Toggle Source Code"
        >
          <CodeIcon className="w-4 h-4" />
        </Button>
      </div>

      {isInsideTable() && tableContextKey > 0 && (
        <div className="flex items-center gap-1 py-2 px-3 bg-gray-50 border-t border-[#e5e5e0]">
          <span className="text-xs text-gray-500 mr-2">Table:</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().addColumnBefore().run()}
            className="h-7 px-2 text-xs"
            title="Add Column Left"
          >
            <Plus className="w-3 h-3 mr-1" />Col←
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().addColumnAfter().run()}
            className="h-7 px-2 text-xs"
            title="Add Column Right"
          >
            <Plus className="w-3 h-3 mr-1" />Col→
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().addRowBefore().run()}
            className="h-7 px-2 text-xs"
            title="Add Row Above"
          >
            <Plus className="w-3 h-3 mr-1" />Row↑
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().addRowAfter().run()}
            className="h-7 px-2 text-xs"
            title="Add Row Below"
          >
            <Plus className="w-3 h-3 mr-1" />Row↓
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().deleteColumn().run()}
            className="h-7 px-2 text-xs text-red-600"
            title="Delete Column"
          >
            <Minus className="w-3 h-3 mr-1" />Col
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().deleteRow().run()}
            className="h-7 px-2 text-xs text-red-600"
            title="Delete Row"
          >
            <Minus className="w-3 h-3 mr-1" />Row
          </Button>

          <div className="w-px h-5 bg-gray-300 mx-2" />

          <span className="text-xs text-gray-500">Width:</span>
          <input
            type="number"
            min={1}
            max={100}
            value={tableWidth}
            onChange={(e) => {
              const parsed = parseInt(e.target.value);
              if (!isNaN(parsed) && parsed >= 1 && parsed <= 100) {
                setTableWidth(parsed);
              }
            }}
            onBlur={(e) => {
              const parsed = parseInt(e.target.value);
              if (!isNaN(parsed)) {
                const clamped = Math.min(100, Math.max(1, parsed));
                updateTableWidth(clamped);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              }
            }}
            onFocus={() => setWidthInputFocused(true)}
            className="w-14 h-7 px-1 text-xs border border-[#e5e5e0] rounded text-center"
          />
          <span className="text-xs text-gray-500">%</span>

          <div className="w-px h-5 bg-gray-300 mx-2" />

          <span className="text-xs text-gray-500">Align:</span>
          <button
            type="button"
            onClick={() => updateTableAlignment("left")}
            className={`h-7 px-1.5 rounded ${tableAlignment === "left" ? "bg-gray-200" : ""}`}
            title="Align Left"
          >
            <AlignLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => updateTableAlignment("center")}
            className={`h-7 px-1.5 rounded ${tableAlignment === "center" ? "bg-gray-200" : ""}`}
            title="Align Center"
          >
            <AlignCenter className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => updateTableAlignment("right")}
            className={`h-7 px-1.5 rounded ${tableAlignment === "right" ? "bg-gray-200" : ""}`}
            title="Align Right"
          >
            <AlignRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {showSource ? (
        <div>
          <textarea
            value={sourceContent}
            onChange={(e) => setSourceContent(e.target.value)}
            className="w-full min-h-[300px] font-mono text-sm border border-[#e5e5e0] rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-[#0d7377]"
          />
          <div className="flex gap-2 mt-2">
            <Button
              onClick={() => {
                editor?.commands.setContent(sourceContent);
                onChange(sourceContent);
                setShowSource(false);
              }}
            >
              Apply Changes
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setSourceContent(editor?.getHTML() || "");
                setShowSource(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <EditorContent editor={editor} />
      )}

      {courseId && (
        <MediaLibrary
          courseId={courseId}
          open={showMediaLibrary}
          onClose={() => setShowMediaLibrary(false)}
          selectMode
          onImageSelect={(imageUrl) => {
            editor?.chain().focus().setImage({ src: imageUrl }).run();
          }}
        />
      )}

      <Dialog open={addWordModalOpen} onOpenChange={setAddWordModalOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Add to library?</DialogTitle>
            <DialogDescription>
              Add &ldquo;{wordUnderCursor}&rdquo; to the dictionary.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddWordModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (wordUnderCursor) {
                  const spellCheckStorage = editor?.storage as { spellCheck?: { addWord: (word: string) => void } };
                  spellCheckStorage?.spellCheck?.addWord(wordUnderCursor);
                }
                setAddWordModalOpen(false);
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={removeWordModalOpen} onOpenChange={setRemoveWordModalOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Remove from library?</DialogTitle>
            <DialogDescription>
              Remove &ldquo;{wordUnderCursor}&rdquo; from the dictionary.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveWordModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (wordUnderCursor) {
                  const spellCheckStorage = editor?.storage as { spellCheck?: { removeWord: (word: string) => void } };
                  spellCheckStorage?.spellCheck?.removeWord(wordUnderCursor);
                }
                setRemoveWordModalOpen(false);
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cannotRemoveModalOpen} onOpenChange={setCannotRemoveModalOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Cannot remove existing words</DialogTitle>
            <DialogDescription>
              &ldquo;{wordUnderCursor}&rdquo; is a base dictionary word and cannot be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setCannotRemoveModalOpen(false)}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={linkModalOpen} onOpenChange={setLinkModalOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Insert Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-1 block">URL</label>
              <input
                type="text"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                autoFocus
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="linkNewWindow"
                checked={linkNewWindow}
                onChange={(e) => setLinkNewWindow(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="linkNewWindow" className="text-sm">Open in New Window</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (linkUrl.trim()) {
                  const attrs: { href: string; target?: string } = {
                    href: linkUrl.trim(),
                  };
                  if (linkNewWindow) {
                    attrs.target = "_blank";
                  }
                  editor?.chain().focus().extendMarkRange("link").setLink(attrs).run();
                }
                setLinkModalOpen(false);
                setLinkUrl("");
                setLinkNewWindow(false);
              }}
              disabled={!linkUrl.trim()}
            >
              Insert Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TableInsertDialog
        open={showTableInsertDialog}
        onClose={() => setShowTableInsertDialog(false)}
        onInsert={insertTableWithOptions}
      />

      <CheckForUnderstandingModal
        open={showCFUModal}
        onClose={() => {
          editingCFUAttrsRef.current = null;
          setShowCFUModal(false);
          setEditingCFUAttrs(null);
        }}
        onInsert={insertCheckForUnderstanding}
        initialAttributes={editingCFUAttrs}
        isEditing={!!editingCFUAttrs}
      />
    </div>
  );
}