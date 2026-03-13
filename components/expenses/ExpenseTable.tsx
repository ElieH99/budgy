"use client";

import { useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { type ExpenseStatus } from "@/lib/constants";
import { formatDistanceToNow } from "date-fns";
import { StatusBadge } from "./StatusBadge";


interface ExpenseRow {
  _id: Id<"expenses">;
  title: string;
  amount: number;
  currencyCode: string;
  categoryId?: Id<"categories">;
  status: string;
  updatedAt: number;
}

interface ExpenseTableProps {
  onRowClick: (expenseId: Id<"expenses">) => void;
}

export function ExpenseTable({ onRowClick }: ExpenseTableProps) {
  const expenses = useQuery(api.expenses.getMyExpenses);
  const categories = useQuery(api.categories.listCategories);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "updatedAt", desc: true },
  ]);

  const categoryMap = useMemo(() => {
    if (!categories) return {};
    const map: Record<string, string> = {};
    categories.forEach((c: { _id: string; name: string }) => {
      map[c._id] = c.name;
    });
    return map;
  }, [categories]);

  const columns = useMemo<ColumnDef<ExpenseRow>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Title",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.title || "Untitled"}</span>
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
          row.original.amount
            ? `${row.original.amount.toFixed(2)} ${row.original.currencyCode}`
            : "—",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <StatusBadge status={row.original.status as ExpenseStatus} />
        ),
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
    data: expenses ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (expenses === undefined) {
    return (
      <div className="animate-pulse" role="status" aria-label="Loading expenses">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4 py-3 border-b border-gray-100">
            <div className="h-4 bg-gray-200 rounded w-32" />
            <div className="h-4 bg-gray-200 rounded w-20" />
            <div className="h-4 bg-gray-200 rounded w-16" />
            <div className="h-4 bg-gray-200 rounded w-24" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-white overflow-x-auto">
      <table className="w-full" aria-label="My expenses">
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
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
              onClick={() => onRowClick(row.original._id)}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-4 py-3 text-sm">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
