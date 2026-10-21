import { useEffect, type ReactNode } from "react";

import { XIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  busy?: boolean;
}

const sizeClasses: Record<NonNullable<ModalProps["size"]>, string> = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
};

export function Modal({ open, onClose, title, description, children, footer, size = "md", busy = false }: ModalProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, busy, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1200] flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-lagoon-950/50 backdrop-blur-sm" onClick={busy ? undefined : onClose} />
      <div
        className={cn(
          "relative flex max-h-[92vh] w-full flex-col overflow-hidden glass rounded-t-3xl sm:rounded-2xl",
          sizeClasses[size],
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line/60 px-5 py-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-lagoon-900">{title}</h2>
            {description ? <p className="mt-0.5 text-sm text-ink-600">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="shrink-0 rounded-lg p-1.5 text-ink-500 transition-colors hover:bg-sand-100 hover:text-ink-900 disabled:opacity-50"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer ? <div className="flex items-center justify-end gap-2 border-t border-line/60 px-5 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}
