import { useState } from "react";
import { Drawer as VaulDrawer } from "vaul";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/formatBRL";

import { ProposalValidityCard } from "./summary/ProposalValidityCard";
import { CategoryAccordionList } from "./summary/CategoryAccordionList";
import { InstallmentSimulator } from "./summary/InstallmentSimulator";
import { PrimaryCTAButton } from "./summary/PrimaryCTAButton";
import { TrustBadgesRow } from "./summary/TrustBadgesRow";
import { ContractRequestDialog } from "./ContractRequestDialog";
import type { CategorizedGroup } from "@/lib/scope-categories";

interface MobileFinancialSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  total: number;
  validity: {
    expired: boolean;
    daysLeft: number;
    expiresAt: Date;
  };
  categorizedGroups: CategorizedGroup[];
  projectName?: string;
  publicId: string;
  budgetId?: string;
  clientName?: string;
}

const DEFAULT_PHONE = "5511911906183";
const SNAP_POINTS = [0.45, 0.88] as const;
const LABEL = "text-[10px] uppercase tracking-[0.08em] font-body font-semibold text-muted-foreground";
const MONO_STYLE: React.CSSProperties = { fontFeatureSettings: '"tnum" 1', letterSpacing: '-0.02em' };

export function MobileFinancialSheet({
  open,
  onOpenChange,
  total,
  validity,
  categorizedGroups,
  projectName,
  publicId,
  budgetId,
}: MobileFinancialSheetProps) {
  const [snap, setSnap] = useState<number | string | null>(SNAP_POINTS[0]);
  const [installments, setInstallments] = useState(10);
  const [contractOpen, setContractOpen] = useState(false);

  const whatsappUpdateUrl = `https://wa.me/${DEFAULT_PHONE}?text=${encodeURIComponent(
    `Olá! O orçamento ${projectName || "do projeto"} (Ref: ${publicId}) expirou. Gostaria de solicitar uma atualização de valores.`
  )}`;

  return (
    <>
      <VaulDrawer.Root
        open={open}
        onOpenChange={onOpenChange}
        snapPoints={[...SNAP_POINTS]}
        activeSnapPoint={snap}
        setActiveSnapPoint={setSnap}
        modal={true}
      >
        <VaulDrawer.Portal>
          <VaulDrawer.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" />
          <VaulDrawer.Content
            className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl border-t border-border bg-card shadow-[0_-8px_30px_-10px_hsl(var(--foreground)/0.12)] outline-none"
            style={{ height: "85vh" }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1.5 w-12 rounded-full bg-muted-foreground/20" />
            </div>

            {/* Scrollable content */}
            <div
              className={cn(
                "flex-1 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] space-y-4",
                snap === SNAP_POINTS[0] && "overflow-hidden"
              )}
            >
              {/* ── Total card (compact for sheet) ── */}
              <div
                className="relative rounded-2xl border border-primary/10 px-5 py-4 overflow-hidden"
                style={{
                  background: 'linear-gradient(145deg, hsl(var(--primary) / 0.06) 0%, hsl(var(--primary) / 0.02) 40%, hsl(var(--background)) 100%)',
                  boxShadow: '0 6px 24px -6px hsl(var(--primary) / 0.10), 0 2px 6px -2px hsl(var(--primary) / 0.04)',
                }}
              >
                <div
                  className="absolute -top-16 -right-16 w-36 h-36 rounded-full pointer-events-none"
                  style={{ background: 'radial-gradient(circle, hsl(var(--primary) / 0.06) 0%, transparent 70%)' }}
                  aria-hidden
                />
                <div className="relative space-y-3">
                  <div className="space-y-1.5">
                    <p className={LABEL}>Investimento total</p>
                    <p
                      className={cn(
                        "font-mono font-extrabold text-primary tabular-nums leading-none",
                        total >= 1_000_000 ? "text-lg" : "text-xl"
                      )}
                      style={{ letterSpacing: '-0.03em', fontFeatureSettings: '"tnum" 1' }}
                    >
                      {formatBRL(total)}
                    </p>
                  </div>

                  {/* Installment preview inline */}
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-[12px] font-body text-muted-foreground">ou</span>
                    <span className="font-mono text-sm font-semibold text-foreground tabular-nums" style={MONO_STYLE}>
                      {formatBRL(total / installments)}
                    </span>
                    <span className="text-[12px] font-body text-muted-foreground">
                      em {installments}× sem juros
                    </span>
                  </div>

                  <TrustBadgesRow />
                </div>
              </div>

              {/* ── Validity ── */}
              <ProposalValidityCard
                expired={validity.expired}
                daysLeft={validity.daysLeft}
                expiresAt={validity.expiresAt}
              />

              {/* ── Composition accordion ── */}
              <CategoryAccordionList
                categorizedGroups={categorizedGroups}
                total={total}
              />

              {/* ── Installment simulator ── */}
              <InstallmentSimulator
                total={total}
                installments={installments}
                onInstallmentsChange={setInstallments}
              />

              {/* ── CTA ── */}
              {validity.expired ? (
                <PrimaryCTAButton
                  expired
                  whatsappUrl={whatsappUpdateUrl}
                />
              ) : (
                <PrimaryCTAButton
                  expired={false}
                  onClick={() => setContractOpen(true)}
                />
              )}
            </div>
          </VaulDrawer.Content>
        </VaulDrawer.Portal>
      </VaulDrawer.Root>

      <ContractRequestDialog
        open={contractOpen}
        onOpenChange={setContractOpen}
        budgetId={budgetId || ""}
        publicId={publicId}
        projectName={projectName}
        total={total}
      />
    </>
  );
}
