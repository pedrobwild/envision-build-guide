import { Shield, CheckCircle2 } from "lucide-react";

export function TrustBadgesRow() {
  return (
    <div className="flex items-center gap-x-3 gap-y-1 flex-wrap pt-2 mt-1 border-t border-primary/[0.06]">
      <div className="flex items-center gap-1.5 whitespace-nowrap">
        <Shield className="h-3 w-3 text-primary/60 flex-shrink-0" aria-hidden />
        <span className="text-[11px] text-muted-foreground font-body leading-none">
          Preço fixo
        </span>
      </div>
      <div className="flex items-center gap-1.5 whitespace-nowrap">
        <CheckCircle2 className="h-3 w-3 text-primary/60 flex-shrink-0" aria-hidden />
        <span className="text-[11px] text-muted-foreground font-body leading-none">
          Sem custos ocultos
        </span>
      </div>
    </div>
  );
}
