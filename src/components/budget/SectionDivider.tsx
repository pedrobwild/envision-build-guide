import { cn } from "@/lib/utils";

interface SectionDividerProps {
  className?: string;
}

/** Subtle gradient divider between major content sections */
export function SectionDivider({ className }: SectionDividerProps) {
  return (
    <div className={cn("flex items-center justify-center py-2", className)} aria-hidden="true">
      <div className="h-px w-full max-w-[200px] bg-gradient-to-r from-transparent via-border to-transparent" />
    </div>
  );
}
