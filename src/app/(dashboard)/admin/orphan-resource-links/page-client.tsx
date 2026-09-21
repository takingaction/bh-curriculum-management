"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  RefreshCwIcon,
  ExternalLinkIcon,
  SearchIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from "lucide-react";
import type { OrphanReport, OrphanRecord } from "@/lib/orphan-detection";

interface ClientProps {
  initialReport: OrphanReport;
}

type GroupBy = "fragment" | "lesson" | "none";

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const seconds = Math.floor((now - then) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString();
}

function fieldToLabel(field: string): string {
  return field
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function OrphanRow({ orphan }: { orphan: OrphanRecord }) {
  const lessonUrl = `/admin/courses/${orphan.course_id}/lessons/${orphan.lesson_id}?section=${orphan.field}`;
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-2 px-3 hover:bg-gray-50 border-b border-gray-100 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="font-medium text-[#0d7377]">{fieldToLabel(orphan.field)}</span>
          <span className="text-gray-400">·</span>
          <span className="text-gray-600 truncate" title={orphan.link_text}>
            &ldquo;{orphan.link_text || "(no text)"}&rdquo;
          </span>
        </div>
        <div className="text-xs text-gray-400 truncate mt-0.5" title={orphan.broken_href}>
          {orphan.broken_href}
        </div>
      </div>
      <Link
        href={lessonUrl}
        target="_blank"
        rel="noopener noreferrer"
        prefetch={false}
        className="inline-flex items-center gap-1 text-sm text-[#0d7377] hover:text-[#0a5c5f] hover:underline whitespace-nowrap"
      >
        Open Section
        <ExternalLinkIcon className="w-3 h-3" />
      </Link>
    </div>
  );
}

function FragmentGroup({ fragment, orphans }: { fragment: string; orphans: OrphanRecord[] }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 hover:bg-gray-50 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          {open ? (
            <ChevronDownIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
          ) : (
            <ChevronRightIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
          )}
          <code className="text-sm font-mono text-gray-800 truncate" title={fragment}>
            {fragment}
          </code>
        </div>
        <span className="text-sm text-gray-500 flex-shrink-0">
          {orphans.length} orphan{orphans.length === 1 ? "" : "s"}
        </span>
      </button>
      {open && (
        <div>
          {orphans.map((orphan, i) => (
            <OrphanRow key={`${orphan.lesson_id}-${orphan.field}-${i}`} orphan={orphan} />
          ))}
        </div>
      )}
    </div>
  );
}

function LessonGroup({ lessonKey, orphans }: { lessonKey: string; orphans: OrphanRecord[] }) {
  const [open, setOpen] = useState(true);
  const lessonTitle = lessonKey.replace(/ \([a-f0-9-]+\)$/i, "");
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 hover:bg-gray-50 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          {open ? (
            <ChevronDownIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
          ) : (
            <ChevronRightIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
          )}
          <span className="font-medium text-gray-800 truncate">{lessonTitle}</span>
        </div>
        <span className="text-sm text-gray-500 flex-shrink-0">
          {orphans.length} orphan{orphans.length === 1 ? "" : "s"}
        </span>
      </button>
      {open && (
        <div>
          {orphans.map((orphan, i) => (
            <OrphanRow key={`${orphan.lesson_id}-${orphan.field}-${i}`} orphan={orphan} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function OrphanResourceLinksClient({ initialReport }: ClientProps) {
  const [report, setReport] = useState<OrphanReport>(initialReport);
  const [search, setSearch] = useState("");
  const [fieldFilter, setFieldFilter] = useState<string>("");
  const [lessonFilter, setLessonFilter] = useState<string>("");
  const [groupBy, setGroupBy] = useState<GroupBy>("fragment");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleRescan = () => {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch("/api/admin/orphan-resource-links", {
          method: "POST",
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        const freshReport: OrphanReport = await res.json();
        setReport(freshReport);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Failed to re-scan";
        setError(message);
      }
    });
  };

  const fieldOptions = useMemo(() => {
    return Object.keys(report.byField).sort();
  }, [report]);

  const lessonOptions = useMemo(() => {
    return Object.keys(report.byLesson).sort();
  }, [report]);

  const filteredOrphans = useMemo(() => {
    return report.orphans.filter((o) => {
      if (fieldFilter && o.field !== fieldFilter) return false;
      if (lessonFilter) {
        const lessonKey = `${o.lesson_title} (${o.lesson_id})`;
        if (lessonKey !== lessonFilter) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        if (
          !o.link_text.toLowerCase().includes(q) &&
          !o.broken_href.toLowerCase().includes(q) &&
          !o.lesson_title.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [report, search, fieldFilter, lessonFilter]);

  const filteredByFragment = useMemo(() => {
    const map: Record<string, OrphanRecord[]> = {};
    for (const o of filteredOrphans) {
      const m = /\/curriculum-assets\/assets\/\d+-(.+?)(?:\.\w+)?(?:#|$|\?)/.exec(o.broken_href);
      const fragment = m ? m[1] : "(unknown)";
      if (!map[fragment]) map[fragment] = [];
      map[fragment].push(o);
    }
    const entries = Object.entries(map).sort((a, b) => b[1].length - a[1].length);
    return entries;
  }, [filteredOrphans]);

  const filteredByLesson = useMemo(() => {
    const map: Record<string, OrphanRecord[]> = {};
    for (const o of filteredOrphans) {
      const key = `${o.lesson_title} (${o.lesson_id})`;
      if (!map[key]) map[key] = [];
      map[key].push(o);
    }
    const entries = Object.entries(map).sort((a, b) => b[1].length - a[1].length);
    return entries;
  }, [filteredOrphans]);

  const orphanCount = filteredOrphans.length;
  const lessonCount = new Set(filteredOrphans.map((o) => o.lesson_id)).size;
  const fragmentCount = filteredByFragment.length;
  const hasOrphans = report.stats.orphans > 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[#2d2d2d]">Orphan Resource Links</h1>
          <p className="text-sm text-gray-500 mt-1">
            Lesson resource links pointing at storage objects that no longer exist.
            Click &ldquo;Open Section&rdquo; to jump straight to the field in the lesson editor.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button onClick={handleRescan} disabled={isPending} variant="outline">
            <RefreshCwIcon className={`w-4 h-4 mr-1 ${isPending ? "animate-spin" : ""}`} />
            {isPending ? "Scanning…" : "Re-scan"}
          </Button>
          <span className="text-xs text-gray-400" title={formatTimestamp(report.scannedAt)}>
            Last scanned: {formatRelativeTime(report.scannedAt)}
          </span>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
          {error}
        </div>
      )}

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          {hasOrphans ? (
            <div className="flex items-center gap-2 text-amber-700">
              <AlertTriangleIcon className="w-4 h-4" />
              <span className="font-medium">
                {orphanCount === report.stats.orphans
                  ? `${orphanCount} orphan${orphanCount === 1 ? "" : "s"}`
                  : `${orphanCount} of ${report.stats.orphans} orphans shown`}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircleIcon className="w-4 h-4" />
              <span className="font-medium">All resource links are healthy</span>
            </div>
          )}
          <div className="text-gray-600">
            Across <span className="font-medium">{lessonCount}</span> lesson
            {lessonCount === 1 ? "" : "s"} in <span className="font-medium">{fragmentCount}</span> filename
            fragment{fragmentCount === 1 ? "" : "s"}
          </div>
          <div className="text-gray-500 ml-auto text-xs">
            {report.stats.tagsScanned} tag{report.stats.tagsScanned === 1 ? "" : "s"} scanned ·{" "}
            {report.stats.alreadyTagged} already tagged ·{" "}
            {report.stats.matchesByFilename + report.stats.matchesByPreviousUrl + report.stats.matchesByDisplayNameExact + report.stats.matchesByDisplayNameSubstring} matched
          </div>
        </div>
      </div>

      {hasOrphans && (
        <div className="bg-white border border-gray-200 rounded-lg p-3 flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search link text, URL, or lesson title…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={fieldFilter}
            onChange={(e) => setFieldFilter(e.target.value)}
            className="px-2 py-2 text-sm border border-gray-300 rounded"
          >
            <option value="">All sections</option>
            {fieldOptions.map((f) => (
              <option key={f} value={f}>
                {fieldToLabel(f)} ({report.byField[f]})
              </option>
            ))}
          </select>
          <select
            value={lessonFilter}
            onChange={(e) => setLessonFilter(e.target.value)}
            className="px-2 py-2 text-sm border border-gray-300 rounded"
          >
            <option value="">All lessons</option>
            {lessonOptions.map((l) => {
              const title = l.replace(/ \([a-f0-9-]+\)$/i, "");
              return (
                <option key={l} value={l}>
                  {title}
                </option>
              );
            })}
          </select>
          <div className="flex items-center gap-1 text-xs">
            <span className="text-gray-500 mr-1">Group by:</span>
            <button
              type="button"
              onClick={() => setGroupBy("fragment")}
              className={`px-2 py-1 rounded ${
                groupBy === "fragment" ? "bg-[#0d7377] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Filename
            </button>
            <button
              type="button"
              onClick={() => setGroupBy("lesson")}
              className={`px-2 py-1 rounded ${
                groupBy === "lesson" ? "bg-[#0d7377] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Lesson
            </button>
            <button
              type="button"
              onClick={() => setGroupBy("none")}
              className={`px-2 py-1 rounded ${
                groupBy === "none" ? "bg-[#0d7377] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Flat
            </button>
          </div>
        </div>
      )}

      {hasOrphans && groupBy === "fragment" && (
        <div className="space-y-3">
          {filteredByFragment.map(([fragment, orphans]) => (
            <FragmentGroup key={fragment} fragment={fragment} orphans={orphans} />
          ))}
        </div>
      )}

      {hasOrphans && groupBy === "lesson" && (
        <div className="space-y-3">
          {filteredByLesson.map(([lessonKey, orphans]) => (
            <LessonGroup key={lessonKey} lessonKey={lessonKey} orphans={orphans} />
          ))}
        </div>
      )}

      {hasOrphans && groupBy === "none" && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {filteredOrphans.map((orphan, i) => (
            <OrphanRow
              key={`${orphan.lesson_id}-${orphan.field}-${i}`}
              orphan={orphan}
            />
          ))}
        </div>
      )}

      {!hasOrphans && (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <CheckCircleIcon className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <h2 className="text-lg font-medium text-gray-700 mb-1">All resource links are healthy</h2>
          <p className="text-sm text-gray-500">
            No orphaned links detected in {report.stats.lessonsScanned} lessons.
          </p>
        </div>
      )}

      <div className="text-xs text-gray-400">
        Detection scanned {report.stats.lessonsScanned} lessons across {report.stats.fieldsScanned} fields.
        {report.stats.matchesByPreviousUrl > 0 && (
          <> · {report.stats.matchesByPreviousUrl} matched via previous_public_urls.</>
        )}
        {report.stats.matchesByFilename > 0 && (
          <> · {report.stats.matchesByFilename} matched via filename fragment.</>
        )}
      </div>
    </div>
  );
}
