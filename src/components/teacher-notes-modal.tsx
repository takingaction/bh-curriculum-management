"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { useEffect, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, LinkIcon, Copy, Download, Check, Bold, Italic, List, ListOrdered } from "lucide-react";

interface TeacherNotesModalProps {
  open: boolean;
  onClose: () => void;
  type: "course" | "lesson";
  courseId?: string;
  lessonId?: string;
  initialTitle?: string;
}

export function TeacherNotesModal({
  open,
  onClose,
  type,
  courseId,
  lessonId,
  initialTitle,
}: TeacherNotesModalProps) {
  const [notes, setNotes] = useState("");
  const [originalNotes, setOriginalNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [exportFeedback, setExportFeedback] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [loading, setLoading] = useState(true);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [3],
        },
        link: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: "noopener noreferrer",
        },
      }),
    ],
    content: "",
    onUpdate: ({ editor }) => {
      setNotes(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose max-w-none min-h-[200px] px-4 py-3 focus:outline-none border border-[#e5e5e0] rounded-lg overflow-hidden",
        spellcheck: "false",
      },
    },
  });

  useEffect(() => {
    if (open && (courseId || lessonId)) {
      fetchNotes();
    }
  }, [open, courseId, lessonId]);

  useEffect(() => {
    if (editor && notes === "" && !loading) {
      editor.commands.setContent(originalNotes || "");
    }
  }, [loading, originalNotes, editor]);

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type });
      if (type === "course" && courseId) params.append("courseId", courseId);
      if (type === "lesson" && lessonId) params.append("lessonId", lessonId);

      const response = await fetch(`/api/teachers/notes?${params}`);
      const data = await response.json();

      if (data.notes !== undefined) {
        setNotes(data.notes);
        setOriginalNotes(data.notes);
        editor?.commands.setContent(data.notes || "");
      }
    } catch (error) {
      console.error("Failed to fetch notes:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveNotes = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/teachers/notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          courseId: type === "course" ? courseId : undefined,
          lessonId: type === "lesson" ? lessonId : undefined,
          notes,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setOriginalNotes(notes);
        onClose();
      } else {
        alert(data.error || "Failed to save notes");
      }
    } catch (error) {
      console.error("Failed to save notes:", error);
      alert("Failed to save notes");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (notes !== originalNotes) {
      if (!confirm("You have unsaved changes. Are you sure you want to close?")) {
        return;
      }
    }
    onClose();
  };

  const handleCopy = useCallback(async () => {
    try {
      const text = stripHtml(notes);
      await navigator.clipboard.writeText(text);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [notes]);

  const handleExport = useCallback(async () => {
    try {
      const text = stripHtml(notes);
      const markdown = htmlToMarkdown(notes);

      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: markdown, format: "docx" }),
      });

      if (!response.ok) {
        throw new Error("Export failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `teacher-notes-${type}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setExportFeedback(true);
      setTimeout(() => setExportFeedback(false), 2000);
    } catch (err) {
      console.error("Failed to export:", err);
    }
  }, [notes, type]);

  const stripHtml = (html: string): string => {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  };

  const htmlToMarkdown = (html: string): string => {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;

    const processNode = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent || "";
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return "";
      }

      const el = node as HTMLElement;
      const tagName = el.tagName.toLowerCase();

      switch (tagName) {
        case "h3":
          return `### ${el.textContent || ""}\n`;
        case "p":
          return `${el.textContent || ""}\n`;
        case "strong":
        case "b":
          return `**${el.textContent || ""}**`;
        case "em":
        case "i":
          return `*${el.textContent || ""}*`;
        case "a":
          return `[${el.textContent || ""}](${el.getAttribute("href") || ""})`;
        case "li":
          const isOrdered = el.parentElement?.tagName.toLowerCase() === "ol";
          const prefix = isOrdered ? "1. " : "- ";
          return prefix + (el.textContent || "").trim() + "\n";
        case "ul":
        case "ol":
          return Array.from(el.children).map(processNode).join("");
        case "br":
          return "\n";
        default:
          return Array.from(el.childNodes).map(processNode).join("");
      }
    };

    return Array.from(tmp.childNodes).map(processNode).join("");
  };

  const hasChanges = notes !== originalNotes;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Teacher Notes - {initialTitle || (type === "course" ? "Course" : "Lesson")}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-pulse text-gray-500">Loading...</div>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1 border border-[#e5e5e0] rounded-lg p-2 bg-white">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => editor?.chain().focus().toggleBold().run()}
                  className={`h-8 px-2 ${editor?.isActive("bold") ? "bg-[#f5f5f0]" : ""}`}
                >
                  <Bold className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => editor?.chain().focus().toggleItalic().run()}
                  className={`h-8 px-2 ${editor?.isActive("italic") ? "bg-[#f5f5f0]" : ""}`}
                >
                  <Italic className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
                  className={`h-8 px-2 ${editor?.isActive("heading", { level: 3 }) ? "bg-[#f5f5f0]" : ""}`}
                >
                  H3
                </Button>

                <div className="w-px h-6 bg-[#e5e5e0] mx-1 self-center" />

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => editor?.chain().focus().toggleBulletList().run()}
                  className={`h-8 px-2 ${editor?.isActive("bulletList") ? "bg-[#f5f5f0]" : ""}`}
                >
                  <List className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                  className={`h-8 px-2 ${editor?.isActive("orderedList") ? "bg-[#f5f5f0]" : ""}`}
                >
                  <ListOrdered className="w-4 h-4" />
                </Button>

                <div className="w-px h-6 bg-[#e5e5e0] mx-1 self-center" />

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (editor?.isActive("link")) {
                      const attrs = editor.getAttributes("link");
                      setLinkUrl(attrs.href || "");
                    } else {
                      setLinkUrl("");
                    }
                    setLinkModalOpen(true);
                  }}
                  className={`h-8 px-2 ${editor?.isActive("link") ? "bg-[#f5f5f0]" : ""}`}
                  title="Insert Link"
                >
                  <LinkIcon className="w-4 h-4" />
                </Button>
              </div>

              <EditorContent editor={editor} />
            </div>

            {linkModalOpen && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center">
                <div className="bg-white rounded-lg border border-gray-200 shadow-lg p-4 w-full max-w-md mx-4">
                  <h3 className="font-medium mb-2">Insert Link</h3>
                  <input
                    type="text"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-3"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLinkModalOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        if (linkUrl.trim()) {
                          editor?.chain().focus().setLink({ href: linkUrl.trim() }).run();
                        }
                        setLinkModalOpen(false);
                        setLinkUrl("");
                      }}
                      disabled={!linkUrl.trim()}
                    >
                      Insert
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <DialogFooter>
          <div className="flex items-center gap-2 mr-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              disabled={!notes || loading}
              title="Copy to clipboard"
            >
              {copyFeedback ? (
                <Check className="w-4 h-4 text-green-600" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              <span className="ml-1">Copy</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExport}
              disabled={!notes || loading}
              title="Download as DOCX"
            >
              {exportFeedback ? (
                <Check className="w-4 h-4 text-green-600" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span className="ml-1">DOCX</span>
            </Button>
          </div>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={saveNotes} disabled={saving || loading || !hasChanges}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
