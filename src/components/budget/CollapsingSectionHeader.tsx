import { useRef, useState, useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CollapsingSectionHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  /** Extra content shown only when expanded (not sticky) */
  children?: ReactNode;
  className?: string;
}

/**
 * A mobile-only sticky section header that collapses when it becomes stuck
 * to the top of the viewport, freeing vertical space for content.
 *
 * - Expanded: full title (text-base), subtitle visible, icon at normal size
 * - Collapsed (sticky): smaller title (text-sm), subtitle hidden, compact padding
 */
export function CollapsingSectionHeader({
  title,
  subtitle,
  icon,
  children,
  className,
}: CollapsingSectionHeaderProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [isStuck, setIsStuck] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsStuck(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/* Invisible sentinel — when it scrolls out of view, header is "stuck" */}
      <div ref={sentinelRef} className="lg:hidden h-0 w-full" aria-hidden="true" />

      <div
        className={cn(
          "lg:hidden sticky top-0 z-20 transition-all duration-200 ease-out",
          isStuck
            ? "bg-background/95 backdrop-blur-md border-b border-border/60 shadow-sm py-2 px-3"
            : "bg-transparent py-3 px-1",
          className
        )}
      >
        <div className="flex items-center gap-2.5">
          {icon && (
            <div
              className={cn(
                "rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 transition-all duration-200",
                isStuck ? "w-7 h-7" : "w-10 h-10"
              )}
            >
              <div className={cn("text-primary transition-all duration-200", isStuck ? "scale-75" : "scale-100")}>
                {icon}
              </div>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3
              className={cn(
                "font-display font-bold text-foreground leading-tight tracking-tight transition-all duration-200",
                isStuck ? "text-sm" : "text-base sm:text-lg"
              )}
            >
              {title}
            </h3>
            {subtitle && (
              <p
                className={cn(
                  "text-xs text-muted-foreground font-body mt-0.5 transition-all duration-200 overflow-hidden",
                  isStuck ? "max-h-0 opacity-0 mt-0" : "max-h-10 opacity-100"
                )}
              >
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Extra content — hidden when stuck */}
        {children && (
          <div
            className={cn(
              "transition-all duration-200 overflow-hidden",
              isStuck ? "max-h-0 opacity-0" : "max-h-40 opacity-100 mt-2"
            )}
          >
            {children}
          </div>
        )}
      </div>
    </>
  );
}
