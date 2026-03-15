"use client";

import { useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type Row,
  type HeaderGroup,
  type Cell,
} from "@tanstack/react-table";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { type ExpenseStatus } from "@/lib/constants";
import { formatAmount } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { StatusBadge } from "@/components/expenses/StatusBadge";
import { ReviewModal } from "./ReviewModal";
import { AmountRangeSlider } from "@/components/ui/amount-range-slider";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { type DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CategoryFilter } from "@/components/ui/category-filter";
import { Skeleton } from "@/components/ui/skeleton";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { CheckCircle2 } from "lucide-react";

interface PendingRow {
  _id: Id<"expenses">;
  submitterName: string;
  title: string;
  amount: number;
  currencyCode: string;
  categoryId?: Id<"categories">;
  submittedAt: number;
  status: string;
}

export function PendingQueue() {
  const pending = useQuery(api.expenses.getPendingQueue);
  const categories = useQuery(api.categories.listCategories);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "submittedAt", desc: false },
  ]);
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);

  const [amountRange, setAmountRange] = useState<[number, number] | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [nameSearch, setNameSearch] = useState("");

  const amountBounds = useMemo(() => {
    if (!pending || pending.length === 0) return { min: 0, max: 5000 };
    const amounts = pending.map((e) => e.amount ?? 0);
    return { min: 0, max: Math.ceil(Math.max(...amounts) / 100) * 100 || 5000 };
  }, [pending]);

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
    if (!pending) return [];
    return pending.filter((e) => {
      if (nameSearch && !e.submitterName.toLowerCase().includes(nameSearch.toLowerCase())) return false;
      if (selectedCategories.length > 0) {
        const catName = e.categoryId ? categoryMap[e.categoryId] : undefined;
        if (!catName || !selectedCategories.includes(catName)) return false;
      }
      if (amountRange) {
        if (e.amount < amountRange[0] || e.amount > amountRange[1]) return false;
      }
      if (dateRange?.from) {
        const to = dateRange.to ?? dateRange.from;
        if (e.submittedAt < dateRange.from.getTime()) return false;
        if (e.submittedAt > to.getTime() + 86400000 - 1) return false;
      }
      return true;
    });
  }, [pending, nameSearch, selectedCategories, categoryMap, amountRange, dateRange]);

  // Actions column uses row.index (position in the sorted model) — no circular dep with table/sortedRows
  const columns = useMemo<ColumnDef<PendingRow>[]>(
    () => [
      {
        accessorKey: "submitterName",
        header: "Employee Name",
        cell: ({ row }) => <span className="font-medium">{row.original.submitterName}</span>,
      },
      {
        accessorKey: "title",
        header: "Ticket Title",
        cell: ({ row }) => (
          <HoverCard openDelay={400} closeDelay={100}>
            <HoverCardTrigger asChild>
              <button
                type="button"
                className="text-sm font-medium text-gray-900 hover:text-indigo-600 transition-colors text-left truncate max-w-[200px]"
                onClick={(e) => e.stopPropagation()}
              >
                {row.original.title}
              </button>
            </HoverCardTrigger>
            <HoverCardContent className="w-72" align="start">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <StatusBadge status={row.original.status as ExpenseStatus} />
                </div>
                <div className="text-sm font-medium text-gray-900 line-clamp-2">
                  {row.original.title}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{row.original.categoryId ? categoryMap[row.original.categoryId] ?? "—" : "—"}</span>
                  <span>·</span>
                  <span className="font-medium text-gray-700">
                    {formatAmount(row.original.amount)} {row.original.currencyCode}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Submitted {formatDistanceToNow(new Date(row.original.submittedAt), { addSuffix: true })}
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
        header: "Amount",
        cell: ({ row }) =>
          `${formatAmount(row.original.amount)} ${row.original.currencyCode}`,
      },
      {
        accessorKey: "submittedAt",
        header: "Submitted On",
        cell: ({ row }) =>
          format(new Date(row.original.submittedAt), "dd MMM yyyy"),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <StatusBadge status={row.original.status as ExpenseStatus} />
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }: { row: Row<PendingRow> }) => (
          <div
            className="flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2.5 text-xs border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800"
              onClick={() => setReviewIndex(row.index)}
            >
              Review
            </Button>
          </div>
        ),
      },
    ],
    [categoryMap]
  );

  const table = useReactTable({
    data: filteredData as PendingRow[],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (pending === undefined) {
    return (
      <div className="space-y-3 mt-4" role="status" aria-label="Loading pending expenses">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (pending.length === 0) {
    return (
      <div className="py-16 flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mb-4">
          <CheckCircle2 className="w-6 h-6 text-green-500" />
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">All caught up</h3>
        <p className="text-sm text-muted-foreground">
          No expenses are waiting for review right now.
        </p>
      </div>
    );
  }

  const sortedRows = table.getRowModel().rows;

  const hasActiveFilters = amountRange !== null || !!dateRange || selectedCategories.length > 0 || nameSearch !== "";

  const resetAllFilters = () => {
    setAmountRange(null);
    setDateRange(undefined);
    setSelectedCategories([]);
    setNameSearch("");
  };

  return (
    <>
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mt-4 mb-2">
        {/* Name search */}
        <Input
          placeholder="Search by employee name..."
          value={nameSearch}
          onChange={(e) => setNameSearch(e.target.value)}
          className="w-56 focus-visible:ring-0 focus-visible:ring-offset-0"
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
            placeholder="Filter by submitted date"
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

      <div className="rounded-md border border-gray-200 bg-white mt-0 overflow-x-auto">
        <table className="w-full" aria-label="Pending expenses for review">
          <thead>
            {table.getHeaderGroups().map((headerGroup: HeaderGroup<PendingRow>) => (
              <tr key={headerGroup.id} className="border-b border-gray-200 bg-gray-50">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-sm font-medium text-gray-600 cursor-pointer select-none"
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
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-muted-foreground">
                  No expenses match the current filters.
                </td>
              </tr>
            ) : (
              sortedRows.map((row: Row<PendingRow>, idx: number) => (
                <tr
                  key={row.id}
                  className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
                    row.original.status === "UnderReview" ? "bg-amber-50" : ""
                  }`}
                  onClick={() => setReviewIndex(idx)}
                >
                  {row.getVisibleCells().map((cell: Cell<PendingRow, unknown>) => (
                    <td key={cell.id} className="px-4 py-3 text-sm">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {reviewIndex !== null && pending && (
        <ReviewModal
          open={reviewIndex !== null}
          onClose={() => setReviewIndex(null)}
          expenseId={sortedRows[reviewIndex]?.original._id ?? null}
          queue={sortedRows.map((r: Row<PendingRow>) => r.original._id)}
          currentIndex={reviewIndex}
          onNavigate={setReviewIndex}
        />
      )}
    </>
  );
}
