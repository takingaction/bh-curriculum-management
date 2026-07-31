"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { X, ExternalLink, FileText, CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";

interface BatchJob {
  id: string;
  status: "pending" | "processing" | "completed" | "cancelled";
  total_count: number;
  processed_count: number;
  success_count: number;
  failure_count: number;
  created_at: string;
  completed_at: string | null;
}

interface BatchResult {
  id: string;
  lesson_id: string;
  status: "pending" | "success" | "failed";
  error_message: string | null;
  retry_count: number;
  processed_at: string;
  lesson: {
    id: string;
    lesson_number: number;
    title: string;
    course_id: string | null;
    course: {
      discipline: string;
      grade: string;
    } | null;
  } | null;
}

interface Pagination {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export default function BatchPdfRegeneratePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [job, setJob] = useState<BatchJob | null>(null);
  const [results, setResults] = useState<BatchResult[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "failed">("all");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmMode, setConfirmMode] = useState<"start" | "resume">("start");
  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedError, setSelectedError] = useState<string | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [logData, setLogData] = useState<any>(null);
  const [logLoading, setLogLoading] = useState(false);
  const processingRef = useRef(false);
  const processingQueueRef = useRef<string[]>([]);
  const processedRef = useRef<Set<string>>(new Set());
  const jobIdRef = useRef<string | null>(null);
  const statusFilterRef = useRef(statusFilter);
  const paginationPageRef = useRef(1);
  const resumeModeRef = useRef(false);

  // Keep refs in sync
  statusFilterRef.current = statusFilter;

  // Fetch current job status
  const fetchCurrentJob = useCallback(async () => {
    try {
      const res = await fetch("/api/batch/current");
      const data = await res.json();
      if (data.job) {
        setJob(data.job);
        jobIdRef.current = data.job.id;
      } else {
        setJob(null);
        jobIdRef.current = null;
        resumeModeRef.current = false;
      }
    } catch (error) {
      console.error("Error fetching job:", error);
    }
  }, []);

  // Fetch already processed lesson IDs (for resume)
  const fetchAlreadyProcessedIds = useCallback(async (jobId: string) => {
    try {
      // Fetch all success and failed results to populate processedRef
      const params = new URLSearchParams({ pageSize: "1000", status: "success" });
      const successRes = await fetch(`/api/batch/${jobId}?${params}`);
      const successData = await successRes.json();
      if (successData.results) {
        successData.results.forEach((r: BatchResult) => {
          processedRef.current.add(r.lesson_id);
        });
      }

      const failedParams = new URLSearchParams({ pageSize: "1000", status: "failed" });
      const failedRes = await fetch(`/api/batch/${jobId}?${failedParams}`);
      const failedData = await failedRes.json();
      if (failedData.results) {
        failedData.results.forEach((r: BatchResult) => {
          processedRef.current.add(r.lesson_id);
        });
      }
    } catch (error) {
      console.error("Error fetching already processed IDs:", error);
    }
  }, []);

  // Fetch pending lessons for resume
  const fetchPendingLessons = useCallback(async (jobId: string): Promise<string[]> => {
    try {
      const res = await fetch(`/api/batch/${jobId}/pending`);
      const data = await res.json();
      if (data.pendingLessons) {
        return data.pendingLessons.map((p: any) => p.lesson_id);
      }
      return [];
    } catch (error) {
      console.error("Error fetching pending lessons:", error);
      return [];
    }
  }, []);

  // Fetch results with pagination
  const fetchResults = useCallback(async (page: number = 1, filter: "all" | "success" | "failed" = "all") => {
    if (!jobIdRef.current) return;
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: "20",
      });
      if (filter !== "all") {
        params.set("status", filter);
      }
      const res = await fetch(`/api/batch/${jobIdRef.current}?${params}`);
      const data = await res.json();
      setResults(data.results || []);
      setPagination(data.pagination);
    } catch (error) {
      console.error("Error fetching results:", error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchCurrentJob();
      setLoading(false);
    };
    init();
  }, [fetchCurrentJob]);

  // Fetch results when job changes
  useEffect(() => {
    if (job) {
      fetchResults(1, statusFilter);
    }
  }, [job, statusFilter, fetchResults]);

  // Detect stuck job (processing but not actively running in this session)
  useEffect(() => {
    if (job?.status === "processing" && !isRunning) {
      resumeModeRef.current = true;
      // Fetch already processed IDs for resume
      fetchAlreadyProcessedIds(job.id);
    }
  }, [job, isRunning, fetchAlreadyProcessedIds]);

  // Sync pagination page ref when pagination changes
  useEffect(() => {
    if (pagination?.page) {
      paginationPageRef.current = pagination.page;
    }
  }, [pagination]);

  // Poll for updates while running (using refs to avoid dependency changes)
  useEffect(() => {
    if (!job || job.status !== "processing") return;

    const pollInterval = setInterval(async () => {
      await fetchCurrentJob();
      await fetchResults(paginationPageRef.current, statusFilterRef.current);
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [job, fetchCurrentJob, fetchResults]);

  // Process a single lesson PDF
  const processLesson = async (lessonId: string, jobId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // First attempt
      const res = await fetch(`/api/lessons/${lessonId}/pdf/generate`, { method: "POST" });
      const data = await res.json();

      if (res.ok && data.success) {
        return { success: true };
      }

      // Retry once
      const retryRes = await fetch(`/api/lessons/${lessonId}/pdf/generate`, { method: "POST" });
      const retryData = await retryRes.json();

      if (retryRes.ok && retryData.success) {
        return { success: true };
      }

      // Both attempts failed
      const errorMsg = retryData.error || data.error || "Unknown error";
      return { success: false, error: errorMsg };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  // Submit result to API
  const submitResult = async (jobId: string, lessonId: string, success: boolean, errorMsg?: string) => {
    try {
      await fetch(`/api/batch/${jobId}/results`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId,
          status: success ? "success" : "failed",
          errorMessage: errorMsg,
        }),
      });
    } catch (error) {
      console.error("Error submitting result:", error);
    }
  };

  // Retry failed lessons (reset them to pending)
  const retryFailed = async () => {
    if (!jobIdRef.current) return;

    setLoading(true);
    try {
      // Fetch all failed for this job
      const params = new URLSearchParams({ pageSize: "1000", status: "failed" });
      const res = await fetch(`/api/batch/${jobIdRef.current}?${params}`);
      const data = await res.json();

      if (data.results && data.results.length > 0) {
        // Reset each failed result to pending
        for (const result of data.results) {
          await fetch(`/api/batch/${jobIdRef.current}/results`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lessonId: result.lesson_id,
              status: "pending",
              errorMessage: null,
            }),
          });
        }
        // Refresh job state
        await fetchCurrentJob();
        await fetchResults(1, "all");
      }
    } catch (error) {
      console.error("Error retrying failed:", error);
    } finally {
      setLoading(false);
    }
  };

  // Resume batch processing
  const resumeBatch = async () => {
    if (!job || job.status !== "processing") return;

    setShowConfirmModal(false);
    setLoading(true);
    processingRef.current = true;

    try {
      jobIdRef.current = job.id;
      const pendingLessonIds = await fetchPendingLessons(job.id);
      console.log("[Resume] Pending lessons:", pendingLessonIds.length);
      processingQueueRef.current = pendingLessonIds;

      setIsRunning(true);

      // Process pending lessons
      for (const lessonId of processingQueueRef.current) {
        if (!processingRef.current) {
          console.log("[Resume] Processing cancelled by user");
          break;
        }
        if (processedRef.current.has(lessonId)) {
          console.log("[Resume] Already processed:", lessonId);
          continue;
        }

        console.log("[Resume] Processing lesson:", lessonId);
        const result = await processLesson(lessonId, job.id);
        console.log("[Resume] Lesson result:", lessonId, result.success ? "SUCCESS" : "FAILED", result.error);
        await submitResult(job.id, lessonId, result.success, result.error);
        processedRef.current.add(lessonId);

        // Refresh data
        await fetchCurrentJob();
        await fetchResults(paginationPageRef.current, statusFilterRef.current);
      }

      console.log("[Resume] Processing complete");
      processingRef.current = false;
      resumeModeRef.current = false;
      await fetchCurrentJob();
      await fetchResults(1, statusFilter);

    } catch (error: any) {
      console.error("Resume error:", error);
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Start new batch (fresh start)
  const startBatch = async () => {
    setShowConfirmModal(false);
    setLoading(true);

    try {
      // Clear processed refs for fresh start
      processedRef.current = new Set();
      processingQueueRef.current = [];
      resumeModeRef.current = false;

      // Start the batch job
      const res = await fetch("/api/batch/pdf-regenerate", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Failed to start batch");
        setLoading(false);
        return;
      }

      const { jobId, totalCount } = data;
      console.log("[Batch] Job created:", jobId, "Total:", totalCount);
      processingRef.current = true;

      // Fetch all lessons
      console.log("[Batch] Fetching lessons...");
      const lessonsRes = await fetch("/api/lessons");
      if (!lessonsRes.ok) {
        console.error("[Batch] Failed to fetch lessons, status:", lessonsRes.status);
        alert("Failed to fetch lessons");
        setLoading(false);
        return;
      }
      const lessonsData = await lessonsRes.json();
      console.log("[Batch] Lessons response:", lessonsData);
      const lessonIds = (lessonsData.lessons as any[])?.map((l) => l.id as string) || [];
      console.log("[Batch] Lesson IDs count:", lessonIds.length);
      processingQueueRef.current = [...new Set(lessonIds)] as string[]; // Deduplicate

      // Re-fetch job to get updated state
      await fetchCurrentJob();

      setIsRunning(true);
      processingRef.current = true;

      // Process sequentially
      console.log("[Batch] Starting processing loop, total:", processingQueueRef.current.length);

      for (const lessonId of processingQueueRef.current) {
        if (!processingRef.current) {
          console.log("[Batch] Processing cancelled by user");
          break;
        }
        if (processedRef.current.has(lessonId)) {
          console.log("[Batch] Already processed:", lessonId);
          continue;
        }

        console.log("[Batch] Processing lesson:", lessonId);
        const result = await processLesson(lessonId, jobId);
        console.log("[Batch] Lesson result:", lessonId, result.success ? "SUCCESS" : "FAILED", result.error);
        await submitResult(jobId, lessonId, result.success, result.error);
        processedRef.current.add(lessonId);

        // Refresh data
        await fetchCurrentJob();
        await fetchResults(paginationPageRef.current, statusFilterRef.current);
      }

      console.log("[Batch] Processing complete");
      processingRef.current = false;
      await fetchCurrentJob();
      await fetchResults(1, statusFilter);

    } catch (error: any) {
      console.error("Batch error:", error);
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  // View log for a failed lesson
  const viewLog = async (lessonId: string) => {
    setSelectedLessonId(lessonId);
    setLogLoading(true);
    setShowLogModal(true);

    try {
      const res = await fetch(`/api/lessons/${lessonId}/pdf/diagnostics`);
      const data = await res.json();
      setLogData(data);
    } catch (err) {
      console.error("Error fetching diagnostics:", err);
      setLogData({ error: (err as Error).message });
    } finally {
      setLogLoading(false);
    }
  };

  // Pagination handlers
  const goToPage = (page: number) => {
    paginationPageRef.current = page;
    if (job) {
      fetchResults(page, statusFilter);
    }
  };

  const progressPercent = job ? Math.round((job.processed_count / job.total_count) * 100) : 0;

  if (loading && !job) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#0d7377]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Batch in Progress Notification Banner */}
      {job?.status === "processing" && (
        <div className="bg-[#0d7377] text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="font-medium">Batch PDF Regeneration in Progress</span>
            <span className="text-sm opacity-80">
              {job.processed_count} / {job.total_count} completed ({Math.round((job.processed_count / job.total_count) * 100)}%)
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-white/80">{job.success_count} success</span>
            <span className="text-white/80">|</span>
            <span className="text-white/80">{job.failure_count} failed</span>
            <button
              onClick={async () => {
                if (confirm("Are you sure you want to cancel the batch?")) {
                  console.log("[Cancel] Setting processingRef to false");
                  processingRef.current = false;
                  console.log("[Cancel] Updating local state to cancelled");
                  setJob({ ...job, status: "cancelled" });
                  setIsRunning(false);
                  console.log("[Cancel] Calling cancel API");
                  await fetch(`/api/batch/${job.id}/cancel`, { method: "POST" });
                  console.log("[Cancel] Done");
                }
              }}
              className="ml-2 px-2 py-1 border border-white/50 rounded text-white/90 hover:bg-white/20 text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-[#2d2d2d]">Batch PDF Regeneration</h1>
          {job?.status === "processing" && !isRunning && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-red-600 font-medium">Stuck job detected</span>
              <Button
                onClick={() => {
                  setConfirmMode("resume");
                  setShowConfirmModal(true);
                }}
                className="bg-[#0d7377] hover:bg-[#0a5c5f] text-white"
              >
                Resume Batch
              </Button>
              <Button
                onClick={() => {
                  setConfirmMode("start");
                  setShowConfirmModal(true);
                }}
                variant="outline"
                className="border-[#0d7377] text-[#0d7377] hover:bg-[#0d7377] hover:text-white"
              >
                Start New Batch
              </Button>
            </div>
          )}
          {!isRunning && job?.status !== "completed" && job?.status !== "processing" && (
            <Button
              onClick={() => {
                setConfirmMode("start");
                setShowConfirmModal(true);
              }}
              className="bg-[#0d7377] hover:bg-[#0a5c5f] text-white"
            >
              Start New Batch
            </Button>
          )}
          {isRunning && (
            <div className="flex items-center gap-2 text-[#0d7377]">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Batch in Progress...</span>
            </div>
          )}
          {job?.status === "completed" && (
            <Button
              onClick={() => {
                setConfirmMode("start");
                setShowConfirmModal(true);
              }}
              className="bg-[#0d7377] hover:bg-[#0a5c5f] text-white"
            >
              Start New Batch
            </Button>
          )}
        </div>

        {/* Progress Section */}
        {job && (
          <div className="bg-white rounded-lg border border-[#e5e5e0] p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-[#2d2d2d]">
                  {job.status === "completed" ? "Completed" : "Processing"}
                </h2>
                <p className="text-sm text-gray-500">
                  Started: {new Date(job.created_at).toLocaleString()}
                  {job.completed_at && ` • Finished: ${new Date(job.completed_at).toLocaleString()}`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-[#2d2d2d]">
                  {job.processed_count} / {job.total_count}
                </p>
                <p className="text-sm text-gray-500">{progressPercent}%</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
              <div
                className="bg-[#0d7377] h-3 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Stats */}
            <div className="flex gap-6 items-center">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span className="text-sm text-gray-700">{job.success_count} Success</span>
              </div>
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-600" />
                <span className="text-sm text-gray-700">{job.failure_count} Failed</span>
              </div>
              {job.failure_count > 0 && (
                <Button
                  onClick={retryFailed}
                  variant="outline"
                  size="sm"
                  className="border-orange-500 text-orange-500 hover:bg-orange-50"
                  disabled={loading}
                >
                  Retry Failed
                </Button>
              )}
            </div>

            {/* Filter tabs */}
            <div className="flex gap-2 mt-4 pt-4 border-t">
              <button
                onClick={() => setStatusFilter("all")}
                className={`px-3 py-1 text-sm rounded ${
                  statusFilter === "all" ? "bg-[#0d7377] text-white" : "bg-gray-100 text-gray-700"
                }`}
              >
                All ({job.total_count})
              </button>
              <button
                onClick={() => setStatusFilter("success")}
                className={`px-3 py-1 text-sm rounded ${
                  statusFilter === "success" ? "bg-green-600 text-white" : "bg-gray-100 text-gray-700"
                }`}
              >
                Success ({job.success_count})
              </button>
              <button
                onClick={() => setStatusFilter("failed")}
                className={`px-3 py-1 text-sm rounded ${
                  statusFilter === "failed" ? "bg-red-600 text-white" : "bg-gray-100 text-gray-700"
                }`}
              >
                Failed ({job.failure_count})
              </button>
            </div>
          </div>
        )}

        {/* Results Table */}
        {job && results.length > 0 && (
          <div className="bg-white rounded-lg border border-[#e5e5e0] overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Discipline</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Grade</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lesson</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {results.map((result) => (
                  <tr key={result.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {result.lesson?.course?.discipline || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {result.lesson?.course?.grade || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      L{result.lesson?.lesson_number || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 truncate max-w-xs">
                      {result.lesson?.title || "-"}
                    </td>
                    <td className="px-4 py-3">
                      {result.status === "success" && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                          <CheckCircle2 className="w-3 h-3" /> Success
                        </span>
                      )}
                      {result.status === "failed" && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 rounded text-xs">
                          <XCircle className="w-3 h-3" /> Failed
                        </span>
                      )}
                      {result.status === "pending" && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs">
                          <Loader2 className="w-3 h-3 animate-spin" /> Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {result.status === "failed" && (
                          <button
                            onClick={() => viewLog(result.lesson_id)}
                            className="p-1 hover:bg-gray-200 rounded text-gray-600"
                            title="View Log"
                          >
                            <AlertCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => window.open(`/admin/courses/${result.lesson?.course_id}/lessons/${result.lesson_id}`, "_blank")}
                          className="p-1 hover:bg-gray-200 rounded text-gray-600"
                          title="Edit Lesson"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => window.open(`/api/lessons/${result.lesson_id}/pdf?download=false`, "_blank")}
                          className="p-1 hover:bg-gray-200 rounded text-gray-600"
                          title="View PDF"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  Page {pagination.page} of {pagination.totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                  >
                    Previous
                  </Button>
                  {Array.from({ length: Math.min(10, pagination.totalPages) }, (_, i) => {
                    const start = Math.max(1, pagination.page - 5);
                    const pageNum = start + i;
                    if (pageNum > pagination.totalPages) return null;
                    return (
                      <Button
                        key={pageNum}
                        variant={pagination.page === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => goToPage(pageNum)}
                        className={pagination.page === pageNum ? "bg-[#0d7377]" : ""}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* No job yet */}
        {!job && !loading && (
          <div className="text-center py-12 text-gray-500">
            <p>No batch jobs yet. Click "Start New Batch" to begin regenerating all lesson PDFs.</p>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-[#2d2d2d] mb-4">
              {confirmMode === "resume" ? "Resume Batch" : "Start New Batch"}
            </h2>
            <p className="text-gray-600 mb-6">
              {confirmMode === "resume" ? (
                <>This will resume processing <strong>{job?.total_count && job?.processed_count ? job.total_count - job.processed_count : "the remaining"}</strong> pending lessons from where the batch stalled. Previous results are preserved.</>
              ) : (
                <>This will create a NEW batch job and regenerate PDFs for all lessons. The previous batch will remain in history for reference.</>
              )}
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowConfirmModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={confirmMode === "resume" ? resumeBatch : startBatch}
                className="bg-[#0d7377] hover:bg-[#0a5c5f] text-white"
              >
                {confirmMode === "resume" ? "Resume" : "Start Batch"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Log Modal */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-xl font-bold text-[#2d2d2d]">
                PDF Diagnostics {selectedLessonId && `- Lesson ${selectedLessonId.slice(0, 8)}...`}
              </h2>
              <button onClick={() => setShowLogModal(false)} className="p-1 hover:bg-gray-200 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {logLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-[#0d7377]" />
                </div>
              ) : logData ? (
                <pre className="text-xs bg-gray-100 p-4 rounded overflow-auto whitespace-pre-wrap">
                  {JSON.stringify(logData, null, 2)}
                </pre>
              ) : (
                <p className="text-gray-500">No log data available</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
