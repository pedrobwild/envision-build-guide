import { calculateSectionSubtotal } from "@/lib/supabase-helpers";
import { formatBRL } from "@/lib/formatBRL";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ArrowLeft } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import type { CategorizedGroup } from "@/lib/scope-categories";

interface CategoryDetailDialogProps {
  open: boolean;
  onClose: () => void;
  group: CategorizedGroup | null;
  budgetId?: string;
  editable?: boolean;
}

function CategoryItemList({ group, budgetId, editable }: { group: CategorizedGroup; budgetId?: string; editable?: boolean }) {
  const allItems = group.sections.flatMap(section =>
    (section.items || []).map((item: any) => ({ ...item, _sectionTitle: section.title }))
  );

  return (
    <>
      <p className="text-xs text-muted-foreground font-body mb-3">
        {allItems.length} {allItems.length === 1 ? "item" : "itens"}
      </p>
      <div className="space-y-1">
        {allItems.map((item: any) => (
          <div
            key={item.id}
            className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/40 transition-colors"
          >
            <span className="text-sm font-body text-foreground leading-snug mr-3">
              {item.qty && item.qty > 1 ? `${item.qty}× ` : ""}
              {item.title}
            </span>
            {item.unit && (
              <span className="text-xs text-muted-foreground font-body whitespace-nowrap">
                {item.unit}
              </span>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

export function CategoryDetailDialog({ open, onClose, group, budgetId, editable = false }: CategoryDetailDialogProps) {
  const isMobile = useIsMobile();

  if (!group) return null;

  const titleContent = (
    <div className="flex items-center gap-2 font-display">
      <button
        onClick={onClose}
        className="flex items-center justify-center h-8 w-8 rounded-lg hover:bg-muted/60 active:bg-muted transition-colors flex-shrink-0 -ml-1"
        aria-label="Voltar"
      >
        <ArrowLeft className="h-5 w-5 text-foreground" />
      </button>
      <div className={`w-1.5 h-5 rounded-full ${group.category.bgClass}`} />
      <span className="truncate">{group.category.label}</span>
      <span className={`ml-auto text-base font-mono tabular-nums shrink-0 ${group.category.colorClass}`}>
        {formatBRL(group.subtotal)}
      </span>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={(v) => !v && onClose()}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="border-b border-border px-5 py-3.5">
            <DrawerTitle>{titleContent}</DrawerTitle>
          </DrawerHeader>
          <div className="px-5 py-4 overflow-y-auto">
            <CategoryItemList group={group} budgetId={budgetId} editable={editable} />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="left" className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl p-0 overflow-y-auto">
        <SheetHeader className="sticky top-0 z-10 bg-card border-b border-border px-5 py-4">
          <SheetTitle>{titleContent}</SheetTitle>
        </SheetHeader>
        <div className="px-4 sm:px-5 py-5">
          <CategoryItemList group={group} budgetId={budgetId} editable={editable} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
