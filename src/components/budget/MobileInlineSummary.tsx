import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Clock,
  AlertTriangle,
  Shield,
  CreditCard,
  MessageCircle,
  ChevronRight,
} from "lucide-react";
import { formatBRL, formatDateLong } from "@/lib/formatBRL";
import { cn } from "@/lib/utils";
import { CategoryDetailDialog } from "./CategoryDetailDialog";
import type { CategorizedGroup } from "@/lib/scope-categories";

interface MobileInlineSummaryProps {
  total: number;
  validity: {
    expired: boolean;
    daysLeft: number;
    expiresAt: Date;
  };
  categorizedGroups: CategorizedGroup[];
  projectName?: string;
  clientName?: string;
  publicId: string;
  onTotalCardVisibilityChange?: (visible: boolean) => void;
}

const INSTALLMENT_OPTIONS = [3, 6, 10, 12, 18];
const DEFAULT_PHONE = "5511911906183";

export function MobileInlineSummary({
  total,
  validity,
  categorizedGroups,
  projectName,
  clientName,
  publicId,
  onTotalCardVisibilityChange,
}: MobileInlineSummaryProps) {
  const [installments, setInstallments] = useState(10);
  const [detailGroup, setDetailGroup] = useState<CategorizedGroup | null>(null);
  const totalCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!totalCardRef.current || !onTotalCardVisibilityChange) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        onTotalCardVisibilityChange(entry.isIntersecting);
      },
      { threshold: 0.5 }
    );

    observer.observe(totalCardRef.current);
    return () => observer.disconnect();
  }, [onTotalCardVisibilityChange]);

  const whatsappMessage = validity.expired
    ? encodeURIComponent(
        `Olá! O orçamento ${projectName || "do projeto"} (Ref: ${publicId}) expirou. Gostaria de solicitar uma atualização de valores.`
      )
    : encodeURIComponent(
        `Olá! Sou ${clientName || "cliente"}, estou analisando o orçamento do projeto ${projectName || "do projeto"} (Ref: ${publicId}) e gostaria de conversar sobre os próximos passos.`
      );
  const whatsappUrl = `https://wa.me/${DEFAULT_PHONE}?text=${whatsappMessage}`;
  const ctaLabel = validity.expired ? "Solicitar atualização" : "Iniciar meu projeto";

  return (
    <div
      id="resumo-mobile"
      className="lg:hidden scroll-mt-24"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="space-y-4"
      >
        {/* Title */}
        <h2 className="text-xl font-display font-bold text-foreground tracking-tight">
          Resumo do investimento
        </h2>

        {/* Validity notice */}
        <div
          className={cn(
            "rounded-xl px-3.5 py-3 flex items-center gap-2.5",
            validity.expired
              ? "bg-destructive/8 border border-destructive/15"
              : validity.daysLeft <= 5
                ? "bg-warning/8 border border-warning/15"
                : "bg-success/8 border border-success/15"
          )}
        >
          {validity.expired ? (
            <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
          ) : (
            <Clock
              className={cn(
                "h-4 w-4 flex-shrink-0",
                validity.daysLeft <= 5 ? "text-warning" : "text-success"
              )}
            />
          )}
          <p
            className={cn(
              "text-[13px] font-body leading-snug",
              validity.expired ? "text-destructive" : "text-foreground"
            )}
          >
            {validity.expired
              ? "Condições expiradas — solicite valores atualizados."
              : `Condições válidas até ${formatDateLong(validity.expiresAt)}`}
          </p>
        </div>

        {/* Category breakdown */}
        {categorizedGroups.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-1">
            <p className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Composição do investimento
            </p>
            {categorizedGroups.map((group) => (
              <button
                key={group.category.id}
                onClick={() => setDetailGroup(group)}
                className="w-full flex items-center gap-3 py-2.5 px-1 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div
                  className={cn(
                    "w-1 h-5 rounded-full flex-shrink-0",
                    group.category.bgClass
                  )}
                />
                <span className="flex-1 text-sm font-body text-foreground leading-snug text-left">
                  {group.category.label}
                </span>
                <span className="text-sm font-mono tabular-nums font-semibold text-foreground whitespace-nowrap">
                  {formatBRL(group.subtotal)}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </button>
            ))}
          </div>
        )}

        {/* Total card — observed by IntersectionObserver */}
        <div
          ref={totalCardRef}
          className="rounded-xl bg-gradient-to-br from-primary/8 to-primary/3 border border-primary/12 p-5"
        >
          <p className="text-[13px] font-body font-medium text-muted-foreground mb-1">
            Investimento total
          </p>
          <p className="font-display font-extrabold text-2xl text-primary tabular-nums leading-none">
            {formatBRL(total)}
          </p>
          <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-primary/10">
            <Shield className="h-3.5 w-3.5 text-primary/40" />
            <span className="text-[13px] text-muted-foreground/80 font-body">
              Preço fixo · Sem custos ocultos
            </span>
          </div>
        </div>

        {/* Installment simulator — scrollable list */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <CreditCard className="h-4 w-4 text-primary" />
            <span className="text-sm font-display font-bold text-foreground">
              Simule o parcelamento
            </span>
          </div>
          <div className="h-[220px] overflow-y-auto rounded-lg border border-border/50 bg-muted/20 divide-y divide-border/30">
            {Array.from({ length: 18 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => setInstallments(n)}
                className={cn(
                  "w-full flex items-center justify-between px-3.5 py-2.5 text-sm font-body transition-colors min-h-[44px]",
                  installments === n
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-foreground hover:bg-muted/50"
                )}
              >
                <span>{n}× {n === 1 ? "parcela" : "parcelas"}</span>
                <span className="font-semibold tabular-nums">{formatBRL(total / n)}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground font-body mt-3 text-center">
            Condições sob consulta com sua consultora
          </p>
        </div>

        {/* Inline CTA — replaces bottom bar CTA when bar hides */}
        <motion.a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          whileTap={{ scale: 0.98 }}
          className="w-full min-h-[52px] rounded-xl bg-primary text-primary-foreground font-display font-semibold text-sm flex items-center justify-center gap-2"
        >
          <MessageCircle className="h-5 w-5 flex-shrink-0" />
          {ctaLabel}
        </motion.a>
      </motion.div>

      <CategoryDetailDialog
        open={!!detailGroup}
        onClose={() => setDetailGroup(null)}
        group={detailGroup}
      />
    </div>
  );
}
