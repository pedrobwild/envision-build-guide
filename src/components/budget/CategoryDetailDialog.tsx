import { calculateSectionSubtotal } from "@/lib/supabase-helpers";
import { formatBRL } from "@/lib/formatBRL";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CategorizedGroup } from "@/lib/scope-categories";

interface CategoryDetailDialogProps {
  open: boolean;
  onClose: () => void;
  group: CategorizedGroup | null;
}

export function CategoryDetailDialog({ open, onClose, group }: CategoryDetailDialogProps) {
  if (!group) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto overflow-x-hidden w-[calc(100vw-2rem)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <div className={`w-1.5 h-5 rounded-full ${group.category.bgClass}`} />
            {group.category.label}
            <span className={`ml-auto text-sm font-mono tabular-nums ${group.category.colorClass}`}>
              {formatBRL(group.subtotal)}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          {group.sections.map((section) => {
            const subtotal = calculateSectionSubtotal(section);
            const items = section.items || [];

            return (
              <div key={section.id} className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-display font-semibold text-foreground">
                    {section.qty && section.qty > 1 ? `${section.qty}× ` : ""}{section.title}
                  </span>
                  <span className="text-sm font-mono tabular-nums text-muted-foreground font-medium">
                    {formatBRL(subtotal)}
                  </span>
                </div>

                {items.length > 0 && (
                  <div className="space-y-1">
                    {items.map((item: any) => {
                      const itemTotal = item.internal_total ?? (item.qty && item.internal_unit_price ? item.qty * item.internal_unit_price : 0);
                      return (
                        <div key={item.id} className="py-1.5 px-2 rounded text-xs">
                          <span className="text-muted-foreground font-body break-words">
                            {item.qty && item.qty > 1 ? `${item.qty}× ` : ""}{item.title}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
