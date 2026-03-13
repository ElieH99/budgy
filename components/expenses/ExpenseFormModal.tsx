"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { type Id } from "@/convex/_generated/dataModel";
import { expenseFormSchema, type ExpenseFormValues } from "@/lib/validators";
import { CURRENCIES, ACCEPTED_RECEIPT_TYPES, MAX_RECEIPT_SIZE_BYTES } from "@/lib/constants";
import { useToast } from "@/components/ui/toast";
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
import { Upload, X, Loader2 } from "lucide-react";

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
  const { toast } = useToast();
  const categories = useQuery(api.categories.listCategories);
  const createDraft = useMutation(api.expenses.createDraft);
  const saveDraft = useMutation(api.expenses.saveDraft);
  const submitExpense = useMutation(api.expenses.submitExpense);
  const resubmitExpense = useMutation(api.expenses.resubmitExpense);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);

  const [uploading, setUploading] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
      amount: undefined as unknown as number,
      currencyCode: "USD",
      categoryId: "",
      expenseDate: Date.now(),
      notes: "",
      receiptStorageId: "",
      ...defaultValues,
    },
  });

  const receiptStorageId = watch("receiptStorageId");

  useEffect(() => {
    if (open && defaultValues) {
      reset({
        title: "",
        description: "",
        amount: undefined as unknown as number,
        currencyCode: "USD",
        categoryId: "",
        expenseDate: Date.now(),
        notes: "",
        receiptStorageId: "",
        ...defaultValues,
      });
      if (defaultValues.receiptStorageId) {
        setReceiptPreview("existing");
      }
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
    }
  }, [open, defaultValues, reset]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_RECEIPT_TYPES.includes(file.type as typeof ACCEPTED_RECEIPT_TYPES[number])) {
      toast({ title: "Invalid file type", description: "Only JPEG, PNG, and WEBP files are accepted", variant: "destructive" });
      return;
    }
    if (file.size > MAX_RECEIPT_SIZE_BYTES) {
      toast({ title: "File too large", description: "File must be under 5 MB", variant: "destructive" });
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
      toast({ title: "Upload failed", description: "Failed to upload receipt. Please try again.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleSaveDraft = async (data: ExpenseFormValues) => {
    setSaving(true);
    try {
      if (mode === "create") {
        await createDraft({
          title: data.title,
          description: data.description,
          amount: data.amount,
          currencyCode: data.currencyCode,
          categoryId: data.categoryId as Id<"categories">,
          expenseDate: data.expenseDate,
          notes: data.notes,
          receiptStorageId: data.receiptStorageId,
        });
        toast({ title: "Draft saved" });
      } else if (expenseId) {
        await saveDraft({
          expenseId,
          title: data.title,
          description: data.description,
          amount: data.amount,
          currencyCode: data.currencyCode,
          categoryId: data.categoryId as Id<"categories">,
          expenseDate: data.expenseDate,
          notes: data.notes,
          receiptStorageId: data.receiptStorageId,
        });
        toast({ title: "Draft updated" });
      }
      onClose();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to save draft", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitForApproval = async (data: ExpenseFormValues) => {
    if (!data.receiptStorageId) {
      toast({ title: "Receipt required", description: "Please upload a receipt before submitting", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "create") {
        const newId = await createDraft({
          title: data.title,
          description: data.description,
          amount: data.amount,
          currencyCode: data.currencyCode,
          categoryId: data.categoryId as Id<"categories">,
          expenseDate: data.expenseDate,
          notes: data.notes,
          receiptStorageId: data.receiptStorageId,
        });
        await submitExpense({ expenseId: newId });
        toast({ title: "Expense submitted for approval" });
      } else if (expenseId) {
        await saveDraft({
          expenseId,
          title: data.title,
          description: data.description,
          amount: data.amount,
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
        toast({ title: "Expense submitted for approval" });
      }
      onClose();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to submit expense", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isDirty) {
      if (!confirm("You have unsaved changes. Are you sure you want to close?")) return;
    }
    onClose();
  };

  const expenseDateValue = watch("expenseDate");
  const dateString = expenseDateValue
    ? new Date(expenseDateValue).toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];

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
            <Input id="title" {...register("title")} placeholder="Expense title" aria-describedby={errors.title ? "title-error" : undefined} />
            {errors.title && <p id="title-error" className="text-sm text-red-600">{errors.title.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea id="description" {...register("description")} placeholder="Describe the expense" aria-describedby={errors.description ? "description-error" : undefined} />
            {errors.description && <p id="description-error" className="text-sm text-red-600">{errors.description.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select
                value={watch("categoryId")}
                onValueChange={(val) => setValue("categoryId", val, { shouldDirty: true, shouldValidate: true })}
              >
                <SelectTrigger>
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
              {errors.categoryId && <p id="category-error" className="text-sm text-red-600">{errors.categoryId.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Currency *</Label>
              <Select
                value={watch("currencyCode")}
                onValueChange={(val) => setValue("currencyCode", val as ExpenseFormValues["currencyCode"], { shouldDirty: true, shouldValidate: true })}
              >
                <SelectTrigger>
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
              {errors.currencyCode && <p className="text-sm text-red-600">{errors.currencyCode.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                {...register("amount", { valueAsNumber: true })}
                placeholder="0.00"
                aria-describedby={errors.amount ? "amount-error" : undefined}
              />
              {errors.amount && <p id="amount-error" className="text-sm text-red-600">{errors.amount.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="expenseDate">Expense Date *</Label>
              <Input
                id="expenseDate"
                type="date"
                value={dateString}
                onChange={(e) => {
                  const d = new Date(e.target.value);
                  setValue("expenseDate", d.getTime(), { shouldDirty: true, shouldValidate: true });
                }}
              />
              {errors.expenseDate && <p className="text-sm text-red-600">{errors.expenseDate.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Receipt *</Label>
            <div className="border-2 border-dashed rounded-md p-4">
              {uploading ? (
                <div className="flex items-center justify-center gap-2 py-4">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm text-muted-foreground">Uploading...</span>
                </div>
              ) : receiptStorageId || receiptPreview ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {receiptPreview && receiptPreview !== "existing" ? (
                      <img src={receiptPreview} alt="Receipt preview" className="h-16 w-16 object-cover rounded" />
                    ) : (
                      <div className="h-16 w-16 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">
                        Receipt
                      </div>
                    )}
                    <span className="text-sm text-green-600">Receipt uploaded</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label="Remove receipt"
                    onClick={() => {
                      setValue("receiptStorageId", "", { shouldDirty: true });
                      setReceiptPreview(null);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center gap-2 cursor-pointer py-4">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Click to upload receipt</span>
                  <span className="text-xs text-muted-foreground">JPEG, PNG, WEBP (max 5MB)</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" {...register("notes")} placeholder="Additional notes" />
            {errors.notes && <p className="text-sm text-red-600">{errors.notes.message}</p>}
          </div>
        </form>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={saving || submitting}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={handleSubmit(handleSaveDraft)}
            disabled={saving || submitting}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {saving ? "Saving..." : "Save as Draft"}
          </Button>
          <Button
            className="bg-indigo-600 hover:bg-indigo-700"
            onClick={handleSubmit(handleSubmitForApproval)}
            disabled={saving || submitting}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submitting ? "Submitting..." : "Submit for Approval"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
