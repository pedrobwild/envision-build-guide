// =============================================================================
// AssistantLauncher — botão flutuante global + atalho Ctrl/Cmd+J
// =============================================================================

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { AssistantPanel } from "@/components/ai/AssistantPanel";
import { cn } from "@/lib/utils";

export function AssistantLauncher() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        aria-label="Abrir Assistente BWild"
        onClick={() => setOpen(true)}
        className={cn(
          "fixed z-40 bottom-20 lg:bottom-6 right-6 size-12 rounded-full",
          "bg-primary text-primary-foreground shadow-lg shadow-primary/30",
          "flex items-center justify-center",
          "hover:scale-105 active:scale-95 transition-transform",
          "ring-2 ring-primary/20",
        )}
      >
        <Sparkles className="size-5" />
        <span className="sr-only">Assistente</span>
      </button>
      <AssistantPanel open={open} onOpenChange={setOpen} />
    </>
  );
}
