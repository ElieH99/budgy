"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ChevronDown, ChevronRight } from "lucide-react";
import { formatAmount } from "@/lib/utils";

interface VersionEntry {
  _id: string;
  versionNumber: number;
  title: string;
  description: string;
  amount: number;
  currencyCode: string;
  categoryName: string;
  expenseDate: number;
  notes?: string;
  receiptStorageId: string;
  submittedAt: number;
}

interface HistoryEntry {
  versionNumber: number;
  newStatus: string;
  comment?: string;
}

interface VersionHistoryPanelProps {
  versions: VersionEntry[];
  currentStatus: string;
  history?: HistoryEntry[];
}

function getOutcomeLabel(versionIndex: number, totalVersions: number, currentStatus: string): string {
  if (versionIndex === totalVersions - 1) {
    if (currentStatus === "Approved") return "Approved";
    if (currentStatus === "Closed") return "Closed";
    if (currentStatus === "Rejected") return "Rejected";
    return "Pending";
  }
  return "Rejected";
}

export function VersionHistoryPanel({ versions, currentStatus, history = [] }: VersionHistoryPanelProps) {
  // Build a map from versionNumber → rejection/close history event
  const versionOutcomeMap = new Map<number, HistoryEntry>();
  for (const entry of history) {
    if (entry.newStatus === "Rejected" || entry.newStatus === "Closed") {
      versionOutcomeMap.set(entry.versionNumber, entry);
    }
  }
  const [expandedVersions, setExpandedVersions] = useState<Set<number>>(new Set());

  if (versions.length === 0) return null;

  if (versions.length === 1) {
    return (
      <div>
        <h4 className="text-sm font-semibold mb-3">Version History</h4>
        <p className="text-xs text-muted-foreground py-2 px-1">
          First submission — no prior versions.
        </p>
      </div>
    );
  }

  const toggle = (versionNumber: number) => {
    setExpandedVersions((prev) => {
      const next = new Set(prev);
      if (next.has(versionNumber)) {
        next.delete(versionNumber);
      } else {
        next.add(versionNumber);
      }
      return next;
    });
  };

  const sortedVersions = [...versions].sort((a, b) => b.versionNumber - a.versionNumber);

  return (
    <div>
      <h4 className="text-sm font-semibold mb-3">Version History</h4>
      <div className="space-y-2">
        {sortedVersions.map((version) => {
          const isExpanded = expandedVersions.has(version.versionNumber);
          const isLatest = version.versionNumber === versions.length;
          const outcome = isLatest
            ? getOutcomeLabel(versions.length - 1, versions.length, currentStatus)
            : "Rejected";
          const outcomeEntry = versionOutcomeMap.get(version.versionNumber);

          return (
            <div key={version._id} className="border rounded-md">
              <button
                type="button"
                className="flex items-center justify-between w-full px-4 py-3 text-left hover:bg-muted/50"
                onClick={() => toggle(version.versionNumber)}
                aria-expanded={isExpanded}
                aria-controls={`version-panel-${version.versionNumber}`}
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  )}
                  <span className="text-sm font-medium">
                    v{version.versionNumber}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(version.submittedAt), "dd MMM yyyy")}
                  </span>
                </div>
                <span className="text-xs font-medium text-muted-foreground">
                  {outcome}
                </span>
              </button>

              {isExpanded && (
                <div id={`version-panel-${version.versionNumber}`} className="px-4 pb-4 pt-0 border-t space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <div>
                      <span className="text-muted-foreground">Amount:</span>{" "}
                      {formatAmount(version.amount / 100)} {version.currencyCode}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Category:</span>{" "}
                      {version.categoryName}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Expense Date:</span>{" "}
                      {format(new Date(version.expenseDate), "dd MMM yyyy")}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Description:</span>{" "}
                    {version.description}
                  </div>
                  {version.notes && (
                    <div>
                      <span className="text-muted-foreground">Notes:</span>{" "}
                      {version.notes}
                    </div>
                  )}
                  {outcomeEntry && outcomeEntry.comment && (
                    <div className={`border-l-4 px-3 py-2 rounded-r-md mt-2 ${outcomeEntry.newStatus === "Rejected" ? "border-amber-400 bg-amber-50" : "border-red-400 bg-red-50"}`}>
                      <p className="text-sm italic text-muted-foreground">{outcomeEntry.comment}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
