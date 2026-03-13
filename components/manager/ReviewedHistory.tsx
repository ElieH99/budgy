"use client";

import { useMemo, useState } from "react";
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
import { format } from "date-fns";
import { StatusBadge } from "@/components/expenses/StatusBadge";
import { ReviewModal } from "./ReviewModal";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

export function ReviewedHistory() {
  const categories = useQuery(api.categories.listCategories);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [nameSearch, setNameSearch] = useState("");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "decidedOn", desc: true },
  ]);
  const [reviewExpenseId, setReviewExpenseId] = useState<Id<"expenses"> | null>(null);

  const reviewed = useQuery(
    api.expenses.getReviewedHistory,
    {
      statusFilter: statusFilter === "all" ? undefined : statusFilter,
      categoryFilter: categoryFilter === "all" ? undefined : categoryFilter as Id<"categories">,
    }
  );

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
    if (!nameSearch) return reviewed;
    return reviewed.filter((r: { submitterName: string }) =>
      r.submitterName.toLowerCase().includes(nameSearch.toLowerCase())
    );
  }, [reviewed, nameSearch]);

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
          `${row.original.amount.toFixed(2)} ${row.original.currencyCode}`,
      },
      {
        accessorKey: "status",
        header: "Decision",
        cell: ({ row }) => (
          <StatusBadge status={row.original.status as ExpenseStatus} />
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

  if (reviewed === undefined) {
    return (
      <div className="animate-pulse mt-4" role="status" aria-label="Loading reviewed expenses">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4 py-3 border-b border-gray-100">
            <div className="h-4 bg-gray-200 rounded w-28" />
            <div className="h-4 bg-gray-200 rounded w-32" />
            <div className="h-4 bg-gray-200 rounded w-20" />
            <div className="h-4 bg-gray-200 rounded w-16" />
            <div className="h-4 bg-gray-200 rounded w-20" />
            <div className="h-4 bg-gray-200 rounded w-24" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 mt-4 mb-4">
        <Input
          placeholder="Search by employee name..."
          value={nameSearch}
          onChange={(e) => setNameSearch(e.target.value)}
          className="w-64"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="Approved">Approved</SelectItem>
            <SelectItem value="Rejected">Rejected</SelectItem>
            <SelectItem value="Closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories?.map((cat: { _id: string; name: string }) => (
              <SelectItem key={cat._id} value={cat._id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border bg-white overflow-x-auto">
        <table className="w-full" aria-label="Reviewed expenses history">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b bg-muted/50">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-sm font-medium text-muted-foreground cursor-pointer select-none"
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
                  No reviewed expenses found.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => setReviewExpenseId(row.original._id)}
                >
                  {row.getVisibleCells().map((cell) => (
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
