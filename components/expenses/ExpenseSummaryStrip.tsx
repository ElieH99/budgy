"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const ACTIONABLE = ["Draft", "Submitted", "UnderReview", "Rejected"];

interface ExpenseSummaryStripProps {
  selectedStatuses?: string[];
  onStatusClick?: (status: string) => void;
  onTabChange?: (tab: "active" | "resolved") => void;
}

export function ExpenseSummaryStrip({ selectedStatuses = [], onStatusClick, onTabChange }: ExpenseSummaryStripProps = {}) {
  const expenses = useQuery(api.expenses.getMyExpenses);

  const isLoading = expenses === undefined;

  const submitted = expenses?.filter((e) => e.status === "Submitted").length ?? 0;
  const underReview = expenses?.filter((e) => e.status === "UnderReview").length ?? 0;

  const approved = expenses?.filter((e) => e.status === "Approved").length ?? 0;
  const drafts = expenses?.filter((e) => e.status === "Draft").length ?? 0;
  const rejected = expenses?.filter((e) => e.status === "Rejected").length ?? 0;
  const closed = expenses?.filter((e) => e.status === "Closed").length ?? 0;
  const withdrawn = expenses?.filter((e) => e.status === "Withdrawn").length ?? 0;
  const total = expenses?.length ?? 0;

  const segments = [
    { count: submitted, color: "bg-blue-300" },
    { count: underReview, color: "bg-amber-300" },
    { count: drafts, color: "bg-gray-300" },
    { count: approved, color: "bg-green-300" },
    { count: rejected, color: "bg-orange-300" },
    { count: closed, color: "bg-red-300" },
    { count: withdrawn, color: "bg-slate-300" },
  ];

  const handleClick = (status: string) => {
    onTabChange?.(ACTIONABLE.includes(status) ? "active" : "resolved");
    onStatusClick?.(status);
  };

  const isActive = (status: string) => selectedStatuses.includes(status);
  const isClickable = !!onStatusClick;

  type Pill = { status: string; count: number; label: string; classes: string; ring: string };

  const actionable: Pill[] = [
    { status: "Draft",       count: drafts,      label: "Drafts",       classes: "bg-gray-100 text-gray-700 border-gray-200",      ring: "ring-gray-400"   },
    { status: "Submitted",   count: submitted,   label: "Submitted",    classes: "bg-blue-100 text-blue-700 border-blue-200",      ring: "ring-blue-400"   },
    { status: "UnderReview", count: underReview, label: "Under Review", classes: "bg-amber-100 text-amber-700 border-amber-200",   ring: "ring-amber-400"  },
    { status: "Rejected",    count: rejected,    label: "Rejected",     classes: "bg-orange-100 text-orange-700 border-orange-200", ring: "ring-orange-400" },
  ];

  const terminal: Pill[] = [
    { status: "Approved",  count: approved,  label: "Approved",  classes: "bg-green-100 text-green-700 border-green-200", ring: "ring-green-400" },
    { status: "Closed",    count: closed,    label: "Closed",    classes: "bg-red-100 text-red-800 border-red-200",       ring: "ring-red-400"   },
    { status: "Withdrawn", count: withdrawn, label: "Withdrawn", classes: "bg-slate-100 text-slate-600 border-slate-200", ring: "ring-slate-400" },
  ];

  const renderPill = ({ status, count, label, classes, ring }: Pill) =>
    count === 0 ? null : (
      <Badge
        key={status}
        variant="outline"
        className={cn(
          "text-xs px-2 py-0.5 font-medium",
          classes,
          isClickable && "cursor-pointer hover:opacity-80 transition-opacity",
          isActive(status) && `ring-2 ring-offset-1 ${ring}`
        )}
        onClick={() => handleClick(status)}
      >
        {count} {label}
      </Badge>
    );

  const hasActionable = actionable.some((p) => p.count > 0);
  const hasTerminal = terminal.some((p) => p.count > 0);

  return (
    <div className="rounded-xl border border-border bg-white px-5 py-3">
      <div className="flex items-center gap-2 flex-wrap">
        {isLoading ? (
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-5 w-18 rounded-full" />
          </div>
        ) : total === 0 ? (
          <span className="text-sm text-muted-foreground">No expenses yet — submit your first ticket to get started.</span>
        ) : (
          <>
            {/* Actionable statuses */}
            {hasActionable && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {actionable.map(renderPill)}
              </div>
            )}

            {/* Divider — only shown when both groups have visible pills */}
            {hasActionable && hasTerminal && (
              <div className="h-4 w-px bg-border mx-1 shrink-0" />
            )}

            {/* Terminal statuses */}
            {hasTerminal && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {terminal.map(renderPill)}
              </div>
            )}
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
