"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ChevronUp, ChevronDown, Users, Calendar, Activity, TrendingUp } from "lucide-react";

interface TeacherMetrics {
  id: string;
  name: string;
  email: string;
  role: string;
  enrollment_status: string;
  days_active_last_7: number;
  days_active_last_30: number;
  logins_7d: number;
  logins_30d: number;
  lessons_viewed_7d: number;
  lessons_viewed_30d: number;
  courses_viewed_7d: number;
  courses_viewed_30d: number;
  total_actions_7d: number;
  total_actions_30d: number;
  last_active: string | null;
  is_daily_active: boolean;
  is_weekly_active: boolean;
}

interface Summary {
  totalTeachers: number;
  activeLast7Days: number;
  activeLast30Days: number;
  avgDaysActivePerWeek: number;
  dailyActiveRate: number;
  mostActiveDay: string;
}

interface Pagination {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

type SortField = "name" | "days_active_last_7" | "total_actions_7d" | "last_active" | "logins_7d" | "lessons_viewed_7d";
type SortOrder = "asc" | "desc";

export default function TeacherAnalyticsClientPage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [teachers, setTeachers] = useState<TeacherMetrics[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [sortField, setSortField] = useState<SortField>("days_active_last_7");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [daysFilter, setDaysFilter] = useState<7 | 30 | 90>(7);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        days: daysFilter.toString(),
        sort: sortField,
        order: sortOrder,
        limit: pageSize.toString(),
        offset: ((currentPage - 1) * pageSize).toString(),
      });

      const res = await fetch(`/api/analytics/teacher-activity?${params}`);
      const data = await res.json();

      if (data.error) {
        console.error("Error fetching analytics:", data.error);
        return;
      }

      setSummary(data.summary);
      setTeachers(data.teachers || []);
      setPagination(data.pagination);
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  }, [daysFilter, sortField, sortOrder, currentPage]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
    setCurrentPage(1);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortOrder === "asc" ? (
      <ChevronUp className="w-4 h-4 inline ml-1" />
    ) : (
      <ChevronDown className="w-4 h-4 inline ml-1" />
    );
  };

  const formatLastActive = (dateStr: string | null): string => {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const totalPages = pagination ? Math.ceil(pagination.total / pageSize) : 1;

  if (loading && !summary) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#0d7377]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#2d2d2d]">Teacher Activity Analytics</h1>
            <p className="text-sm text-gray-500">Track teacher engagement and site usage</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={daysFilter}
              onChange={(e) => {
                setDaysFilter(parseInt(e.target.value) as 7 | 30 | 90);
                setCurrentPage(1);
              }}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0d7377]"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <Button
              onClick={() => fetchAnalytics()}
              variant="outline"
              size="sm"
              disabled={loading}
            >
              Refresh
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  <Users className="w-4 h-4" /> Total Teachers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-[#2d2d2d]">{summary.totalTeachers}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Active (7d)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-[#2d2d2d]">{summary.activeLast7Days}</p>
                <p className="text-xs text-gray-500">
                  {summary.totalTeachers > 0
                    ? Math.round((summary.activeLast7Days / summary.totalTeachers) * 100)
                    : 0}% of total
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Active (30d)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-[#2d2d2d]">{summary.activeLast30Days}</p>
                <p className="text-xs text-gray-500">
                  {summary.totalTeachers > 0
                    ? Math.round((summary.activeLast30Days / summary.totalTeachers) * 100)
                    : 0}% of total
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> Avg Days/Week
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-[#2d2d2d]">{summary.avgDaysActivePerWeek}</p>
                <p className="text-xs text-gray-500">For active teachers</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  <Activity className="w-4 h-4" /> Daily Active Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-[#2d2d2d]">{summary.dailyActiveRate}%</p>
                <p className="text-xs text-gray-500">Active today</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Most Active Day</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-[#2d2d2d]">{summary.mostActiveDay}</p>
                <p className="text-xs text-gray-500">Aggregate</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Status Legend */}
        <div className="flex items-center gap-6 mb-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500"></span> Daily Active
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#0d7377]"></span> Weekly Active (4+ days)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-gray-300"></span> Inactive
          </span>
        </div>

        {/* Teachers Table */}
        <div className="bg-white rounded-lg border border-[#e5e5e0] overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("name")}
                >
                  Teacher <SortIcon field="name" />
                </th>
                <th
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("days_active_last_7")}
                >
                  Days Active (7d) <SortIcon field="days_active_last_7" />
                </th>
                <th
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("logins_7d")}
                >
                  Logins (7d) <SortIcon field="logins_7d" />
                </th>
                <th
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("lessons_viewed_7d")}
                >
                  Lessons Viewed (7d) <SortIcon field="lessons_viewed_7d" />
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Courses (7d)
                </th>
                <th
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("total_actions_7d")}
                >
                  Total Actions (7d) <SortIcon field="total_actions_7d" />
                </th>
                <th
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("last_active")}
                >
                  Last Active <SortIcon field="last_active" />
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading && teachers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-[#0d7377] mx-auto" />
                  </td>
                </tr>
              ) : teachers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    No teacher activity data yet. Activity will appear here as teachers use the site.
                  </td>
                </tr>
              ) : (
                teachers.map((teacher) => (
                  <tr key={teacher.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{teacher.name}</p>
                        <p className="text-xs text-gray-500">{teacher.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-medium text-gray-900">
                        {teacher.days_active_last_7}
                      </span>
                      <span className="text-xs text-gray-500 ml-1">/ 7</span>
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-900">
                      {teacher.logins_7d}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-900">
                      {teacher.lessons_viewed_7d}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-900">
                      {teacher.courses_viewed_7d}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-semibold text-[#0d7377]">
                        {teacher.total_actions_7d}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-gray-500">
                      {formatLastActive(teacher.last_active)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {teacher.is_daily_active ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                          Daily
                        </span>
                      ) : teacher.is_weekly_active ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-teal-100 text-teal-800 rounded text-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#0d7377]"></span>
                          Weekly
                        </span>
                      ) : teacher.days_active_last_7 > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-50 text-gray-400 rounded text-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                          Inactive
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {pagination && pagination.total > pageSize && (
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, pagination.total)} of {pagination.total} teachers
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage <= 1}
                >
                  Previous
                </Button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      className={currentPage === pageNum ? "bg-[#0d7377]" : ""}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Info Note */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="text-sm font-medium text-blue-800 mb-2">About Activity Tracking</h3>
          <ul className="text-xs text-blue-700 space-y-1">
            <li>• <strong>Days Active:</strong> Number of unique days with at least one activity (login, page view)</li>
            <li>• <strong>Logins:</strong> Number of times teacher signed into the site</li>
            <li>• <strong>Lessons Viewed:</strong> Number of lesson pages visited</li>
            <li>• <strong>Courses Viewed:</strong> Number of course pages visited</li>
            <li>• <strong>Daily Active:</strong> Teacher had at least one activity today</li>
            <li>• <strong>Weekly Active:</strong> Teacher was active on 4+ days in the last 7 days</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
