"use client";

import { format } from "date-fns";
import { type ExpenseStatus } from "@/lib/constants";
import { StatusBadge } from "./StatusBadge";
import { VersionBadge } from "./VersionBadge";

interface HistoryEntry {
  _id: string;
  changedAt: number;
  changedByName: { firstName: string; lastName: string };
  oldStatus: string;
  newStatus: string;
  comment?: string;
  versionNumber: number;
}

interface StatusTimelineProps {
  history: HistoryEntry[];
}

export function StatusTimeline({ history }: StatusTimelineProps) {
  if (history.length === 0) return null;

  return (
    <div className="space-y-0">
      <h4 className="text-base font-semibold text-gray-900 mb-3">Status Timeline</h4>
      <div className="relative space-y-0">
        {history.map((entry) => (
          <div
            key={entry._id}
            className="relative pl-6 border-l-2 border-gray-200 pb-4 last:pb-0"
          >
            <div className="absolute -left-1.5 top-1 w-3 h-3 rounded-full bg-gray-300" />
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-xs text-gray-400 whitespace-nowrap">
                {format(new Date(entry.changedAt), "dd MMM yyyy, HH:mm")}
              </span>
              <span className="text-sm text-gray-700">
                <span className="font-medium">
                  {entry.changedByName.firstName} {entry.changedByName.lastName}
                </span>
                {" "}
                {entry.oldStatus ? "changed status" : "created"}
              </span>
              <VersionBadge versionNumber={entry.versionNumber} />
            </div>
            {entry.oldStatus && (
              <div className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                <StatusBadge status={entry.oldStatus as ExpenseStatus} />
                <span>→</span>
                <StatusBadge status={entry.newStatus as ExpenseStatus} />
              </div>
            )}
            {!entry.oldStatus && (
              <div className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                <StatusBadge status={entry.newStatus as ExpenseStatus} />
              </div>
            )}
            {entry.comment && (
              <p className="mt-1 text-sm text-gray-600 bg-gray-50 rounded p-2 border border-gray-100">
                &ldquo;{entry.comment}&rdquo;
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
