import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronUp,
  X,
  MessageCircle,
  Clock,
  AlertTriangle,
  Shield,
  CreditCard,
  Bookmark,
  Award,
  CheckCircle2,
} from "lucide-react";
import { formatBRL, formatDateLong } from "@/lib/formatBRL";
import { cn } from "@/lib/utils";
import type { CategorizedGroup } from "@/lib/scope-categories";

interface MobileBottomBarProps {
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
  onSaveForLater?: () => void;
}

const DEFAULT_PHONE = "5511911906183";

export function MobileBottomBar({
  total,
  validity,
  categorizedGroups,
  projectName,
  clientName,
  publicId,
  onSaveForLater,
}: MobileBottomBarProps) {
  const [open, setOpen] = useState(false);
  const [installments, setInstallments] = useState(10);

  const whatsappMessage = validity.expired
    ? encodeURIComponent(
        `Olá! O orçamento ${projectName || "do projeto"} (Ref: ${publicId}) expirou. Gostaria de solicitar uma atualização de valores.`
      )
    : encodeURIComponent(
        `Olá! Sou ${clientName || "cliente"}, estou analisando o orçamento do projeto ${projectName || "do projeto"} (Ref: ${publicId}) e gostaria de conversar sobre os próximos passos.`
      );
  const whatsappUrl = `https://wa.me/${DEFAULT_PHONE}?text=${whatsappMessage}`;

  const ctaLabel = validity.expired ? "Solicitar atualização" : "Iniciar meu projeto";

  const installmentOptions = [3, 6, 10, 12, 18];

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50" data-pdf-hide>
      {/* Backdrop */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-foreground/40 z-40"
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Drawer */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="relative z-50 bg-card border-t border-border rounded-t-2xl max-h-[80vh] overflow-y-auto shadow-2xl"
          >
            {/* Grab handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-muted rounded-full" />
            </div>

            {/* Header */}
            <div className="sticky top-0 bg-card z-10 px-4 pt-1 pb-3 flex items-center justify-between">
              <span className="text-sm font-display font-bold text-foreground">
                Resumo do investimento
              </span>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-full hover:bg-muted transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <div className="px-4 pb-6 space-y-5">
              {/* ── Validity notice ── */}
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
                      validity.daysLeft <= 5 ? "text-warning animate-pulse" : "text-success"
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
                    ? "Valores expirados — solicite atualização."
                    : `Válido até ${formatDateLong(validity.expiresAt)}`}
                </p>
              </div>

              {/* ── Category breakdown ── */}
              {categorizedGroups.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Composição
                  </p>
                  {categorizedGroups.map((group) => (
                    <div
                      key={group.category.id}
                      className="flex items-center gap-3 py-2"
                    >
                      <div
                        className={cn(
                          "w-1 h-5 rounded-full flex-shrink-0",
                          group.category.bgClass
                        )}
                      />
                      <span className="flex-1 text-sm font-body text-foreground leading-snug">
                        {group.category.label}
                      </span>
                      <span className="text-sm font-mono tabular-nums font-semibold text-foreground whitespace-nowrap">
                        {formatBRL(group.subtotal)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Total card ── */}
              <div className="rounded-xl bg-gradient-to-br from-primary/8 to-primary/3 border border-primary/12 p-4">
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

              {/* ── Quick installment selector ── */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard className="h-4 w-4 text-primary" />
                  <span className="text-sm font-display font-bold text-foreground">
                    Parcele em até 18×
                  </span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {installmentOptions.map((n) => (
                    <button
                      key={n}
                      onClick={() => setInstallments(n)}
                      className={cn(
                        "min-h-[44px] min-w-[44px] px-3 py-2 rounded-lg text-sm font-body font-medium transition-all",
                        installments === n
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-muted/60 text-foreground hover:bg-muted"
                      )}
                    >
                      {n}×
                    </button>
                  ))}
                </div>
                <motion.div
                  key={installments}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 text-center"
                >
                  <p className="text-sm text-muted-foreground font-body">
                    {installments}× de{" "}
                    <span className="font-display font-bold text-lg text-primary tabular-nums">
                      {formatBRL(total / installments)}
                    </span>
                  </p>
                </motion.div>
                <p className="text-xs text-muted-foreground font-body mt-2 text-center">
                  Consultar condições com sua consultora comercial
                </p>
              </div>

              {/* ── CTAs ── */}
              <div className="space-y-2 pt-1">
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

                {onSaveForLater && (
                  <button
                    onClick={onSaveForLater}
                    className="w-full min-h-[44px] rounded-xl border border-border text-foreground font-body font-medium text-sm flex items-center justify-center gap-2 hover:bg-muted/50 transition-colors"
                  >
                    <Bookmark className="h-4 w-4 flex-shrink-0" />
                    Salvar para revisar depois
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Sticky bar (collapsed) ── */}
      {!open && (
        <div className="relative z-50 bg-card border-t border-border">
          {/* Trust micro-line */}
          <div className="flex items-center justify-center gap-3 px-4 py-1 bg-muted/30 border-b border-border">
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-body">
              <Shield className="h-2.5 w-2.5" />
              Preço fixo
            </span>
            <span className="text-muted-foreground/20">·</span>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-body">
              <Award className="h-2.5 w-2.5" />
              Garantia 5 anos
            </span>
            <span className="text-muted-foreground/20">·</span>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-body">
              <CheckCircle2 className="h-2.5 w-2.5" />
              Sem custos ocultos
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom,0px))]">
            {/* Left: total + expand trigger */}
            <button
              onClick={() => setOpen(true)}
              className="flex flex-col min-h-[44px] justify-center"
            >
              <span className="font-display font-bold text-foreground text-base tabular-nums">
                {formatBRL(total)}
              </span>
              <span className="text-[11px] text-muted-foreground font-body flex items-center gap-1">
                <ChevronUp className="h-3 w-3" />
                Composição e parcelas
              </span>
            </button>

            {/* Right: CTA */}
            <motion.a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              whileTap={{ scale: 0.97 }}
              className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-display font-bold text-sm min-h-[48px] flex items-center gap-2 whitespace-nowrap"
            >
              <MessageCircle className="h-4 w-4 flex-shrink-0" />
              {ctaLabel}
            </motion.a>
          </div>
        </div>
      )}
    </div>
  );
}
