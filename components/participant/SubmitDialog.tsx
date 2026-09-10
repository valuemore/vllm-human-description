"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { copy } from "@/lib/copy/participant.ko";

export function SubmitDialog({
  open, onOpenChange, onConfirm, charCount, submitting,
}: { open: boolean; onOpenChange: (o: boolean) => void; onConfirm: () => void; charCount: number; submitting: boolean }) {
  const c = copy.observation;
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="text-[17px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl">{c.submitDialogTitle}</AlertDialogTitle>
          <AlertDialogDescription className="text-base text-neutral-700">
            {charCount === 0 ? c.submitDialogEmpty : c.submitDialogBody}
            <span className="mt-2 block text-sm text-neutral-500">{c.charCount(charCount)}</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-11 text-base" disabled={submitting}>
            {c.submitCancel}
          </AlertDialogCancel>
          <AlertDialogAction
            className="h-11 text-base"
            disabled={submitting}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            {submitting ? c.submitting : c.submitConfirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
