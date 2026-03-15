"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { expenseFormSchema, type ExpenseFormValues } from "@/lib/validators";
import { CURRENCIES, ACCEPTED_RECEIPT_TYPES, MAX_RECEIPT_SIZE_BYTES } from "@/lib/constants";
import { formatAmount } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { RejectionBanner } from "./RejectionBanner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Upload, X, Loader2, Info, CheckCircle2, RefreshCw } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

type Mode = "create" | "edit" | "resubmit";

interface ExpenseFormModalProps {
  open: boolean;
  onClose: () => void;
  mode: Mode;
  expenseId?: Id<"expenses">;
  defaultValues?: Partial<ExpenseFormValues>;
  rejectionReason?: string;
  rejectionComment?: string;
}

export function ExpenseFormModal({
  open,
  onClose,
  mode,
  expenseId,
  defaultValues,
  rejectionReason,
  rejectionComment,
}: ExpenseFormModalProps) {

  const categories = useQuery(api.categories.listCategories);
  const existingReceiptUrl = useQuery(
    api.files.getReceiptUrl,
    open && expenseId && defaultValues?.receiptStorageId
      ? { storageId: defaultValues.receiptStorageId as Id<"_storage">, expenseId }
      : "skip"
  );
  const createDraft = useMutation(api.expenses.createDraft);
  const saveDraft = useMutation(api.expenses.saveDraft);
  const submitExpense = useMutation(api.expenses.submitExpense);
  const resubmitExpense = useMutation(api.expenses.resubmitExpense);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);

  const [uploading, setUploading] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(
    defaultValues?.receiptStorageId ? "existing" : null
  );
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // defaultValues.amount is in cents from DB; display in dollars
  const [amountDisplay, setAmountDisplay] = useState<string>(
    defaultValues?.amount != null ? formatAmount((defaultValues.amount as number) / 100) : ""
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      title: "",
      description: "",
      currencyCode: "USD",
      categoryId: "",
      expenseDate: Date.now(),
      notes: "",
      receiptStorageId: "",
      ...defaultValues,
      // DB stores cents; form works in dollars
      amount: defaultValues?.amount != null ? (defaultValues.amount as number) / 100 : undefined as unknown as number,
    },
  });

  const receiptStorageId = watch("receiptStorageId");

  // In edit/resubmit mode the expense already has a receipt — block saving if it's been removed
  const hadExistingReceipt = mode !== "create" && !!defaultValues?.receiptStorageId;
  const receiptRemoved = hadExistingReceipt && !receiptStorageId;

  useEffect(() => {
    if (open && defaultValues) {
      reset({
        title: "",
        description: "",
        currencyCode: "USD",
        categoryId: "",
        expenseDate: Date.now(),
        notes: "",
        receiptStorageId: "",
        ...defaultValues,
        // DB stores cents; form works in dollars
        amount: defaultValues.amount != null ? (defaultValues.amount as number) / 100 : undefined as unknown as number,
      });
      setReceiptPreview(defaultValues.receiptStorageId ? "existing" : null);
      setAmountDisplay(defaultValues.amount != null ? formatAmount((defaultValues.amount as number) / 100) : "");
    } else if (open && !defaultValues) {
      reset({
        title: "",
        description: "",
        amount: undefined as unknown as number,
        currencyCode: "USD",
        categoryId: "",
        expenseDate: Date.now(),
        notes: "",
        receiptStorageId: "",
      });
      setReceiptPreview(null);
      setAmountDisplay("");
    } else if (!open) {
      reset({
        title: "",
        description: "",
        amount: undefined as unknown as number,
        currencyCode: "USD",
        categoryId: "",
        expenseDate: Date.now(),
        notes: "",
        receiptStorageId: "",
      });
      setReceiptPreview(null);
      setAmountDisplay("");
    }
  }, [open, defaultValues, reset]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_RECEIPT_TYPES.includes(file.type as typeof ACCEPTED_RECEIPT_TYPES[number])) {
      toast.error("Invalid file type", { description: "Only JPEG, PNG, and WEBP files are accepted", duration: 5000 });
      return;
    }
    if (file.size > MAX_RECEIPT_SIZE_BYTES) {
      toast.error("File too large", { description: "File must be under 5 MB", duration: 5000 });
      return;
    }

    setUploading(true);
    try {
      const url = await generateUploadUrl();
      const result = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const { storageId } = await result.json();
      setValue("receiptStorageId", storageId, { shouldDirty: true });
      setReceiptPreview(URL.createObjectURL(file));
    } catch {
      toast.error("Upload failed", { description: "Failed to upload receipt. Please try again.", duration: 5000 });
    } finally {
      setUploading(false);
    }
  };

  const handleSaveDraft = async (data: ExpenseFormValues) => {
    if (receiptRemoved) {
      toast.error("Receipt required", { description: "Please upload a receipt before saving", duration: 5000 });
      return;
    }
    setSaving(true);
    try {
      if (mode === "create") {
        await createDraft({
          title: data.title,
          description: data.description,
          amount: Math.round(data.amount * 100),
          currencyCode: data.currencyCode,
          categoryId: data.categoryId as Id<"categories">,
          expenseDate: data.expenseDate,
          notes: data.notes,
          receiptStorageId: data.receiptStorageId,
        });
        toast.success("Draft saved");
      } else if (expenseId) {
        await saveDraft({
          expenseId,
          title: data.title,
          description: data.description,
          amount: Math.round(data.amount * 100),
          currencyCode: data.currencyCode,
          categoryId: data.categoryId as Id<"categories">,
          expenseDate: data.expenseDate,
          notes: data.notes,
          receiptStorageId: data.receiptStorageId,
        });
        toast.success("Draft updated");
      }
      onClose();
    } catch (err) {
      const message = err instanceof ConvexError
        ? (err.data as string)
        : err instanceof Error
          ? (err.message.split("Uncaught ConvexError: ")[1]?.split(" Called by")[0] ?? "Failed to save draft")
          : "Failed to save draft";
      toast.error("Error", { description: message, duration: 5000 });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitForApproval = async (data: ExpenseFormValues) => {
    if (!data.receiptStorageId) {
      toast.error("Receipt required", { description: "Please upload a receipt before submitting", duration: 5000 });
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "create") {
        const newId = await createDraft({
          title: data.title,
          description: data.description,
          amount: Math.round(data.amount * 100),
          currencyCode: data.currencyCode,
          categoryId: data.categoryId as Id<"categories">,
          expenseDate: data.expenseDate,
          notes: data.notes,
          receiptStorageId: data.receiptStorageId,
        });
        await submitExpense({ expenseId: newId });
        toast.success("Expense submitted for approval");
      } else if (expenseId) {
        await saveDraft({
          expenseId,
          title: data.title,
          description: data.description,
          amount: Math.round(data.amount * 100),
          currencyCode: data.currencyCode,
          categoryId: data.categoryId as Id<"categories">,
          expenseDate: data.expenseDate,
          notes: data.notes,
          receiptStorageId: data.receiptStorageId,
        });
        if (mode === "resubmit") {
          await resubmitExpense({ expenseId });
        } else {
          await submitExpense({ expenseId });
        }
        toast.success("Expense submitted for approval");
      }
      onClose();
    } catch (err) {
      const message = err instanceof ConvexError
        ? (err.data as string)
        : err instanceof Error
          ? (err.message.split("Uncaught ConvexError: ")[1]?.split(" Called by")[0] ?? "Failed to submit expense")
          : "Failed to submit expense";
      toast.error("Error", { description: message, duration: 5000 });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    // In create mode the form hasn't been persisted yet — just close and clear
    if (mode === "create") {
      reset();
      setReceiptPreview(null);
      onClose();
      return;
    }

    if (isDirty) {
      toast.warning("You have unsaved changes", {
        id: "unsaved-changes-warning",
        description: "Save as draft to keep your changes.",
        duration: 2000,
      });
      return;
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "New Expense Ticket" : mode === "resubmit" ? "Edit & Resubmit" : "Edit Draft"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Fill in the details for your expense claim."
              : mode === "resubmit"
                ? "Update your expense and resubmit for approval."
                : "Update your draft expense."}
          </DialogDescription>
        </DialogHeader>

        {mode === "resubmit" && rejectionReason && rejectionComment && (
          <RejectionBanner
            rejectionReason={rejectionReason}
            rejectionComment={rejectionComment}
          />
        )}

        <form className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input id="title" {...register("title")} placeholder="Expense title" aria-required="true" aria-describedby={errors.title ? "title-error" : undefined} />
            {errors.title && <p id="title-error" role="alert" className="text-sm text-red-600">{errors.title.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea id="description" {...register("description")} placeholder="Describe the expense" aria-required="true" aria-describedby={errors.description ? "description-error" : undefined} />
            {errors.description && <p id="description-error" role="alert" className="text-sm text-red-600">{errors.description.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select
                value={watch("categoryId")}
                onValueChange={(val) => setValue("categoryId", val, { shouldDirty: true, shouldValidate: true })}
              >
                <SelectTrigger id="category" aria-required="true" aria-describedby={errors.categoryId ? "category-error" : undefined}>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories?.map((cat: { _id: string; name: string }) => (
                    <SelectItem key={cat._id} value={cat._id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.categoryId && <p id="category-error" role="alert" className="text-sm text-red-600">{errors.categoryId.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Currency *</Label>
              <Select
                value={watch("currencyCode")}
                onValueChange={(val) => setValue("currencyCode", val as ExpenseFormValues["currencyCode"], { shouldDirty: true, shouldValidate: true })}
              >
                <SelectTrigger id="currency" aria-required="true" aria-describedby={errors.currencyCode ? "currency-error" : undefined}>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.currencyCode && <p id="currency-error" role="alert" className="text-sm text-red-600">{errors.currencyCode.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount *</Label>
              <Input
                id="amount"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                aria-required="true"
                aria-describedby={errors.amount ? "amount-error" : undefined}
                value={amountDisplay}
                onChange={(e) => {
                  const raw = e.target.value.replace(/,/g, "").replace(/-/g, "");
                  setAmountDisplay(e.target.value.replace(/-/g, ""));
                  const n = parseFloat(raw);
                  setValue("amount", isNaN(n) ? (undefined as unknown as number) : n, { shouldValidate: true, shouldDirty: true });
                }}
                onKeyDown={(e) => { if (e.key === "-") e.preventDefault(); }}
                onFocus={(e) => {
                  const raw = e.target.value.replace(/,/g, "");
                  setAmountDisplay(raw === "0" ? "" : raw);
                }}
                onBlur={(e) => {
                  const raw = e.target.value.replace(/,/g, "");
                  const n = parseFloat(raw);
                  if (!isNaN(n)) {
                    setAmountDisplay(formatAmount(n));
                    setValue("amount", n, { shouldValidate: true, shouldDirty: true });
                  } else {
                    setAmountDisplay("");
                  }
                }}
              />
              {errors.amount && <p id="amount-error" role="alert" className="text-sm text-red-600">{errors.amount.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="expenseDate">Expense Date *</Label>
              <DatePicker
                id="expenseDate"
                value={watch("expenseDate") ? new Date(watch("expenseDate")) : undefined}
                onChange={(date) => setValue("expenseDate", date ? date.getTime() : Date.now(), { shouldDirty: true, shouldValidate: true })}
                placeholder="Select expense date"
                disableFuture
                aria-required="true"
                aria-describedby={errors.expenseDate ? "expenseDate-error" : undefined}
              />
              {errors.expenseDate && <p id="expenseDate-error" role="alert" className="text-sm text-red-600">{errors.expenseDate.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="receipt-upload">Receipt *</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" aria-describedby="receipt-tooltip" aria-label="Receipt info" />
                </TooltipTrigger>
                <TooltipContent id="receipt-tooltip">OCR feature coming soon</TooltipContent>
              </Tooltip>
            </div>
            <div className="border-2 border-dashed rounded-md p-4">
              {uploading ? (
                <div className="flex items-center justify-center gap-2 py-4" role="status" aria-label="Uploading receipt">
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                  <span className="text-sm text-muted-foreground">Uploading...</span>
                </div>
              ) : receiptStorageId || receiptPreview ? (
                <div className="flex items-start gap-4">
                  {/* Preview */}
                  <div className="relative flex-shrink-0">
                    {receiptPreview && receiptPreview !== "existing" ? (
                      <img src={receiptPreview} alt="Uploaded receipt preview" className="h-24 w-24 object-cover rounded-md border border-gray-200 shadow-sm" />
                    ) : existingReceiptUrl ? (
                      <img src={existingReceiptUrl} alt="Existing receipt preview" className="h-24 w-24 object-cover rounded-md border border-gray-200 shadow-sm" />
                    ) : (
                      <div className="h-24 w-24 rounded-md bg-muted flex items-center justify-center border border-gray-200" role="status" aria-label="Loading receipt preview">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
                      </div>
                    )}
                  </div>

                  {/* Info + actions */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" aria-hidden="true" />
                      <span className="text-sm font-medium text-green-700">Receipt attached</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">Click &ldquo;Replace&rdquo; to swap the file.</p>
                    <div className="flex items-center gap-2">
                      <label htmlFor="receipt-replace" className="inline-flex items-center gap-1.5 h-7 px-2.5 text-xs cursor-pointer rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors font-medium">
                        <RefreshCw className="h-3 w-3" aria-hidden="true" />
                        Replace
                        <input
                          id="receipt-replace"
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          aria-label="Replace receipt file"
                          onClick={(e) => { (e.target as HTMLInputElement).value = ""; }}
                          onChange={handleFileUpload}
                        />
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 gap-1.5"
                        aria-label="Remove receipt"
                        onClick={() => {
                          setValue("receiptStorageId", "", { shouldDirty: true });
                          setReceiptPreview(null);
                        }}
                      >
                        <X className="h-3 w-3" aria-hidden="true" />
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <label htmlFor="receipt-upload" className="flex flex-col items-center gap-2 cursor-pointer py-4">
                  <Upload className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                  <span className="text-sm text-muted-foreground">Click to upload receipt</span>
                  <span className="text-xs text-muted-foreground">JPEG, PNG, WEBP (max 5MB)</span>
                  <input
                    id="receipt-upload"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    aria-label="Upload receipt (JPEG, PNG or WEBP, max 5MB)"
                    aria-required="true"
                    onChange={handleFileUpload}
                  />
                </label>
              )}
            </div>
            {receiptRemoved && (
              <p role="alert" className="text-sm text-red-600">A receipt is required. Please upload a new receipt.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" {...register("notes")} placeholder="Additional notes" />
            {errors.notes && <p role="alert" className="text-sm text-red-600">{errors.notes.message}</p>}
          </div>
        </form>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={saving || submitting || uploading}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={handleSubmit(handleSaveDraft)}
            disabled={saving || submitting || uploading || receiptRemoved}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            {saving ? "Saving..." : "Save as Draft"}
          </Button>
          <Button
            className="bg-indigo-600 hover:bg-indigo-700"
            onClick={handleSubmit(handleSubmitForApproval)}
            disabled={saving || submitting || uploading || receiptRemoved}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            {submitting ? "Submitting..." : "Submit for Approval"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
