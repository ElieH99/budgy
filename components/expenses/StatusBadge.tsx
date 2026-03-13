"use client";

import { Badge } from "@/components/ui/badge";
import { type ExpenseStatus, STATUS_DISPLAY_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<ExpenseStatus, string> = {
  Draft: "bg-gray-100 text-gray-700 border-gray-200",
  Submitted: "bg-blue-100 text-blue-700 border-blue-200",
  UnderReview: "bg-amber-100 text-amber-700 border-amber-200",
  Approved: "bg-green-100 text-green-700 border-green-200",
  Rejected: "bg-orange-100 text-orange-700 border-orange-200",
  Closed: "bg-red-100 text-red-800 border-red-200",
  Withdrawn: "bg-slate-100 text-slate-600 border-slate-200",
};

interface StatusBadgeProps {
  status: ExpenseStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const label = STATUS_DISPLAY_LABELS[status];
  return (
    <Badge
      className={cn(STATUS_COLORS[status], className)}
      aria-label={`Status: ${label}`}
    >
      {label}
    </Badge>
  );
}
