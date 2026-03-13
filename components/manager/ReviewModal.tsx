"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { type ExpenseStatus, REJECTION_REASONS, CLOSE_REASONS } from "@/lib/constants";
import { format } from "date-fns";
import { useToast } from "@/components/ui/toast";
import { StatusBadge } from "@/components/expenses/StatusBadge";
import { VersionBadge } from "@/components/expenses/VersionBadge";
import { RejectionBanner } from "@/components/expenses/RejectionBanner";
import { StatusTimeline } from "@/components/expenses/StatusTimeline";
import { VersionHistoryPanel } from "@/components/expenses/VersionHistoryPanel";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

interface ReviewModalProps {
  open: boolean;
  onClose: () => void;
  expenseId: Id<"expenses"> | null;
  queue?: Id<"expenses">[];
  currentIndex?: number;
  onNavigate?: (index: number) => void;
  readOnly?: boolean;
}

export function ReviewModal({
  open,
  onClose,
  expenseId,
  queue,
  currentIndex,
  onNavigate,
  readOnly = false,
}: ReviewModalProps) {
  const { toast } = useToast();
  const detail = useQuery(
    api.expenses.getExpenseDetail,
    expenseId ? { expenseId } : "skip"
  );
  const openForReview = useMutation(api.expenses.openForReview);
  const approveMutation = useMutation(api.expenses.approveExpense);
  const rejectMutation = useMutation(api.expenses.rejectExpense);
  const closeMutation = useMutation(api.expenses.closeExpense);

  const [activeAction, setActiveAction] = useState<"approve" | "reject" | "close" | null>(null);
  const [approvalNote, setApprovalNote] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectionComment, setRejectionComment] = useState("");
  const [closeReason, setCloseReason] = useState("");
  const [closeComment, setCloseComment] = useState("");
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Open for review when manager opens a Submitted expense
  useEffect(() => {
    if (
      open &&
      expenseId &&
      detail?.expense?.status === "Submitted" &&
      !readOnly
    ) {
      openForReview({ expenseId }).catch(() => {
        // May fail if already under review or own expense — that's ok
      });
    }
  }, [open, expenseId, detail?.expense?.status, readOnly, openForReview]);

  // Reset form when expense changes
  useEffect(() => {
    setActiveAction(null);
    setApprovalNote("");
    setRejectionReason("");
    setRejectionComment("");
    setCloseReason("");
    setCloseComment("");
  }, [expenseId]);

  if (!expenseId) return null;

  const expense = detail?.expense;
  const latestVersion = detail?.versions[detail.versions.length - 1];
  const status = expense?.status as ExpenseStatus | undefined;
  const isActionable =
    !readOnly && (status === "Submitted" || status === "UnderReview");

  const submitterFirstName = expense?.submittedByName?.firstName ?? "Employee";

  const handleApprove = async () => {
    if (!expenseId) return;
    setActionLoading(true);
    try {
      await approveMutation({
        expenseId,
        approvalNote: approvalNote || undefined,
      });
      toast({ title: "Expense approved" });
      onClose();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to approve",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!expenseId) return;
    setActionLoading(true);
    try {
      await rejectMutation({
        expenseId,
        rejectionReason,
        rejectionComment,
      });
      toast({ title: "Expense rejected" });
      onClose();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to reject",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleClose = async () => {
    if (!expenseId) return;
    setActionLoading(true);
    try {
      await closeMutation({
        expenseId,
        closeReason,
        closeComment,
      });
      toast({ title: "Expense permanently closed" });
      setCloseConfirmOpen(false);
      onClose();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to close",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const canReject = rejectionReason && rejectionComment.length >= 10;
  const canClose = closeReason && closeComment.length >= 10;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <DialogTitle className="text-xl">
                      {latestVersion?.title ?? "Expense"}
                    </DialogTitle>
                    {status && <StatusBadge status={status} />}
                    {expense && expense.currentVersion > 0 && (
                      <VersionBadge versionNumber={expense.currentVersion} />
                    )}
                  </div>

                  {/* Navigation arrows */}
                  {queue && currentIndex !== undefined && onNavigate && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Previous expense"
                        disabled={currentIndex === 0}
                        onClick={() => onNavigate(currentIndex - 1)}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Reviewing {currentIndex + 1} of {queue.length} pending
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Next expense"
                        disabled={currentIndex === queue.length - 1}
                        onClick={() => onNavigate(currentIndex + 1)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
                <DialogDescription>
                  Submitted by {expense?.submittedByName?.firstName} {expense?.submittedByName?.lastName}
                </DialogDescription>
              </DialogHeader>

              {expense && expense.currentVersion > 1 && expense.rejectionReason && expense.rejectionComment && (
                <RejectionBanner
                  rejectionReason={expense.rejectionReason}
                  rejectionComment={expense.rejectionComment}
                />
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left panel — ticket info */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Category</span>
                      <p className="font-medium">
                        {latestVersion
                          ? detail.categoriesMap[latestVersion.categoryId] ?? "—"
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Amount</span>
                      <p className="font-medium">
                        {latestVersion?.amount.toFixed(2)} {latestVersion?.currencyCode}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Expense Date</span>
                      <p className="font-medium">
                        {latestVersion?.expenseDate
                          ? format(new Date(latestVersion.expenseDate), "dd MMM yyyy")
                          : "—"}
                      </p>
                    </div>
                  </div>

                  <div className="text-sm">
                    <span className="text-muted-foreground">Description</span>
                    <p className="mt-1">{latestVersion?.description}</p>
                  </div>

                  {latestVersion?.notes && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Notes</span>
                      <p className="mt-1">{latestVersion.notes}</p>
                    </div>
                  )}

                  {latestVersion?.receiptStorageId && expenseId && (
                    <ReceiptPreview
                      storageId={latestVersion.receiptStorageId}
                      expenseId={expenseId}
                    />
                  )}

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

                {/* Right panel — actions */}
                {isActionable && (
                  <div className="space-y-4">
                    <h3 className="font-semibold">Actions</h3>

                    {/* Approve */}
                    <div className="rounded-md border border-green-200 bg-green-50 p-4 space-y-3">
                      <Button
                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                        onClick={activeAction === "approve" ? handleApprove : () => setActiveAction("approve")}
                        disabled={actionLoading}
                      >
                        {actionLoading && activeAction === "approve" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {actionLoading && activeAction === "approve" ? "Approving..." : "Approve"}
                      </Button>
                      {activeAction === "approve" && (
                        <div className="space-y-2">
                          <Label>Add a note for the employee (optional)</Label>
                          <Textarea
                            value={approvalNote}
                            onChange={(e) => setApprovalNote(e.target.value)}
                            placeholder="Optional approval note..."
                          />
                          <Button
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={handleApprove}
                            disabled={actionLoading}
                          >
                            {actionLoading && activeAction === "approve" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {actionLoading && activeAction === "approve" ? "Approving..." : "Confirm Approval"}
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Reject */}
                    <div className="rounded-md border border-orange-200 bg-orange-50 p-4 space-y-3">
                      <Button
                        className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                        onClick={() => setActiveAction("reject")}
                        disabled={actionLoading}
                      >
                        Reject — needs correction
                      </Button>
                      {activeAction === "reject" && (
                        <div className="space-y-2">
                          <Label>Rejection Reason *</Label>
                          <Select value={rejectionReason} onValueChange={setRejectionReason}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select reason" />
                            </SelectTrigger>
                            <SelectContent>
                              {REJECTION_REASONS.map((r) => (
                                <SelectItem key={r} value={r}>
                                  {r}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Label>Rejection Comment * (min 10 chars)</Label>
                          <Textarea
                            value={rejectionComment}
                            onChange={(e) => setRejectionComment(e.target.value)}
                            placeholder="Explain what needs to be corrected..."
                            minLength={10}
                          />
                          {rejectionComment.length > 0 && rejectionComment.length < 10 && (
                            <p className="text-xs text-red-600">Comment must be at least 10 characters</p>
                          )}
                          <Button
                            className="bg-orange-500 hover:bg-orange-600 text-white"
                            onClick={handleReject}
                            disabled={!canReject || actionLoading}
                          >
                            {actionLoading && activeAction === "reject" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {actionLoading && activeAction === "reject" ? "Rejecting..." : "Confirm Rejection"}
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Close */}
                    <div className="rounded-md border border-red-300 bg-red-50 p-4 space-y-3">
                      <Button
                        variant="destructive"
                        className="w-full bg-red-700 hover:bg-red-800"
                        onClick={() => setActiveAction("close")}
                        disabled={actionLoading}
                      >
                        Close permanently
                      </Button>
                      {activeAction === "close" && (
                        <div className="space-y-2">
                          <Label>Close Reason *</Label>
                          <Select value={closeReason} onValueChange={setCloseReason}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select reason" />
                            </SelectTrigger>
                            <SelectContent>
                              {CLOSE_REASONS.map((r) => (
                                <SelectItem key={r} value={r}>
                                  {r}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Label>Close Comment * (min 10 chars)</Label>
                          <Textarea
                            value={closeComment}
                            onChange={(e) => setCloseComment(e.target.value)}
                            placeholder="Explain why this expense is being permanently closed..."
                            minLength={10}
                          />
                          {closeComment.length > 0 && closeComment.length < 10 && (
                            <p className="text-xs text-red-600">Comment must be at least 10 characters</p>
                          )}
                          <Button
                            variant="destructive"
                            className="bg-red-700 hover:bg-red-800"
                            onClick={() => setCloseConfirmOpen(true)}
                            disabled={!canClose || actionLoading}
                          >
                            {actionLoading && activeAction === "close" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Close Permanently
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Read-only info for reviewed expenses */}
                {!isActionable && expense && (
                  <div className="space-y-4">
                    {status === "Approved" && expense.approvalNote && (
                      <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm">
                        <p className="font-medium text-green-800">Approval Note</p>
                        <p className="text-green-700 mt-1">{expense.approvalNote}</p>
                      </div>
                    )}
                    {status === "Closed" && expense.closeComment && (
                      <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm">
                        <p className="font-medium text-red-800">Closed: {expense.closeReason}</p>
                        <p className="text-red-700 mt-1">{expense.closeComment}</p>
                      </div>
                    )}
                    {status === "Rejected" && expense.rejectionComment && (
                      <div className="rounded-md bg-orange-50 border border-orange-200 p-3 text-sm">
                        <p className="font-medium text-orange-800">Rejected: {expense.rejectionReason}</p>
                        <p className="text-orange-700 mt-1">{expense.rejectionComment}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Close confirmation dialog */}
      <AlertDialog open={closeConfirmOpen} onOpenChange={setCloseConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close Expense Permanently</AlertDialogTitle>
            <AlertDialogDescription>
              You are permanently closing this expense. {submitterFirstName} will not be able to edit or resubmit it. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClose}
              disabled={!closeComment || actionLoading}
              className="bg-red-700 hover:bg-red-800 text-white"
            >
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {actionLoading ? "Closing..." : "Close permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
      <div className="mt-1 flex gap-2">
        <a href={url} target="_blank" rel="noopener noreferrer">
          <img src={url} alt="Receipt" className="max-h-48 rounded border cursor-pointer hover:opacity-80" />
        </a>
        <a
          href={url}
          download
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center text-xs text-primary underline hover:no-underline self-end"
        >
          Download
        </a>
      </div>
    </div>
  );
}
