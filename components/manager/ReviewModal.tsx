"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { type ExpenseStatus, REJECTION_REASONS, CLOSE_REASONS } from "@/lib/constants";
import { formatAmount } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "@/components/ui/toast";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
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

  // After an action, advance to the next pending ticket or close the modal
  const advanceOrClose = () => {
    if (onNavigate && queue && currentIndex !== undefined) {
      // The acted-on ticket will leave the queue, so the next ticket shifts to currentIndex
      // (or we go to the last one if we were at the end)
      const nextIndex = currentIndex < queue.length - 1 ? currentIndex : currentIndex - 1;
      if (nextIndex >= 0) {
        onNavigate(nextIndex);
        return;
      }
    }
    onClose();
  };

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
      toast.success("Expense approved");
      advanceOrClose();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Failed to approve", duration: 5000 });
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
      toast.success("Expense rejected");
      advanceOrClose();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Failed to reject", duration: 5000 });
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
      toast.success("Expense permanently closed");
      setCloseConfirmOpen(false);
      advanceOrClose();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Failed to close", duration: 5000 });
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
                      {latestVersion?.title ?? "Expense"}
                    </DialogTitle>
                    {status && <StatusBadge status={status} />}
                    {expense && expense.currentVersion > 0 && (
                      <VersionBadge versionNumber={expense.currentVersion} />
                    )}
                  </div>

                  {/* Navigation arrows — unified in the header bar */}
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
                        {currentIndex + 1} of {queue.length} pending
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
                  Submitted by {expense?.submittedByName?.firstName} {expense?.submittedByName?.lastName}
                  {status === "Approved" && expense?.approvedByName && (
                    <> · Approved by {expense.approvedByName.firstName} {expense.approvedByName.lastName}</>
                  )}
                </DialogDescription>
              </DialogHeader>

              {expense && expense.currentVersion > 1 && status !== "Approved" && expense.rejectionReason && expense.rejectionComment && (
                <RejectionBanner
                  rejectionReason={expense.rejectionReason}
                  rejectionComment={expense.rejectionComment}
                />
              )}

              <div className={`grid grid-cols-1 gap-6 ${isActionable ? "lg:grid-cols-[3fr_2fr]" : ""}`}>
                {/* Left panel — ticket info */}
                <div className="flex flex-col gap-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">Category</span>
                      <p className="text-sm font-medium mt-0.5">
                        {latestVersion
                          ? detail.categoriesMap[latestVersion.categoryId] ?? "—"
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">Amount</span>
                      <p className="text-sm font-medium mt-0.5">
                        {latestVersion != null ? formatAmount(latestVersion.amount / 100) : ""} {latestVersion?.currencyCode}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">Expense Date</span>
                      <p className="text-sm font-medium mt-0.5">
                        {latestVersion?.expenseDate
                          ? format(new Date(latestVersion.expenseDate), "dd MMM yyyy")
                          : "—"}
                      </p>
                    </div>
                    {latestVersion?.notes && (
                      <div>
                        <span className="text-xs text-muted-foreground uppercase tracking-wide">Notes</span>
                        <p className="text-sm font-medium mt-0.5">{latestVersion.notes}</p>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-border pt-6">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">Description</span>
                    <p className="text-sm mt-1">{latestVersion?.description}</p>
                  </div>

                  {latestVersion?.receiptStorageId && expenseId && (
                    <div className="border-t border-border pt-6">
                      <ReceiptPreview
                        storageId={latestVersion.receiptStorageId}
                        expenseId={expenseId}
                      />
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

                {/* Right panel — actions */}
                {isActionable && (
                  <div className="space-y-4">
                    {/* Submitter info card */}
                    <Card className="border-gray-100 bg-gray-50">
                      <CardContent className="pt-3 pb-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-sm shrink-0">
                          {(expense?.submittedByName?.firstName?.[0] ?? "")}{(expense?.submittedByName?.lastName?.[0] ?? "")}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {expense?.submittedByName?.firstName} {expense?.submittedByName?.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground capitalize">{expense?.submittedByName?.role ?? "Employee"}</p>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Current status */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground uppercase tracking-wide">
                        Current status
                      </span>
                      {status && <StatusBadge status={status} />}
                    </div>

                    {/* Version context */}
                    {expense && expense.currentVersion > 1 && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground uppercase tracking-wide">
                          Submission
                        </span>
                        <VersionBadge versionNumber={expense.currentVersion} />
                      </div>
                    )}

                    <Separator />

                    <h3 className="font-semibold">Actions</h3>

                    {/* Approve */}
                    <div className="rounded-md border border-green-200 bg-green-50 p-4 space-y-3">
                      <Button
                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                        onClick={activeAction === "approve" ? handleApprove : () => setActiveAction("approve")}
                        disabled={actionLoading}
                      >
                        {actionLoading && activeAction === "approve" && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                        {actionLoading && activeAction === "approve" ? "Approving..." : "Approve"}
                      </Button>
                      {activeAction === "approve" && (
                        <div className="space-y-2">
                          <Label htmlFor="approval-note" className="text-sm">Add a note for the employee (optional)</Label>
                          <Textarea
                            id="approval-note"
                            value={approvalNote}
                            onChange={(e) => setApprovalNote(e.target.value)}
                            placeholder="Optional approval note..."
                          />
                          <Button
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={handleApprove}
                            disabled={actionLoading}
                          >
                            {actionLoading && activeAction === "approve" && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
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
                          <Label htmlFor="rejection-reason" className="text-sm">Rejection Reason *</Label>
                          <Select value={rejectionReason} onValueChange={setRejectionReason}>
                            <SelectTrigger id="rejection-reason" aria-required="true" aria-describedby={rejectionReason === "" ? "rejection-reason-hint" : undefined}>
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
                          <Label htmlFor="rejection-comment" className="text-sm">Rejection Comment * (min 10 chars)</Label>
                          <Textarea
                            id="rejection-comment"
                            value={rejectionComment}
                            onChange={(e) => setRejectionComment(e.target.value)}
                            placeholder="Explain what needs to be corrected..."
                            minLength={10}
                            aria-required="true"
                            aria-invalid={rejectionComment.length > 0 && rejectionComment.length < 10}
                            aria-describedby={rejectionComment.length > 0 && rejectionComment.length < 10 ? "rejection-comment-error" : undefined}
                          />
                          {rejectionComment.length > 0 && rejectionComment.length < 10 && (
                            <p id="rejection-comment-error" role="alert" className="text-xs text-red-600">Comment must be at least 10 characters</p>
                          )}
                          <Button
                            className="bg-orange-500 hover:bg-orange-600 text-white"
                            onClick={handleReject}
                            disabled={!canReject || actionLoading}
                          >
                            {actionLoading && activeAction === "reject" && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                            {actionLoading && activeAction === "reject" ? "Rejecting..." : "Confirm Rejection"}
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Close — outline style to visually distinguish from reversible actions */}
                    <div className="rounded-md border border-red-200 bg-red-50/40 p-4 space-y-3">
                      <Button
                        variant="outline"
                        className="w-full text-red-600 border-red-300 hover:bg-red-50 hover:text-red-700"
                        onClick={() => setActiveAction("close")}
                        disabled={actionLoading}
                      >
                        Close permanently
                      </Button>
                      {activeAction === "close" && (
                        <div className="space-y-2">
                          <Label htmlFor="close-reason" className="text-sm">Close Reason *</Label>
                          <Select value={closeReason} onValueChange={setCloseReason}>
                            <SelectTrigger id="close-reason" aria-required="true">
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
                          <Label htmlFor="close-comment" className="text-sm">Close Comment * (min 10 chars)</Label>
                          <Textarea
                            id="close-comment"
                            value={closeComment}
                            onChange={(e) => setCloseComment(e.target.value)}
                            placeholder="Explain why this expense is being permanently closed..."
                            minLength={10}
                            aria-required="true"
                            aria-invalid={closeComment.length > 0 && closeComment.length < 10}
                            aria-describedby={closeComment.length > 0 && closeComment.length < 10 ? "close-comment-error" : undefined}
                          />
                          {closeComment.length > 0 && closeComment.length < 10 && (
                            <p id="close-comment-error" role="alert" className="text-xs text-red-600">Comment must be at least 10 characters</p>
                          )}
                          <Button
                            variant="destructive"
                            className="bg-red-700 hover:bg-red-800"
                            onClick={() => setCloseConfirmOpen(true)}
                            disabled={!canClose || actionLoading}
                          >
                            {actionLoading && activeAction === "close" && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
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
                      <div role="status" className="rounded-md bg-green-50 border border-green-200 p-3 text-sm">
                        <p className="font-medium text-green-800">Approval Note</p>
                        <p className="text-green-700 mt-1">{expense.approvalNote}</p>
                      </div>
                    )}
                    {status === "Closed" && expense.closeComment && (
                      <div role="status" className="rounded-md bg-red-50 border border-red-200 p-3 text-sm">
                        <p className="font-medium text-red-800">Closed: {expense.closeReason}</p>
                        <p className="text-red-700 mt-1">{expense.closeComment}</p>
                      </div>
                    )}
                    {status === "Rejected" && expense.rejectionComment && (
                      <div role="status" className="rounded-md bg-orange-50 border border-orange-200 p-3 text-sm">
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
            <AlertDialogTitle>Close Expense Permanently!</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-700">
              You are permanently closing this expense. {submitterFirstName} will not be able to edit or resubmit it. This cannot be undone!
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClose}
              disabled={!closeComment || actionLoading}
              className="bg-red-700 hover:bg-red-800 text-white"
            >
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
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
