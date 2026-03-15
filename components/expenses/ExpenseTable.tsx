"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { type ExpenseStatus } from "@/lib/constants";
import { formatAmount } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { StatusBadge } from "./StatusBadge";
import { AmountRangeSlider } from "@/components/ui/amount-range-slider";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { type DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { CategoryFilter } from "@/components/ui/category-filter";
import { StatusFilter } from "@/components/ui/status-filter";

interface ExpenseRow {
  _id: Id<"expenses">;
  title: string;
  amount: number;
  currencyCode: string;
  categoryId?: Id<"categories">;
  status: string;
  updatedAt: number;
  expenseDate?: number;
}

interface ExpenseTableProps {
  onRowClick: (expenseId: Id<"expenses">, index: number) => void;
  onQueueChange?: (queue: Id<"expenses">[]) => void;
  /** Controlled multi-select status filter. Empty array = no filter. */
  selectedStatuses?: string[];
  onSelectedStatusesChange?: (statuses: string[]) => void;
  allowedStatuses?: string[];
}

export function ExpenseTable({ onRowClick, onQueueChange, selectedStatuses: selectedStatusesProp, onSelectedStatusesChange, allowedStatuses }: ExpenseTableProps) {
  const expenses = useQuery(api.expenses.getMyExpenses);
  const categories = useQuery(api.categories.listCategories);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "updatedAt", desc: true },
  ]);

  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [internalSelectedStatuses, setInternalSelectedStatuses] = useState<string[]>([]);
  const selectedStatuses = selectedStatusesProp ?? internalSelectedStatuses;
  const setSelectedStatuses = onSelectedStatusesChange ?? setInternalSelectedStatuses;
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  const amountBounds = useMemo(() => {
    if (!expenses || expenses.length === 0) return { min: 0, max: 5000 };
    const amounts = expenses.map((e) => e.amount ?? 0);
    return { min: 0, max: Math.ceil(Math.max(...amounts) / 100) * 100 || 5000 };
  }, [expenses]);

  const [amountRange, setAmountRange] = useState<[number, number] | null>(null);

  // Effective slider values (fall back to bounds when null = no filter)
  const sliderValue: [number, number] = amountRange ?? [amountBounds.min, amountBounds.max];

  const categoryMap = useMemo(() => {
    if (!categories) return {};
    const map: Record<string, string> = {};
    categories.forEach((c: { _id: string; name: string }) => {
      map[c._id] = c.name;
    });
    return map;
  }, [categories]);

  const filteredData = useMemo(() => {
    if (!expenses) return [];
    return expenses.filter((e) => {
      if (selectedCategories.length > 0) {
        const catName = e.categoryId ? categoryMap[e.categoryId] : undefined;
        if (!catName || !selectedCategories.includes(catName)) return false;
      }
      if (allowedStatuses && !allowedStatuses.includes(e.status)) return false;
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(e.status)) return false;
      if (amountRange) {
        if (e.amount < amountRange[0] || e.amount > amountRange[1]) return false;
      }
      if (dateRange?.from) {
        const date = e.expenseDate ?? e.updatedAt;
        const to = dateRange.to ?? dateRange.from;
        if (date < dateRange.from.getTime()) return false;
        if (date > to.getTime() + 86400000 - 1) return false;
      }
      return true;
    });
  }, [expenses, selectedCategories, categoryMap, selectedStatuses, amountRange, dateRange, allowedStatuses]);

  const columns = useMemo<ColumnDef<ExpenseRow>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Title",
        cell: ({ row }) => (
          <HoverCard openDelay={400} closeDelay={100}>
            <HoverCardTrigger asChild>
              <button
                type="button"
                className="text-sm font-medium text-gray-900 hover:text-indigo-600 transition-colors text-left truncate max-w-[200px]"
                onClick={(e) => e.stopPropagation()}
              >
                {row.original.title || "Untitled"}
              </button>
            </HoverCardTrigger>
            <HoverCardContent className="w-72" align="start">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <StatusBadge status={row.original.status as ExpenseStatus} />
                </div>
                <div className="text-sm font-medium text-gray-900 line-clamp-2">
                  {row.original.title || "Untitled"}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{row.original.categoryId ? categoryMap[row.original.categoryId] ?? "—" : "—"}</span>
                  <span>·</span>
                  <span className="font-medium text-gray-700">
                    {row.original.amount?.toFixed(2)} {row.original.currencyCode}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Updated {formatDistanceToNow(new Date(row.original.updatedAt), { addSuffix: true })}
                </p>
              </div>
            </HoverCardContent>
          </HoverCard>
        ),
      },
      {
        accessorKey: "categoryId",
        header: "Category",
        cell: ({ row }) =>
          row.original.categoryId
            ? categoryMap[row.original.categoryId] ?? "—"
            : "—",
      },
      {
        accessorKey: "amount",
        header: () => <div className="text-right">Amount</div>,
        cell: ({ row }) => (
          <div className="text-right tabular-nums">
            {row.original.amount
              ? `${formatAmount(row.original.amount)} ${row.original.currencyCode}`
              : "—"}
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <StatusBadge status={row.original.status as ExpenseStatus} />
        ),
      },
      {
        accessorKey: "expenseDate",
        header: "Expense Date",
        cell: ({ row }) =>
          row.original.expenseDate
            ? format(new Date(row.original.expenseDate), "dd MMM yyyy")
            : "—",
      },
      {
        accessorKey: "updatedAt",
        header: "Last Updated",
        cell: ({ row }) =>
          formatDistanceToNow(new Date(row.original.updatedAt), {
            addSuffix: true,
          }),
      },
    ],
    [categoryMap]
  );

  const table = useReactTable({
    data: filteredData as ExpenseRow[],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  // Keep parent in sync with the current sorted+filtered order
  useEffect(() => {
    onQueueChange?.(table.getRowModel().rows.map((r) => r.original._id));
  }, [filteredData, sorting, onQueueChange]); // eslint-disable-line react-hooks/exhaustive-deps

  if (expenses === undefined) {
    return (
      <div className="space-y-3" role="status" aria-label="Loading expenses">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-4 w-28" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Category */}
        <CategoryFilter
          selectedCategories={selectedCategories}
          onSelectionChange={setSelectedCategories}
          categories={categories?.map((c: { name: string }) => c.name) ?? []}
        />

        {/* Status */}
        <StatusFilter
          selectedStatuses={selectedStatuses}
          onSelectionChange={setSelectedStatuses}
          allowedStatuses={allowedStatuses ? [...allowedStatuses] : undefined}
        />

        {/* Amount range slider */}
        <AmountRangeSlider
          min={amountBounds.min}
          max={amountBounds.max}
          value={sliderValue}
          onValueChange={(v) => setAmountRange(v)}
          onReset={() => setAmountRange(null)}
        />

        {/* Date range + Reset all */}
        <div className="flex items-center gap-2">
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
            placeholder="Filter by expense date"
            className="w-[260px]"
          />
          {dateRange && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDateRange(undefined)}
            >
              Clear
            </Button>
          )}
          {(selectedCategories.length > 0 || selectedStatuses.length > 0 || amountRange !== null || !!dateRange) && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => {
                setSelectedCategories([]);
                setSelectedStatuses([]);
                setInternalSelectedStatuses([]);
                setAmountRange(null);
                setDateRange(undefined);
              }}
            >
              Reset filters
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 shadow-sm bg-white overflow-x-auto">
        <table className="w-full" aria-label="My expenses">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b-2 border-gray-200 bg-slate-100">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-6 py-3 text-left text-sm font-semibold text-gray-700 cursor-pointer select-none"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === "asc" ? " ↑" : ""}
                      {header.column.getIsSorted() === "desc" ? " ↓" : ""}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-muted-foreground">
                  No expenses match the current filters.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row, idx) => (
                <tr
                  key={row.id}
                  className="border-b border-gray-200 odd:bg-white even:bg-slate-100/50 hover:bg-indigo-50/40 cursor-pointer transition-colors"
                  onClick={() => onRowClick(row.original._id, idx)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-6 py-3 text-sm">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
