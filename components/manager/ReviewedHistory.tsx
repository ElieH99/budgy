"use client";

import { useMemo, useRef, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { type ExpenseStatus } from "@/lib/constants";
import { formatAmount } from "@/lib/utils";
import { format } from "date-fns";
import { StatusBadge } from "@/components/expenses/StatusBadge";
import { ReviewModal } from "./ReviewModal";
import { Input } from "@/components/ui/input";
import { AmountRangeSlider } from "@/components/ui/amount-range-slider";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { type DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { History } from "lucide-react";
import { CategoryFilter } from "@/components/ui/category-filter";
import { StatusFilter } from "@/components/ui/status-filter";

interface HistoryRow {
  _id: Id<"expenses">;
  submitterName: string;
  title: string;
  amount: number;
  currencyCode: string;
  categoryId?: Id<"categories">;
  status: string;
  updatedAt: number;
  approvedAt?: number;
  rejectedAt?: number;
  closedAt?: number;
}

interface ReviewedHistoryProps {
  /** Controlled multi-select status filter. Empty array = no filter. */
  selectedStatuses?: string[];
  onSelectedStatusesChange?: (statuses: string[]) => void;
}

export function ReviewedHistory({ selectedStatuses: selectedStatusesProp, onSelectedStatusesChange }: ReviewedHistoryProps = {}) {
  const categories = useQuery(api.categories.listCategories);

  const [internalSelectedStatuses, setInternalSelectedStatuses] = useState<string[]>([]);
  const selectedStatuses = selectedStatusesProp ?? internalSelectedStatuses;
  const setSelectedStatuses = onSelectedStatusesChange ?? setInternalSelectedStatuses;
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [nameSearch, setNameSearch] = useState("");
  const [amountRange, setAmountRange] = useState<[number, number] | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [sorting, setSorting] = useState<SortingState>([
    { id: "decidedOn", desc: true },
  ]);
  const [reviewExpenseId, setReviewExpenseId] = useState<Id<"expenses"> | null>(null);

  const reviewed = useQuery(api.expenses.getReviewedHistory, {});

  const hasLoadedOnce = useRef(false);
  if (reviewed !== undefined) {
    hasLoadedOnce.current = true;
  }

  const amountBounds = useMemo(() => {
    if (!reviewed || reviewed.length === 0) return { min: 0, max: 5000 };
    // amounts are stored in cents; compute slider bounds in dollars
    const amounts = reviewed.map((e: { amount: number }) => (e.amount ?? 0) / 100);
    return { min: 0, max: Math.ceil(Math.max(...amounts) / 100) * 100 || 5000 };
  }, [reviewed]);

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
    if (!reviewed) return [];
    return reviewed.filter((r: { status: string; submitterName: string; amount: number; categoryId?: string; approvedAt?: number; rejectedAt?: number; closedAt?: number; updatedAt: number }) => {
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(r.status)) return false;
      if (nameSearch && !r.submitterName.toLowerCase().includes(nameSearch.toLowerCase())) return false;
      if (selectedCategories.length > 0) {
        const catName = r.categoryId ? categoryMap[r.categoryId] : undefined;
        if (!catName || !selectedCategories.includes(catName)) return false;
      }
      if (amountRange) {
        const amountDollars = (r.amount ?? 0) / 100;
        if (amountDollars < amountRange[0] || amountDollars > amountRange[1]) return false;
      }
      const decidedAt = r.approvedAt ?? r.rejectedAt ?? r.closedAt ?? r.updatedAt;
      if (dateRange?.from) {
        const to = dateRange.to ?? dateRange.from;
        if (decidedAt < dateRange.from.getTime()) return false;
        if (decidedAt > to.getTime() + 86400000 - 1) return false;
      }
      return true;
    });
  }, [reviewed, selectedStatuses, nameSearch, selectedCategories, categoryMap, amountRange, dateRange]);

  const columns = useMemo<ColumnDef<HistoryRow>[]>(
    () => [
      {
        accessorKey: "submitterName",
        header: "Employee Name",
        cell: ({ row }) => <span className="font-medium">{row.original.submitterName}</span>,
      },
      {
        accessorKey: "title",
        header: "Ticket Title",
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
        header: "Amount",
        cell: ({ row }) =>
          `${formatAmount(row.original.amount / 100)} ${row.original.currencyCode}`,
      },
      {
        accessorKey: "status",
        header: "Decision",
        cell: ({ row }) => (
          <div className="whitespace-nowrap">
            <StatusBadge status={row.original.status as ExpenseStatus} />
          </div>
        ),
      },
      {
        id: "decidedOn",
        header: "Decided On",
        accessorFn: (row) =>
          row.approvedAt ?? row.rejectedAt ?? row.closedAt ?? row.updatedAt,
        cell: ({ getValue }) =>
          format(new Date(getValue<number>()), "dd MMM yyyy"),
      },
    ],
    [categoryMap]
  );

  const table = useReactTable({
    data: filteredData as HistoryRow[],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  if (reviewed === undefined && !hasLoadedOnce.current) {
    return (
      <div className="space-y-3 mt-4" role="status" aria-label="Loading reviewed expenses">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    );
  }

  const isRefetching = reviewed === undefined && hasLoadedOnce.current;

  if (reviewed !== undefined && reviewed.length === 0) {
    return (
      <div className="py-12 flex flex-col items-center text-center text-muted-foreground">
        <History className="w-8 h-8 mb-3 text-gray-300" />
        <p className="text-sm font-medium text-gray-600">No actioned expenses yet</p>
        <p className="text-xs mt-1">
          Expenses you approve, reject, or close will appear here.
        </p>
      </div>
    );
  }

  const hasActiveFilters = selectedStatuses.length > 0 || selectedCategories.length > 0 || nameSearch !== "" || amountRange !== null || !!dateRange;

  const resetAllFilters = () => {
    setSelectedStatuses([]);
    setInternalSelectedStatuses([]);
    setSelectedCategories([]);
    setNameSearch("");
    setAmountRange(null);
    setDateRange(undefined);
  };

  return (
    <>
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mt-4 mb-2">
        {/* Name search */}
        <label htmlFor="history-name-search" className="sr-only">Search by employee name</label>
        <Input
          id="history-name-search"
          placeholder="Search by employee name..."
          value={nameSearch}
          onChange={(e) => setNameSearch(e.target.value)}
          className="w-56 focus-visible:ring-0 focus-visible:ring-offset-0"
        />

        {/* Status */}
        <StatusFilter
          selectedStatuses={selectedStatuses}
          onSelectionChange={setSelectedStatuses}
          allowedStatuses={["Approved", "Rejected", "Closed"]}
        />

        {/* Category */}
        <CategoryFilter
          selectedCategories={selectedCategories}
          onSelectionChange={setSelectedCategories}
          categories={categories?.map((c: { name: string }) => c.name) ?? []}
        />

        {/* Amount range slider */}
        <AmountRangeSlider
          min={amountBounds.min}
          max={amountBounds.max}
          value={sliderValue}
          onValueChange={(v) => setAmountRange(v)}
          onReset={() => setAmountRange(null)}
        />

        {/* Date range */}
        <div className="flex items-center gap-2">
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
            placeholder="Filter by decision date"
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
        </div>
      </div>

      {/* Reset all — always reserves space to prevent layout jump */}
      <div className="h-7">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          style={{ visibility: hasActiveFilters ? "visible" : "hidden" }}
          onClick={resetAllFilters}
        >
          Reset filters
        </Button>
      </div>

      <div className={`rounded-md border border-gray-200 bg-white overflow-x-auto transition-opacity ${isRefetching ? "opacity-50" : ""}`}>
        <table className="w-full" aria-label="Reviewed expenses history">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-gray-200 bg-gray-50">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    scope="col"
                    className="px-4 py-3 text-left text-sm font-medium text-gray-600 cursor-pointer select-none"
                    onClick={header.column.getToggleSortingHandler()}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); header.column.getToggleSortingHandler()?.(e); } }}
                    tabIndex={header.column.getCanSort() ? 0 : undefined}
                    aria-sort={header.column.getIsSorted() === "asc" ? "ascending" : header.column.getIsSorted() === "desc" ? "descending" : header.column.getCanSort() ? "none" : undefined}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === "asc" && <span aria-hidden="true"> ↑</span>}
                      {header.column.getIsSorted() === "desc" && <span aria-hidden="true"> ↓</span>}
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
                  No reviewed expenses found.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => setReviewExpenseId(row.original._id)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setReviewExpenseId(row.original._id); }}
                  tabIndex={0}
                  role="button"
                  aria-label={`View reviewed expense: ${row.original.title} from ${row.original.submitterName}`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 text-sm align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {reviewExpenseId && (
        <ReviewModal
          open={reviewExpenseId !== null}
          onClose={() => setReviewExpenseId(null)}
          expenseId={reviewExpenseId}
          readOnly
        />
      )}
    </>
  );
}
