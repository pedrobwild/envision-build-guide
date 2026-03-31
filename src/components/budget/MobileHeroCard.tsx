import { useState } from "react";
import { motion } from "framer-motion";
import { FileSignature, Bookmark, Clock, AlertTriangle, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { ContractRequestDialog } from "./ContractRequestDialog";

interface MobileHeroCardProps {
  total: number;
  validity: {
    expired: boolean;
    daysLeft: number;
    expiresAt: Date;
  };
  projectName?: string;
  clientName?: string;
  publicId: string;
  budgetId?: string;
  neighborhood?: string;
  area?: string;
  version?: string;
  prazoDiasUteis?: number;
  onSaveForLater?: () => void;
}

const DEFAULT_PHONE = "5511911906183";

function normalizeClientName(value?: string): string {
  if (!value) return "";
  const cleaned = value
    .replace(/\d{3}\.?\d{3}\.?\d{3}[-.]?\d{2}/g, "")
    .replace(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}[-.]?\d{2}/g, "")
    .replace(/\b\d{5,}\b/g, "")
    .replace(/^\s*(?:nome\s+do\s+)?cliente\s*[:\-–]?\s*/i, "")
    .replace(/^\s*(?:orçamento|orcamento|proposta)\s*(?:n[ºo°]\s*\d+)?\s*(?:para|de)?\s*/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!cleaned) return "";
  return cleaned
    .toLocaleLowerCase("pt-BR")
    .split(/\s+/)
    .map((word) => word.replace(/^\p{L}/u, (letter) => letter.toLocaleUpperCase("pt-BR")))
    .join(" ");
}

export function MobileHeroCard({
  total,
  validity,
  projectName,
  clientName,
  publicId,
  budgetId,
  neighborhood,
  area,
  version,
  onSaveForLater,
}: MobileHeroCardProps) {
  const [contractOpen, setContractOpen] = useState(false);
  const displayName = normalizeClientName(clientName);

  const whatsappUpdateUrl = `https://wa.me/${DEFAULT_PHONE}?text=${encodeURIComponent(
    `Olá! O orçamento ${projectName || "do projeto"} (Ref: ${publicId}) expirou. Gostaria de solicitar uma atualização de valores.`
  )}`;

  const metaChips: { label: string; value: string }[] = [];
  if (neighborhood) metaChips.push({ label: "Bairro", value: neighborhood });
  if (area) metaChips.push({ label: "Área", value: area });
  if (version) metaChips.push({ label: "Versão", value: version });

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="lg:hidden rounded-2xl border border-border bg-card overflow-hidden shadow-sm"
      >
        <div className="h-1 bg-gradient-to-r from-primary via-primary/60 to-primary/20" />

        <div className="px-4 pt-3.5 pb-3 space-y-2.5">
          <div>
            <h2 className="font-display font-bold text-lg text-foreground leading-tight tracking-tight">
              {displayName ? `${displayName}, sua proposta está pronta` : "Sua proposta está pronta"}
            </h2>
            <p className="text-sm font-body text-muted-foreground mt-0.5 leading-snug">
              Arquitetura, engenharia e gestão em um único contrato.
            </p>
          </div>

          {metaChips.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="flex flex-wrap gap-1.5"
            >
              {metaChips.map((chip) => (
                <span
                  key={chip.label}
                  className="inline-flex items-center gap-1 text-xs font-body text-foreground bg-muted/60 rounded-md px-2 py-1"
                >
                  <span className="text-muted-foreground">{chip.label}</span>
                  <span className="font-medium">{chip.value}</span>
                </span>
              ))}
            </motion.div>
          )}
        </div>

        <div className="mx-4">
          <motion.div
            initial={{ opacity: 0, x: 6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.45 }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-body font-bold w-fit",
              validity.expired
                ? "bg-destructive/15 text-destructive"
                : validity.daysLeft <= 5
                  ? "bg-warning/15 text-warning"
                  : "bg-success/15 text-success"
            )}
          >
            {validity.expired ? (
              <>
                <AlertTriangle className="h-3 w-3" />
                Condições expiradas
              </>
            ) : (
              <>
                <Clock className={cn("h-3 w-3", validity.daysLeft <= 5 && "animate-pulse")} />
                {validity.daysLeft}d restantes
              </>
            )}
          </motion.div>
        </div>

        <div className="px-4 pt-1 pb-3">
          {onSaveForLater && (
            <button
              onClick={onSaveForLater}
              className="w-full min-h-[44px] rounded-xl border border-border text-foreground font-body font-medium text-sm flex items-center justify-center gap-2 hover:bg-muted/50 transition-colors active:scale-[0.98]"
            >
              <Bookmark className="h-4 w-4 flex-shrink-0" />
              Receber por email
            </button>
          )}
        </div>
      </motion.div>

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
