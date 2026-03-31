import { cn } from "@/lib/utils";

function Shimmer({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg bg-muted",
        className
      )}
      {...props}
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  );
}

/** Header skeleton — matches BudgetHeader mobile layout */
function HeaderSkeleton() {
  return (
    <div className="relative overflow-hidden">
      <Shimmer className="h-28 w-full rounded-none" />
    </div>
  );
}

/** Trust Strip skeleton — horizontal chips */
function TrustStripSkeleton() {
  return (
    <div className="lg:hidden space-y-3">
      <div className="flex gap-2 overflow-hidden px-1 pb-1">
        <Shimmer className="h-10 w-32 rounded-xl flex-shrink-0" />
        {[1, 2, 3, 4].map((i) => (
          <Shimmer key={i} className="h-10 w-28 rounded-xl flex-shrink-0" />
        ))}
      </div>
      <Shimmer className="h-8 w-48 rounded-xl" />
    </div>
  );
}

/** Section cards skeleton */
function SectionCardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 pt-4 pb-2 flex items-start gap-3">
            <Shimmer className="w-9 h-9 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Shimmer className="h-5 w-2/3" />
              <Shimmer className="h-3.5 w-1/3" />
            </div>
          </div>
          <div className="px-4 py-2 border-y border-border bg-muted/30 flex justify-between">
            <Shimmer className="h-3.5 w-16" />
            <Shimmer className="h-3.5 w-20" />
          </div>
          <div className="px-4 py-2 space-y-2">
            {[1, 2, 3].map((j) => (
              <div key={j} className="flex items-center gap-2.5 py-1.5">
                <Shimmer className="w-8 h-8 rounded-lg flex-shrink-0" />
                <Shimmer className="h-3.5 flex-1" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Product showcase grid skeleton */
function ProductGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 pt-2 pb-3">
        <Shimmer className="h-6 w-40" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
            <Shimmer className="h-40 w-full rounded-none" />
            <div className="p-3 space-y-2">
              <Shimmer className="h-4 w-3/4" />
              <Shimmer className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Desktop sidebar skeleton */
function SidebarSkeleton() {
  return (
    <div className="hidden lg:block">
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <Shimmer className="h-5 w-32" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex justify-between">
              <Shimmer className="h-4 w-24" />
              <Shimmer className="h-4 w-16" />
            </div>
          ))}
        </div>
        <Shimmer className="h-px w-full" />
        <div className="flex justify-between">
          <Shimmer className="h-6 w-28" />
          <Shimmer className="h-6 w-20" />
        </div>
        <Shimmer className="h-10 w-full rounded-lg" />
        <Shimmer className="h-10 w-full rounded-lg" />
      </div>
    </div>
  );
}

/** Full-page budget loading skeleton */
export function PublicBudgetSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header skeleton — dark gradient matching real header */}
      <div className="relative overflow-hidden h-28 lg:h-44 bg-gradient-to-b from-[hsl(210,20%,18%)] via-[hsl(210,18%,22%)] to-[hsl(210,16%,26%)]">
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_infinite] bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 flex items-center justify-between">
          <Shimmer className="h-10 w-24 rounded bg-white/10" />
          <Shimmer className="h-8 w-14 rounded-lg bg-white/10" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 space-y-1.5">
          <Shimmer className="h-6 w-40 rounded bg-white/10" />
          <Shimmer className="h-3.5 w-52 rounded bg-white/10" />
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-3">
        {/* Trust Strip */}
        <TrustStripSkeleton />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 lg:gap-8 mt-3 lg:mt-0">
          <div className="min-w-0 space-y-4">
            {/* Service expanders */}
            <SectionCardsSkeleton count={2} />

            {/* Product grid */}
            <ProductGridSkeleton count={4} />

            {/* Summary skeleton — mobile */}
            <div className="lg:hidden rounded-xl border border-border bg-card p-4 space-y-3">
              <Shimmer className="h-5 w-44" />
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex justify-between py-2">
                    <Shimmer className="h-4 w-32" />
                    <Shimmer className="h-4 w-20" />
                  </div>
                ))}
              </div>
              <Shimmer className="h-16 w-full rounded-xl" />
            </div>
          </div>

          {/* Desktop sidebar */}
          <SidebarSkeleton />
        </div>
      </main>
    </div>
  );
}
