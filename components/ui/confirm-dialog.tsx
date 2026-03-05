"use client";

import * as React from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "default",
  onConfirm,
  loading = false,
}: ConfirmDialogProps) {
  const [submitting, setSubmitting] = React.useState(false);
  const isBusy = loading || submitting;

  const handleConfirm = React.useCallback(async () => {
    setSubmitting(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }, [onConfirm, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title}>
      <div className="space-y-4">
        {description && (
          <p className="text-muted-foreground text-sm">{description}</p>
        )}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isBusy}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={variant === "destructive" ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={isBusy}
          >
            {isBusy ? "…" : confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
