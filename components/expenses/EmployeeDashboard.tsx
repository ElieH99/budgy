"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { ExpenseTable } from "./ExpenseTable";
import { ExpenseFormModal } from "./ExpenseFormModal";
import { ExpenseDetailModal } from "./ExpenseDetailModal";
import { ExpenseSummaryStrip } from "./ExpenseSummaryStrip";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, ReceiptText, FilePlus, Send, CheckCircle } from "lucide-react";

const ACTIVE_STATUSES = ["Draft", "Submitted", "UnderReview", "Rejected"];
const RESOLVED_STATUSES = ["Approved", "Closed", "Withdrawn"];

export function EmployeeDashboard({ hideSummaryStrip = false }: { hideSummaryStrip?: boolean } = {}) {
  const expenses = useQuery(api.expenses.getMyExpenses);

  const [formOpen, setFormOpen] = useState(false);
  const [detailIndex, setDetailIndex] = useState<number | null>(null);
  const [sortedQueue, setSortedQueue] = useState<Id<"expenses">[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [viewTab, setViewTab] = useState<"active" | "resolved">("active");

  const hasExpenses = expenses && expenses.length > 0;

  const detailId = detailIndex !== null ? (sortedQueue[detailIndex] ?? null) : null;

  return (
    <div className="space-y-6 min-h-[420px]">
      <div className="flex items-center justify-between">
        {!hideSummaryStrip && (
          <h1 className="text-xl font-semibold text-gray-900">My Submissions</h1>
        )}
        {!hideSummaryStrip && (hasExpenses || expenses === undefined) && (
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New Ticket
          </Button>
        )}
        {hideSummaryStrip && hasExpenses && (
          <Button onClick={() => setFormOpen(true)} className="ml-auto">
            <Plus className="h-4 w-4 mr-1" />
            New Ticket
          </Button>
        )}
      </div>

      {expenses === undefined ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      ) : !hasExpenses ? (
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl pt-10 pb-8 px-8 flex flex-col items-center justify-center text-center max-w-2xl mx-auto w-full">
          <div className="rounded-full bg-indigo-50 flex items-center justify-center p-5 mb-5">
            <ReceiptText className="size-16 text-indigo-400" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">
            No expense tickets yet
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            Submit your first expense to get started.
          </p>
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Ticket
          </Button>

          {/* How it works — 3-step mini guide */}
          <div className="border-t border-gray-100 mt-6 pt-6 grid grid-cols-3 gap-6 max-w-lg text-left">
            {[
              {
                icon: <FilePlus className="h-4 w-4 text-indigo-500" />,
                title: "1. Create",
                body: "Fill in the expense details and attach your receipt.",
              },
              {
                icon: <Send className="h-4 w-4 text-blue-500" />,
                title: "2. Submit",
                body: "Send it to your manager for review.",
              },
              {
                icon: <CheckCircle className="h-4 w-4 text-green-500" />,
                title: "3. Get approved",
                body: "Track status in real time — no chasing needed.",
              },
            ].map((step) => (
              <div key={step.title} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  {step.icon}
                  <span className="text-xs font-semibold text-gray-700">{step.title}</span>
                </div>
                <p className="text-xs text-muted-foreground">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {hasExpenses && !hideSummaryStrip && (
            <ExpenseSummaryStrip
              selectedStatuses={selectedStatuses}
              onStatusClick={(status) => {
                setSelectedStatuses((prev) =>
                  prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
                );
              }}
              onTabChange={(tab) => {
                const allowed = tab === "active" ? ACTIVE_STATUSES : RESOLVED_STATUSES;
                setViewTab(tab);
                setSelectedStatuses((prev) => prev.filter((s) => allowed.includes(s)));
              }}
            />
          )}
          <Tabs value={viewTab} onValueChange={(v) => {
            const tab = v as "active" | "resolved";
            const allowed = tab === "active" ? ACTIVE_STATUSES : RESOLVED_STATUSES;
            setViewTab(tab);
            setSelectedStatuses((prev) => prev.filter((s) => allowed.includes(s)));
          }}>
            <TabsList className="mb-2">
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="resolved">Resolved</TabsTrigger>
            </TabsList>
            <TabsContent value="active">
              <ExpenseTable
                onRowClick={(_, idx) => setDetailIndex(idx)}
                onQueueChange={setSortedQueue}
                selectedStatuses={selectedStatuses}
                onSelectedStatusesChange={setSelectedStatuses}
                allowedStatuses={ACTIVE_STATUSES}
              />
            </TabsContent>
            <TabsContent value="resolved">
              <ExpenseTable
                onRowClick={(_, idx) => setDetailIndex(idx)}
                onQueueChange={setSortedQueue}
                selectedStatuses={selectedStatuses}
                onSelectedStatusesChange={setSelectedStatuses}
                allowedStatuses={RESOLVED_STATUSES}
              />
            </TabsContent>
          </Tabs>
        </>
      )}

      <ExpenseFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        mode="create"
      />

      <ExpenseDetailModal
        open={detailIndex !== null}
        onClose={() => setDetailIndex(null)}
        expenseId={detailId}
        queue={sortedQueue}
        currentIndex={detailIndex ?? 0}
        onNavigate={setDetailIndex}
      />
    </div>
  );
}
