"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Table } from "@tiptap/extension-table";
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
import { ImageIcon, CodeIcon, EyeIcon, EyeOffIcon, LinkIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { SpellCheckExtension } from "./extensions/spell-check";

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

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
        paragraph: false,
      }),
      ParagraphWithStyle,
      Table.configure({
        resizable: true,
      }),
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
          `prose max-w-none min-h-[150px] px-4 py-3 focus:outline-none border border-[#e5e5e0] rounded-lg${showTableGrid ? " show-table-grid" : ""}`,
        spellcheck: "false",
      },
    },
  });

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
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true })}
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
    </div>
  );
}