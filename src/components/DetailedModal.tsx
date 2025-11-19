"use client";
import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

type DetailedModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
};

export default function DetailedModal(props: DetailedModalProps) {
  const { open, onOpenChange, title, children, footer } = props;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[80vw] max-w-[1400px] max-h-[90vh] overflow-y-auto p-4 animate-in fade-in zoom-in-95" aria-label={title}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogClose asChild>
            <Button aria-label="Close" variant="ghost" size="icon" className="absolute right-4 top-4" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onOpenChange(false); }}>
              <X className="h-4 w-4" />
            </Button>
          </DialogClose>
        </DialogHeader>
        <div className="space-y-4">
          {children}
        </div>
        {footer && (
          <DialogFooter>
            {footer}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}