"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

interface ManagerSummaryStripProps {
  activeTab?: string;
  activeHistoryStatuses?: string[];
  onStatusClick?: (status: string, tab: "pending" | "history") => void;
}

export function ManagerSummaryStrip({ activeTab, activeHistoryStatuses = [], onStatusClick }: ManagerSummaryStripProps = {}) {
  const stats = useQuery(api.expenses.getManagerStats);

  const isLoading = stats === undefined;

  const pending = stats?.pending ?? 0;
  const approvedBudget = stats?.approvedBudgetThisMonth ?? 0;
  const approvedCount = stats?.approvedThisMonth ?? 0;
  const rejectedCount = stats?.rejectedThisMonth ?? 0;
  const closedCount = stats?.closedCount ?? 0;
  const submittedCount = stats?.submittedCount ?? 0;
  const underReviewCount = stats?.underReviewCount ?? 0;
  const total = stats?.totalUnderManagement ?? 0;

  // Segmented bar: submitted (blue), under review / pending (amber), approved (green), rejected (orange), closed (red), rest (gray)
  const rest = Math.max(0, total - submittedCount - underReviewCount - approvedCount - rejectedCount - closedCount);
  const segments = [
    { count: submittedCount, color: "bg-blue-300" },
    { count: underReviewCount, color: "bg-amber-300" },
    { count: approvedCount, color: "bg-green-300" },
    { count: rejectedCount, color: "bg-orange-300" },
    { count: closedCount, color: "bg-red-300" },
    { count: rest, color: "bg-gray-200" },
  ];

  const isClickable = !!onStatusClick;

  const isPendingActive = activeTab === "pending";
  const isHistoryStatus = (status: string) => activeTab === "history" && activeHistoryStatuses.includes(status);

  return (
    <div className="rounded-xl border border-border bg-white px-5 py-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {isLoading ? (
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-5 w-22 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        ) : total === 0 ? (
          <span className="text-sm text-muted-foreground">No expenses under management yet — they will appear here once employees start submitting.</span>
        ) : (
          <>
            {/* Badges: Submitted → Pending (Under Review) → Approved → Rejected → Closed */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  "bg-blue-100 text-blue-700 border-blue-200 font-medium",
                  isClickable && "cursor-pointer hover:opacity-80 transition-opacity",
                  isPendingActive && "ring-2 ring-offset-1 ring-blue-400"
                )}
                onClick={() => onStatusClick?.("all", "pending")}
              >
                {submittedCount} Submitted
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  "bg-amber-100 text-amber-700 border-amber-200 font-semibold",
                  isClickable && "cursor-pointer hover:opacity-80 transition-opacity",
                  isPendingActive && "ring-2 ring-offset-1 ring-amber-400"
                )}
                onClick={() => onStatusClick?.("all", "pending")}
              >
                {pending} Pending
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  "bg-green-100 text-green-700 border-green-200 font-medium",
                  isClickable && "cursor-pointer hover:opacity-80 transition-opacity",
                  isHistoryStatus("Approved") && "ring-2 ring-offset-1 ring-green-400"
                )}
                onClick={() => onStatusClick?.("Approved", "history")}
              >
                {approvedCount} Approved
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  "bg-orange-100 text-orange-700 border-orange-200 font-medium",
                  isClickable && "cursor-pointer hover:opacity-80 transition-opacity",
                  isHistoryStatus("Rejected") && "ring-2 ring-offset-1 ring-orange-400"
                )}
                onClick={() => onStatusClick?.("Rejected", "history")}
              >
                {rejectedCount} Rejected
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  "bg-red-100 text-red-800 border-red-200 font-medium",
                  isClickable && "cursor-pointer hover:opacity-80 transition-opacity",
                  isHistoryStatus("Closed") && "ring-2 ring-offset-1 ring-red-400"
                )}
                onClick={() => onStatusClick?.("Closed", "history")}
              >
                {closedCount} Closed
              </Badge>
            </div>

            {/* Separator */}
            <div className="h-4 w-px bg-border" />

            {/* Approved budget this month */}
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <DollarSign className="h-4 w-4 text-green-600 shrink-0" />
              <span>
                <span className="font-semibold text-green-700">
                  ${approvedBudget.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>{" "}
                approved this month
              </span>
            </div>
          </>
        )}

        {/* Total — pushed to far right */}
        {!isLoading && total > 0 && (
          <div className="ml-auto text-sm text-muted-foreground whitespace-nowrap">
            {total} total expense{total !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Segmented bar */}
      {isLoading ? (
        <div className="mt-2.5">
          <Skeleton className="h-1 w-full rounded-full" />
        </div>
      ) : total > 0 ? (
        <div className="mt-2.5 h-1 rounded-full overflow-hidden flex gap-0.5">
          {segments.map((seg, i) =>
            seg.count > 0 ? (
              <div
                key={i}
                className={cn("rounded-full", seg.color)}
                style={{ width: `${(seg.count / total) * 100}%` }}
              />
            ) : null
          )}
        </div>
      ) : null}
    </div>
  );
}
