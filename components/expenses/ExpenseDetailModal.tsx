"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { type ExpenseStatus } from "@/lib/constants";
import { format } from "date-fns";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/components/ui/toast";
import { StatusBadge } from "./StatusBadge";
import { VersionBadge } from "./VersionBadge";
import { RejectionBanner } from "./RejectionBanner";
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
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";

interface ExpenseDetailModalProps {
  open: boolean;
  onClose: () => void;
  expenseId: Id<"expenses"> | null;
}

export function ExpenseDetailModal({
  open,
  onClose,
  expenseId,
}: ExpenseDetailModalProps) {
  const { toast } = useToast();
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
      toast({ title: "Expense submitted for approval" });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to submit", variant: "destructive" });
    }
  };

  const handleWithdraw = async () => {
    if (!expenseId) return;
    try {
      await withdrawExpense({ expenseId });
      toast({ title: "Expense withdrawn" });
      setWithdrawConfirm(false);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to withdraw", variant: "destructive" });
    }
  };

  const handleEditRejected = async () => {
    if (!expenseId) return;
    try {
      await editRejected({ expenseId });
      setEditMode("resubmit");
      setEditModalOpen(true);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to start edit", variant: "destructive" });
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
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3 flex-wrap">
                  <DialogTitle className="text-xl">
                    {displayVersion?.title ?? "Expense"}
                  </DialogTitle>
                  {status && <StatusBadge status={status} />}
                  {expense && expense.currentVersion > 0 && (
                    <VersionBadge versionNumber={expense.currentVersion} />
                  )}
                </div>
                <DialogDescription>
                  Created {expense ? formatDistanceToNow(new Date(expense.createdAt), { addSuffix: true }) : ""}
                </DialogDescription>
              </DialogHeader>

              {status === "Rejected" && expense?.rejectionReason && expense.rejectionComment && (
                <RejectionBanner
                  rejectionReason={expense.rejectionReason}
                  rejectionComment={expense.rejectionComment}
                />
              )}

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Category</span>
                    <p className="font-medium">{categoryName}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Amount</span>
                    <p className="font-medium">
                      {displayVersion?.amount.toFixed(2)} {displayVersion?.currencyCode}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Expense Date</span>
                    <p className="font-medium">
                      {displayVersion?.expenseDate
                        ? format(new Date(displayVersion.expenseDate), "dd MMM yyyy")
                        : "—"}
                    </p>
                  </div>
                </div>

                <div className="text-sm">
                  <span className="text-muted-foreground">Description</span>
                  <p className="mt-1">{displayVersion?.description}</p>
                </div>

                {displayVersion?.notes && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Notes</span>
                    <p className="mt-1">{displayVersion.notes}</p>
                  </div>
                )}

                {displayVersion?.receiptStorageId && (
                  <ReceiptPreview
                    storageId={displayVersion.receiptStorageId}
                    expenseId={expenseId}
                  />
                )}

                {status === "Approved" && expense?.approvalNote && (
                  <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm">
                    <p className="font-medium text-green-800">Approval Note</p>
                    <p className="text-green-700 mt-1">{expense.approvalNote}</p>
                    {expense.approvedByName && (
                      <p className="text-green-600 text-xs mt-1">
                        By {expense.approvedByName.firstName} {expense.approvedByName.lastName}
                        {expense.approvedAt && ` on ${format(new Date(expense.approvedAt), "dd MMM yyyy, HH:mm")}`}
                      </p>
                    )}
                  </div>
                )}

                {status === "Closed" && expense?.closeComment && (
                  <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm">
                    <p className="font-medium text-red-800">Closed: {expense.closeReason}</p>
                    <p className="text-red-700 mt-1">{expense.closeComment}</p>
                    {expense.closedByName && (
                      <p className="text-red-600 text-xs mt-1">
                        By {expense.closedByName.firstName} {expense.closedByName.lastName}
                        {expense.closedAt && ` on ${format(new Date(expense.closedAt), "dd MMM yyyy, HH:mm")}`}
                      </p>
                    )}
                  </div>
                )}

                <Separator />

                <div className="flex gap-2">
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

                <Separator />

                {detail.versions.length > 0 && (
                  <VersionHistoryPanel
                    /* eslint-disable @typescript-eslint/no-explicit-any */
                    versions={(detail.versions as any[]).map((v: any) => ({
                      ...v,
                      categoryName: detail.categoriesMap[v.categoryId] ?? "Unknown",
                    }))}
                    currentStatus={expense?.status ?? ""}
                  />
                )}

                {detail.history.length > 0 && (
                  <StatusTimeline history={detail.history} />
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
              Are you sure you want to withdraw this ticket? This action cannot be undone.
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

  if (!url) {
    return (
      <div className="text-sm">
        <span className="text-muted-foreground">Receipt</span>
        <div className="mt-1 h-24 w-24 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="text-sm">
      <span className="text-muted-foreground">Receipt</span>
      <a href={url} target="_blank" rel="noopener noreferrer" className="block mt-1">
        <img src={url} alt="Receipt" className="max-h-48 rounded border cursor-pointer hover:opacity-80" />
      </a>
    </div>
  );
}

import type { ExpenseFormValues } from "@/lib/validators";
