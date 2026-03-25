import { motion } from "framer-motion";
import { MessageCircle, Bookmark, Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

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
  /** Optional meta chips: bairro, area, version */
  neighborhood?: string;
  area?: string;
  version?: string;
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
  neighborhood,
  area,
  version,
  onSaveForLater,
}: MobileHeroCardProps) {
  const displayName = normalizeClientName(clientName);

  const whatsappMessage = encodeURIComponent(
    `Olá! Sou ${displayName || "cliente"}, estou analisando o orçamento do projeto ${projectName || "do projeto"} (Ref: ${publicId}) e gostaria de conversar sobre os próximos passos.`
  );
  const whatsappUrl = `https://wa.me/${DEFAULT_PHONE}?text=${whatsappMessage}`;

  const whatsappUpdateUrl = `https://wa.me/${DEFAULT_PHONE}?text=${encodeURIComponent(
    `Olá! O orçamento ${projectName || "do projeto"} (Ref: ${publicId}) expirou. Gostaria de solicitar uma atualização de valores.`
  )}`;

  const ctaUrl = validity.expired ? whatsappUpdateUrl : whatsappUrl;
  const ctaLabel = validity.expired ? "Solicitar atualização" : "Iniciar meu projeto";

  // Meta chips
  const metaChips: { label: string; value: string }[] = [];
  if (neighborhood) metaChips.push({ label: "Bairro", value: neighborhood });
  if (area) metaChips.push({ label: "Área", value: area });
  if (version) metaChips.push({ label: "Versão", value: version });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="lg:hidden rounded-2xl border border-border bg-card overflow-hidden"
    >
      {/* ── Top: context ── */}
      <div className="px-4 pt-4 pb-3 space-y-2">
        {/* Greeting + subtitle */}
        <div>
          <h2 className="font-display font-bold text-lg text-foreground leading-tight tracking-tight">
            {displayName ? `${displayName}, sua proposta está pronta` : "Sua proposta está pronta"}
          </h2>
          <p className="text-sm font-body text-muted-foreground mt-0.5 leading-snug">
            Arquitetura, engenharia e gestão em um único contrato.
          </p>
        </div>

        {/* Meta chips */}
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

      {/* ── Validity badge ── */}
      <div className="mx-4">
        <motion.div
          initial={{ opacity: 0, x: 6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.45 }}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-body font-semibold w-fit",
            validity.expired
              ? "bg-destructive/10 text-destructive"
              : validity.daysLeft <= 5
                ? "bg-warning/10 text-warning"
                : "bg-success/10 text-success"
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

      {/* ── CTAs ── */}
      <div className="px-4 pt-3 pb-4 space-y-2">
        <motion.a
          href={ctaUrl}
          target="_blank"
          rel="noopener noreferrer"
          whileTap={{ scale: 0.98 }}
          className="w-full min-h-[48px] rounded-xl bg-primary text-primary-foreground font-display font-semibold text-sm flex items-center justify-center gap-2"
        >
          <MessageCircle className="h-4.5 w-4.5 flex-shrink-0" />
          {ctaLabel}
        </motion.a>

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
  );
}
