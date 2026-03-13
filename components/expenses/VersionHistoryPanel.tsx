"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ChevronDown, ChevronRight } from "lucide-react";

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

interface VersionHistoryPanelProps {
  versions: VersionEntry[];
  currentStatus: string;
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

export function VersionHistoryPanel({ versions, currentStatus }: VersionHistoryPanelProps) {
  const [expandedVersions, setExpandedVersions] = useState<Set<number>>(new Set());

  if (versions.length === 0) return null;

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

  return (
    <div>
      <h4 className="text-sm font-semibold mb-3">Version History</h4>
      <div className="space-y-2">
        {versions.map((version, idx) => {
          const isExpanded = expandedVersions.has(version.versionNumber);
          const outcome = getOutcomeLabel(idx, versions.length, currentStatus);

          return (
            <div key={version._id} className="border rounded-md">
              <button
                type="button"
                className="flex items-center justify-between w-full px-4 py-3 text-left hover:bg-muted/50"
                onClick={() => toggle(version.versionNumber)}
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
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
                <div className="px-4 pb-4 pt-0 border-t space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <div>
                      <span className="text-muted-foreground">Amount:</span>{" "}
                      {version.amount.toFixed(2)} {version.currencyCode}
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
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
