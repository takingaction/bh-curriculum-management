"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Download, RefreshCw, AlertCircle, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

interface DisciplinePdfButtonsProps {
  discipline: string;
}

interface PdfInfo {
  exists: boolean;
  generated_at?: string;
  file_size?: number;
  filename?: string;
}

export function DisciplinePdfButtons({ discipline }: DisciplinePdfButtonsProps) {
  const [pdfInfo, setPdfInfo] = useState<PdfInfo | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<{ message: string; diagnostics?: { actualSize?: number } } | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [pdfCacheBust, setPdfCacheBust] = useState<string>("");

  useEffect(() => {
    fetchPdfInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discipline]);

  async function fetchPdfInfo() {
    try {
      const res = await fetch(`/api/disciplines/${discipline}/pdf/info`);
      if (res.ok) {
        const data = await res.json();
        setPdfInfo(data);
      }
    } catch (err) {
      console.error("Error fetching PDF info:", err);
    }
  }

  async function handleGeneratePdf() {
    setPdfLoading(true);
    setPdfError(null);

    try {
      const res = await fetch(`/api/disciplines/${discipline}/pdf/generate`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        setPdfError({
          message: data.error || "Failed to generate PDF",
          diagnostics: data.diagnostics,
        });
        setPdfInfo(null);
      } else {
        setPdfInfo({
          exists: true,
          generated_at: data.generated_at,
          file_size: data.file_size,
          filename: data.filename,
        });
        setPdfCacheBust(Date.now().toString());
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to generate PDF";
      setPdfError({
        message: errorMessage,
      });
      setPdfInfo(null);
    } finally {
      setPdfLoading(false);
    }
  }

  function formatFileSize(bytes?: number): string {
    if (!bytes) return "Unknown";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1024 / 1024).toFixed(2) + " MB";
  }

  function formatDate(dateStr?: string): string {
    if (!dateStr) return "Unknown";
    return new Date(dateStr).toLocaleString();
  }

  if (pdfLoading) {
    return (
      <div className="flex items-center gap-2 text-gray-600 py-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Generating PDF...</span>
      </div>
    );
  }

  if (pdfError) {
    return (
      <div className="space-y-3 py-4">
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded text-red-800">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Error generating PDF</p>
            <p className="text-sm">{pdfError.message}</p>
            {pdfError.diagnostics?.actualSize && (
              <p className="text-sm mt-1">Actual size: {formatFileSize(pdfError.diagnostics.actualSize)}</p>
            )}
          </div>
        </div>
        {pdfError.diagnostics && (
          <div>
            <button
              type="button"
              onClick={() => setShowDiagnostics(!showDiagnostics)}
              className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800"
            >
              {showDiagnostics ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {showDiagnostics ? "Hide" : "Show"} Full Diagnostics
            </button>
            {showDiagnostics && (
              <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-auto max-h-60 whitespace-pre-wrap">
                {JSON.stringify(pdfError.diagnostics, null, 2)}
              </pre>
            )}
          </div>
        )}
        <Button onClick={handleGeneratePdf} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-1" />
          Try Again
        </Button>
      </div>
    );
  }

  if (!pdfInfo?.exists) {
    return (
      <div className="py-4">
        <Button onClick={handleGeneratePdf}>
          <FileText className="w-4 h-4 mr-1" />
          Generate PDF
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 py-4">
      <div className="p-3 bg-gray-50 border border-gray-200 rounded">
        <p className="text-sm font-medium">{pdfInfo.filename}</p>
        <p className="text-xs text-gray-600 mt-1">
          Generated: {formatDate(pdfInfo.generated_at)} | Size: {formatFileSize(pdfInfo.file_size)}
        </p>
      </div>
      <div className="flex gap-2 flex-wrap">
        <a
          href={`/api/disciplines/${discipline}/pdf?download=false&t=${pdfCacheBust}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button variant="outline" size="sm">
            <FileText className="w-4 h-4 mr-1" />
            View PDF
          </Button>
        </a>
        <a
          href={`/api/disciplines/${discipline}/pdf?download=true&t=${pdfCacheBust}`}
          download
        >
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-1" />
            Download PDF
          </Button>
        </a>
        <Button onClick={handleGeneratePdf} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-1" />
          Generate New PDF
        </Button>
      </div>
    </div>
  );
}
