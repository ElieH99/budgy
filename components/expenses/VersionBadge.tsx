"use client";

import { cn } from "@/lib/utils";

interface VersionBadgeProps {
  versionNumber: number;
  className?: string;
}

export function VersionBadge({ versionNumber, className }: VersionBadgeProps) {
  if (versionNumber <= 1) {
    return (
      <span className={cn("text-xs text-gray-500 font-mono", className)}>
        Submission v{versionNumber}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5",
        className
      )}
    >
      ↩ Submission v{versionNumber} — Resubmission
    </span>
  );
}
