"use client";

import { AlertTriangle } from "lucide-react";

interface RejectionBannerProps {
  rejectionReason: string;
  rejectionComment: string;
}

export function RejectionBanner({ rejectionReason, rejectionComment }: RejectionBannerProps) {
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-4 mb-4">
      <div className="flex gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-800">
            Rejected: {rejectionReason}
          </p>
          <p className="text-sm text-amber-700 mt-1">{rejectionComment}</p>
        </div>
      </div>
    </div>
  );
}
