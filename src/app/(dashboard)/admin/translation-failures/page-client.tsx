"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, AlertTriangle } from "lucide-react";

interface TranslationFailure {
  id: string;
  user_id: string;
  lesson_id: string;
  batch_number: number;
  failed_fields: string[];
  error_type: string;
  error_message: string | null;
  ai_response_length: number | null;
  created_at: string;
  user_email?: string;
  lesson_title?: string;
}

export default function TranslationFailuresClientPage() {
  const [failures, setFailures] = useState<TranslationFailure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFailures = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/translation-failures");
      if (!res.ok) {
        throw new Error("Failed to fetch translation failures");
      }
      const data = await res.json();
      setFailures(data.failures || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFailures();
  }, [fetchFailures]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#0d7377]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="w-12 h-12 mx-auto text-red-500 mb-4" />
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Error</h2>
        <p className="text-gray-600">{error}</p>
        <button
          onClick={fetchFailures}
          className="mt-4 px-4 py-2 bg-[#0d7377] text-white rounded-md hover:bg-[#0a5c5f] transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Translation Failures</h1>
        <p className="text-sm text-gray-500 mt-1">
          Log of failed translation attempts for debugging purposes
        </p>
      </div>

      {failures.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">No translation failures recorded yet.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {failures.length} Failure{failures.length !== 1 ? "s" : ""} Recorded
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 font-medium text-gray-600">Date</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">User</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">Lesson</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">Batch</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">Error Type</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">Failed Fields</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">AI Response</th>
                  </tr>
                </thead>
                <tbody>
                  {failures.map((failure) => (
                    <tr key={failure.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-3 text-gray-900">
                        {formatDate(failure.created_at)}
                      </td>
                      <td className="py-2 px-3 text-gray-700 max-w-[150px] truncate">
                        {failure.user_email || failure.user_id}
                      </td>
                      <td className="py-2 px-3 text-gray-700 max-w-[200px] truncate">
                        {failure.lesson_title || failure.lesson_id}
                      </td>
                      <td className="py-2 px-3 text-gray-700">
                        {failure.batch_number}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            failure.error_type === "truncation"
                              ? "bg-orange-100 text-orange-700"
                              : failure.error_type === "network_error"
                              ? "bg-red-100 text-red-700"
                              : failure.error_type === "api_error"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {failure.error_type}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-gray-700 max-w-[200px]">
                        <div className="flex flex-wrap gap-1">
                          {failure.failed_fields.map((field, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 bg-red-50 text-red-700 rounded text-xs"
                            >
                              {field}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-gray-700">
                        {failure.ai_response_length
                          ? `${(failure.ai_response_length / 1024).toFixed(1)} KB`
                          : "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
