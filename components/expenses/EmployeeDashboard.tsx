"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { ExpenseTable } from "./ExpenseTable";
import { ExpenseFormModal } from "./ExpenseFormModal";
import { ExpenseDetailModal } from "./ExpenseDetailModal";
import { Button } from "@/components/ui/button";
import { Plus, Receipt } from "lucide-react";

export function EmployeeDashboard() {
  const expenses = useQuery(api.expenses.getMyExpenses);

  const [formOpen, setFormOpen] = useState(false);
  const [detailId, setDetailId] = useState<Id<"expenses"> | null>(null);

  const hasExpenses = expenses && expenses.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">My Expenses</h1>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          New Ticket
        </Button>
      </div>

      {expenses !== undefined && !hasExpenses ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Receipt className="h-16 w-16 text-muted-foreground/40 mb-4" />
          <h2 className="text-xl font-semibold text-muted-foreground">
            No expense tickets yet
          </h2>
          <p className="text-muted-foreground mt-1">
            <button
              onClick={() => setFormOpen(true)}
              className="text-primary underline hover:no-underline"
            >
              Click here to add a receipt
            </button>
          </p>
        </div>
      ) : (
        <ExpenseTable onRowClick={(id) => setDetailId(id)} />
      )}

      <ExpenseFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        mode="create"
      />

      <ExpenseDetailModal
        open={detailId !== null}
        onClose={() => setDetailId(null)}
        expenseId={detailId}
      />
    </div>
  );
}
