import { Shield, CheckCircle2 } from "lucide-react";

export function TrustBadgesRow() {
  return (
    <div className="flex items-center gap-4 pt-2 mt-1 border-t border-primary/[0.06]">
      <div className="flex items-center gap-1.5">
        <Shield className="h-3 w-3 text-primary/60" aria-hidden />
        <span className="text-[11px] text-muted-foreground font-body leading-none">
          Preço fixo
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <CheckCircle2 className="h-3 w-3 text-primary/60" aria-hidden />
        <span className="text-[11px] text-muted-foreground font-body leading-none">
          Sem custos ocultos
        </span>
      </div>
    </div>
  );
}
