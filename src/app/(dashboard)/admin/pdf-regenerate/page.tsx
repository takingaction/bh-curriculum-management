"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { X, ExternalLink, FileText, CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";

interface BatchJob {
  id: string;
  status: "pending" | "processing" | "completed";
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
  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedError, setSelectedError] = useState<string | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [logData, setLogData] = useState<any>(null);
  const [logLoading, setLogLoading] = useState(false);
  const processingRef = useRef(false);
  const processingQueueRef = useRef<string[]>([]);
  const processedRef = useRef<Set<string>>(new Set());

  // Fetch current job status
  const fetchCurrentJob = useCallback(async () => {
    try {
      const res = await fetch("/api/batch/current");
      const data = await res.json();
      if (data.job) {
        setJob(data.job);
        setIsRunning(data.isRunning);
        if (data.isRunning) {
          processingRef.current = true;
        }
      } else {
        setJob(null);
        setIsRunning(false);
      }
    } catch (error) {
      console.error("Error fetching job:", error);
    }
  }, []);

  // Fetch results with pagination
  const fetchResults = useCallback(async (page: number = 1, filter: "all" | "success" | "failed" = "all") => {
    if (!job) return;
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: "20",
      });
      if (filter !== "all") {
        params.set("status", filter);
      }
      const res = await fetch(`/api/batch/${job.id}?${params}`);
      const data = await res.json();
      setResults(data.results || []);
      setPagination(data.pagination);
    } catch (error) {
      console.error("Error fetching results:", error);
    }
  }, [job]);

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

  // Poll for updates while running
  useEffect(() => {
    if (!job || job.status !== "processing") return;

    const pollInterval = setInterval(async () => {
      await fetchCurrentJob();
      await fetchResults(pagination?.page || 1, statusFilter);
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [job?.status, pagination?.page, statusFilter, fetchCurrentJob, fetchResults]);

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

  // Start batch process
  const startBatch = async () => {
    setShowConfirmModal(false);
    setLoading(true);

    try {
      // Start the batch job
      const res = await fetch("/api/batch/pdf-regenerate", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Failed to start batch");
        setLoading(false);
        return;
      }

      const { jobId, totalCount } = data;
      processingRef.current = true;
      processingQueueRef.current = [];

      // Fetch all lessons
      const lessonsRes = await fetch("/api/lessons");
      const lessonsData = await lessonsRes.json();
      const lessonIds = (lessonsData.lessons as any[])?.map((l) => l.id as string) || [];
      processingQueueRef.current = [...new Set(lessonIds)] as string[]; // Deduplicate

      // Re-fetch job to get updated state
      await fetchCurrentJob();

      setIsRunning(true);
      processingRef.current = true;

      // Process sequentially
      for (const lessonId of processingQueueRef.current) {
        if (!processingRef.current) break;
        if (processedRef.current.has(lessonId)) continue;

        const result = await processLesson(lessonId, jobId);
        await submitResult(jobId, lessonId, result.success, result.error);
        processedRef.current.add(lessonId);

        // Refresh data
        await fetchCurrentJob();
        await fetchResults(pagination?.page || 1, statusFilter);
      }

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
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-[#2d2d2d]">Batch PDF Regeneration</h1>
          {!isRunning && job?.status !== "completed" && (
            <Button
              onClick={() => setShowConfirmModal(true)}
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
          {job?.status === "processing" && !isRunning && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-red-600">Stuck job detected</span>
              <Button
                onClick={async () => {
                  await fetch("/api/batch/clear-stuck", { method: "POST" });
                  await fetchCurrentJob();
                }}
                variant="outline"
                size="sm"
                className="border-red-600 text-red-600 hover:bg-red-50"
              >
                Clear Stuck Job
              </Button>
            </div>
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
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span className="text-sm text-gray-700">{job.success_count} Success</span>
              </div>
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-600" />
                <span className="text-sm text-gray-700">{job.failure_count} Failed</span>
              </div>
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
            <h2 className="text-xl font-bold text-[#2d2d2d] mb-4">Confirm Batch Regeneration</h2>
            <p className="text-gray-600 mb-6">
              This will regenerate PDFs for all 720 lessons. This may take several hours. Continue?
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowConfirmModal(false)}>
                Cancel
              </Button>
              <Button onClick={startBatch} className="bg-[#0d7377] hover:bg-[#0a5c5f] text-white">
                Start Batch
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
