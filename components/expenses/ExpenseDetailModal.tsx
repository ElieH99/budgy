"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { type ExpenseStatus } from "@/lib/constants";
import { formatAmount } from "@/lib/utils";
import { format } from "date-fns";
import { formatDistanceToNow } from "date-fns";
import { toast } from "@/components/ui/toast";
import { StatusBadge } from "./StatusBadge";
import { VersionBadge } from "./VersionBadge";
import { StatusTimeline } from "./StatusTimeline";
import { VersionHistoryPanel } from "./VersionHistoryPanel";
import { ExpenseFormModal } from "./ExpenseFormModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/expenses/AlertDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

interface ExpenseDetailModalProps {
  open: boolean;
  onClose: () => void;
  expenseId: Id<"expenses"> | null;
  queue?: Id<"expenses">[];
  currentIndex?: number;
  onNavigate?: (index: number) => void;
}

export function ExpenseDetailModal({
  open,
  onClose,
  expenseId,
  queue,
  currentIndex,
  onNavigate,
}: ExpenseDetailModalProps) {

  const detail = useQuery(
    api.expenses.getExpenseDetail,
    expenseId ? { expenseId } : "skip"
  );
  const submitExpense = useMutation(api.expenses.submitExpense);
  const withdrawExpense = useMutation(api.expenses.withdrawExpense);
  const editRejected = useMutation(api.expenses.editRejected);

  const [withdrawConfirm, setWithdrawConfirm] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editMode, setEditMode] = useState<"edit" | "resubmit">("edit");

  if (!expenseId) return null;

  const expense = detail?.expense;
  const latestVersion = detail?.versions[detail.versions.length - 1];
  const draftVersion = detail?.draftVersion;
  const status = expense?.status as ExpenseStatus | undefined;

  const handleSubmitDraft = async () => {
    if (!expenseId) return;
    try {
      await submitExpense({ expenseId });
      toast.success("Expense submitted for approval");
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      const match = raw.match(/ConvexError:\s*(.+?)(?:\s*Called by|$)/);
      const description = match ? match[1].trim() : "Failed to submit expense";
      toast.error("Submission failed", { description, duration: 5000 });
    }
  };

  const handleWithdraw = async () => {
    if (!expenseId) return;
    try {
      await withdrawExpense({ expenseId });
      toast.success("Expense withdrawn");
      setWithdrawConfirm(false);
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Failed to withdraw", duration: 5000 });
    }
  };

  const handleEditRejected = async () => {
    if (!expenseId) return;
    try {
      await editRejected({ expenseId });
      setEditMode("resubmit");
      setEditModalOpen(true);
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Failed to start edit", duration: 5000 });
    }
  };

  const displayVersion = draftVersion ?? latestVersion;
  const categoryName = displayVersion
    ? detail?.categoriesMap[displayVersion.categoryId] ?? "Unknown"
    : "";

  return (
    <>
      <Dialog open={open && !editModalOpen} onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {!detail ? (
            <>
              <DialogTitle className="sr-only">Loading expense</DialogTitle>
              <DialogDescription className="sr-only">Loading expense details</DialogDescription>
              <div className="flex items-center justify-center py-12" role="status" aria-label="Loading expense details">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between gap-2 pr-8">
                  <div className="flex items-center gap-3 flex-wrap min-w-0">
                    <DialogTitle className="text-xl truncate">
                      {displayVersion?.title ?? "Expense"}
                    </DialogTitle>
                    {status && <StatusBadge status={status} />}
                    {expense && expense.currentVersion > 0 && (
                      <VersionBadge versionNumber={expense.currentVersion} />
                    )}
                  </div>

                  {queue && currentIndex !== undefined && onNavigate && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            aria-label="Previous expense"
                            disabled={currentIndex === 0}
                            onClick={() => onNavigate(currentIndex - 1)}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Previous expense</TooltipContent>
                      </Tooltip>
                      <span className="text-sm text-muted-foreground whitespace-nowrap">
                        {currentIndex + 1} of {queue.length}
                      </span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            aria-label="Next expense"
                            disabled={currentIndex === queue.length - 1}
                            onClick={() => onNavigate(currentIndex + 1)}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Next expense</TooltipContent>
                      </Tooltip>
                    </div>
                  )}
                </div>
                <DialogDescription>
                  Created {expense ? formatDistanceToNow(new Date(expense.createdAt), { addSuffix: true }) : ""}
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col gap-6">
                <Card className="bg-gray-50 border-gray-100">
                  <CardContent className="pt-4 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">Category</span>
                      <p className="text-sm font-medium mt-0.5">{categoryName}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">Amount</span>
                      <p className="text-sm font-medium mt-0.5">
                        {displayVersion != null ? formatAmount(displayVersion.amount / 100) : ""} {displayVersion?.currencyCode}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">Expense Date</span>
                      <p className="text-sm font-medium mt-0.5">
                        {displayVersion?.expenseDate
                          ? format(new Date(displayVersion.expenseDate), "dd MMM yyyy")
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">Created</span>
                      <p className="text-sm font-medium mt-0.5">
                        {expense ? formatDistanceToNow(new Date(expense.createdAt), { addSuffix: true }) : "—"}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {displayVersion?.notes && (
                  <div className="border-t border-border pt-6 text-sm">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">Notes</span>
                    <p className="text-sm mt-1">{displayVersion.notes}</p>
                  </div>
                )}

                <div className="border-t border-border pt-6 text-sm">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">Description</span>
                  <p className="text-sm mt-1">{displayVersion?.description}</p>
                </div>

                {displayVersion?.receiptStorageId && (
                  <div className="border-t border-border pt-6">
                    <ReceiptPreview
                      storageId={displayVersion.receiptStorageId}
                      expenseId={expenseId}
                    />
                  </div>
                )}

                {(status === "Rejected" || status === "Closed") && (
                  <div role="status" className={`rounded-xl border p-4 text-sm ${status === "Rejected" ? "border-orange-200 bg-orange-50" : "border-red-200 bg-red-50"}`}>
                    <p className={`text-xs uppercase tracking-wide font-medium mb-1 ${status === "Rejected" ? "text-orange-700" : "text-red-700"}`}>
                      {status === "Rejected" ? "Rejected" : "Closed"}
                      {status === "Rejected" && expense?.rejectionReason ? `: ${expense.rejectionReason}` : ""}
                      {status === "Closed" && expense?.closeReason ? `: ${expense.closeReason}` : ""}
                    </p>
                    {status === "Rejected" && expense?.rejectionComment && (
                      <p className="text-sm text-orange-900">{expense.rejectionComment}</p>
                    )}
                    {status === "Closed" && expense?.closeComment && (
                      <p className="text-sm text-red-900">{expense.closeComment}</p>
                    )}
                    {status === "Rejected" && expense?.rejectedByName && (
                      <p className="text-xs text-muted-foreground mt-2">
                        By {expense.rejectedByName.firstName} {expense.rejectedByName.lastName}
                        {expense.rejectedAt && ` · ${format(new Date(expense.rejectedAt), "dd MMM yyyy, HH:mm")}`}
                      </p>
                    )}
                    {status === "Closed" && expense?.closedByName && (
                      <p className="text-xs text-muted-foreground mt-2">
                        By {expense.closedByName.firstName} {expense.closedByName.lastName}
                        {expense.closedAt && ` · ${format(new Date(expense.closedAt), "dd MMM yyyy, HH:mm")}`}
                      </p>
                    )}
                  </div>
                )}

                {status === "Approved" && expense?.approvalNote && (
                  <div className="rounded-xl border border-border p-4 text-sm">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Approval Note</p>
                    <p className="text-sm">{expense.approvalNote}</p>
                    {expense.approvedByName && (
                      <p className="text-xs text-muted-foreground mt-2">
                        By {expense.approvedByName.firstName} {expense.approvedByName.lastName}
                        {expense.approvedAt && ` · ${format(new Date(expense.approvedAt), "dd MMM yyyy, HH:mm")}`}
                      </p>
                    )}
                  </div>
                )}

                {(status === "Draft" || status === "Submitted" || status === "Rejected") && (
                  <div className="flex gap-2 border-t border-border pt-6">
                    {status === "Draft" && (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setEditMode("edit");
                            setEditModalOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                        <Button onClick={handleSubmitDraft}>Submit for Approval</Button>
                      </>
                    )}
                    {status === "Submitted" && (
                      <Button variant="destructive" onClick={() => setWithdrawConfirm(true)}>
                        Withdraw
                      </Button>
                    )}
                    {status === "Rejected" && (
                      <Button onClick={handleEditRejected}>Edit & Resubmit</Button>
                    )}
                  </div>
                )}

                {detail.versions.length > 1 && (
                  <div className="border-t border-border pt-6">
                    <VersionHistoryPanel
                      /* eslint-disable @typescript-eslint/no-explicit-any */
                      versions={(detail.versions as any[]).map((v: any) => ({
                        ...v,
                        categoryName: detail.categoriesMap[v.categoryId] ?? "Unknown",
                      }))}
                      currentStatus={expense?.status ?? ""}
                      history={detail.history}
                    />
                  </div>
                )}

                {detail.history.length > 0 && (
                  <div className="border-t border-border pt-6">
                    <StatusTimeline history={detail.history} />
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={withdrawConfirm} onOpenChange={setWithdrawConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Withdraw Expense</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to withdraw &ldquo;{displayVersion?.title ?? "this expense"}&rdquo;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleWithdraw} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Withdraw
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {editModalOpen && (
        <ExpenseFormModal
          open={editModalOpen}
          onClose={() => {
            setEditModalOpen(false);
          }}
          mode={editMode}
          expenseId={expenseId}
          defaultValues={
            draftVersion
              ? {
                  title: draftVersion.title,
                  description: draftVersion.description,
                  amount: draftVersion.amount,
                  currencyCode: draftVersion.currencyCode as ExpenseFormValues["currencyCode"],
                  categoryId: draftVersion.categoryId,
                  expenseDate: draftVersion.expenseDate,
                  notes: draftVersion.notes ?? "",
                  receiptStorageId: draftVersion.receiptStorageId,
                }
              : undefined
          }
          rejectionReason={expense?.rejectionReason ?? undefined}
          rejectionComment={expense?.rejectionComment ?? undefined}
        />
      )}
    </>
  );
}

function ReceiptPreview({
  storageId,
  expenseId,
}: {
  storageId: string;
  expenseId: Id<"expenses">;
}) {
  const url = useQuery(api.files.getReceiptUrl, {
    storageId: storageId as Id<"_storage">,
    expenseId,
  });

  return (
    <div className="text-sm">
      <span className="text-xs text-muted-foreground uppercase tracking-wide">Receipt</span>
      <div className="mt-1 h-48 w-full rounded border bg-muted flex items-center justify-center overflow-hidden" aria-busy={!url}>
        {!url ? (
          <Skeleton className="h-full w-full" aria-label="Loading receipt" />
        ) : (
          <a href={url} target="_blank" rel="noopener noreferrer" aria-label="View receipt (opens in new tab)" className="h-full w-full flex items-center justify-center">
            <img src={url} alt="Expense receipt document" className="max-h-full max-w-full object-contain cursor-pointer hover:opacity-80" />
          </a>
        )}
      </div>
    </div>
  );
}

import type { ExpenseFormValues } from "@/lib/validators";
