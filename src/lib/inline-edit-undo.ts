import { toast } from "sonner";

/**
 * Show a success toast with an "Undo" action.
 * Calls onUndo() if the user clicks the undo action within `durationMs` (default 5s).
 * The toast itself is informational — the actual save has already happened.
 */
export function showUndoToast(opts: {
  message: string;
  description?: string;
  onUndo: () => void | Promise<void>;
  durationMs?: number;
}) {
  toast.success(opts.message, {
    description: opts.description,
    duration: opts.durationMs ?? 5000,
    action: {
      label: "Desfazer",
      onClick: () => {
        void opts.onUndo();
      },
    },
  });
}
