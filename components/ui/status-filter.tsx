"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { STATUS_DISPLAY_LABELS, type ExpenseStatus } from "@/lib/constants";

// Status badge colours matching the design system
const STATUS_CLASSES: Record<string, string> = {
  Draft:       "bg-gray-100 text-gray-700",
  Submitted:   "bg-blue-100 text-blue-700",
  UnderReview: "bg-amber-100 text-amber-700",
  Approved:    "bg-green-100 text-green-700",
  Rejected:    "bg-orange-100 text-orange-700",
  Closed:      "bg-red-100 text-red-800",
  Withdrawn:   "bg-slate-100 text-slate-600",
};

interface StatusFilterProps {
  /** Currently selected statuses. Empty array = no filter (all). */
  selectedStatuses: string[];
  onSelectionChange: (selected: string[]) => void;
  /** Subset of statuses to show; defaults to all. */
  allowedStatuses?: string[];
}

export function StatusFilter({
  selectedStatuses,
  onSelectionChange,
  allowedStatuses,
}: StatusFilterProps) {
  const [open, setOpen] = React.useState(false);

  const statuses: string[] = allowedStatuses ?? Object.keys(STATUS_DISPLAY_LABELS);

  function handleToggle(status: string) {
    const next = selectedStatuses.includes(status)
      ? selectedStatuses.filter((s) => s !== status)
      : [...selectedStatuses, status];
    onSelectionChange(next);
  }

  const count = selectedStatuses.length;

  let triggerLabel: React.ReactNode;
  if (count === 0) {
    triggerLabel = <span className="text-sm">All Statuses</span>;
  } else if (count === 1) {
    const s = selectedStatuses[0];
    triggerLabel = (
      <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", STATUS_CLASSES[s] ?? "bg-gray-100 text-gray-700")}>
        {STATUS_DISPLAY_LABELS[s as ExpenseStatus] ?? s}
      </span>
    );
  } else {
    triggerLabel = (
      <span className="flex items-center gap-1.5 text-sm">
        Status
        <span className="bg-blue-600 text-white text-xs font-medium rounded-full px-1.5 py-0.5 leading-none">
          {count}
        </span>
      </span>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-10 items-center justify-between gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
            "min-w-[160px]"
          )}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          {triggerLabel}
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-0" align="start">
        <Command>
          <CommandList>
            {statuses.map((status) => {
              const checked = selectedStatuses.includes(status);
              const label = STATUS_DISPLAY_LABELS[status as ExpenseStatus] ?? status;
              return (
                <CommandItem
                  key={status}
                  onSelect={() => handleToggle(status)}
                  className="flex items-center gap-2 px-3 py-2"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => handleToggle(status)}
                    aria-label={label}
                    className="pointer-events-none"
                  />
                  <span
                    className={cn(
                      "text-xs font-medium px-2 py-0.5 rounded-full",
                      STATUS_CLASSES[status] ?? "bg-gray-100 text-gray-700"
                    )}
                  >
                    {label}
                  </span>
                </CommandItem>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
