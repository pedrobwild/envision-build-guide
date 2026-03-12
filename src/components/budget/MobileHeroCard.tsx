import { motion } from "framer-motion";
import { MessageCircle, Bookmark, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatBRL } from "@/lib/formatBRL";
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
  included: string[];
}

const DEFAULT_PHONE = "5511911906183";

export function MobileHeroCard({
  total,
  validity,
  projectName,
  clientName,
  publicId,
  included,
}: MobileHeroCardProps) {
  const whatsappMessage = encodeURIComponent(
    `Olá! Sou ${clientName || "cliente"}, estou analisando o orçamento do projeto ${projectName || "do projeto"} (Ref: ${publicId}) e gostaria de conversar sobre os próximos passos.`
  );
  const whatsappUrl = `https://wa.me/${DEFAULT_PHONE}?text=${whatsappMessage}`;

  const whatsappUpdateUrl = `https://wa.me/${DEFAULT_PHONE}?text=${encodeURIComponent(
    `Olá! O orçamento ${projectName || "do projeto"} (Ref: ${publicId}) expirou. Gostaria de solicitar uma atualização de valores.`
  )}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="lg:hidden rounded-xl border border-border bg-card p-4 space-y-4"
    >
      {/* Price + Validity */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-body text-muted-foreground mb-0.5">
            Investimento total
          </p>
          <motion.p
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="font-display font-extrabold text-2xl text-primary tabular-nums leading-none"
          >
            {formatBRL(total)}
          </motion.p>
        </div>

        {/* Validity badge */}
        <motion.div
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className={cn(
            "flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-body font-semibold flex-shrink-0",
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
              Expirado
            </>
          ) : (
            <>
              <Clock className={cn("h-3 w-3", validity.daysLeft <= 5 && "animate-pulse")} />
              {validity.daysLeft}d restantes
            </>
          )}
        </motion.div>
      </div>

      {/* Quick included list */}
      {included.length > 0 && (
        <div className="border-t border-border pt-3">
          <p className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Contemplado
          </p>
          <div className="flex flex-wrap gap-1.5">
            {included.slice(0, 6).map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-1 text-xs font-body text-foreground bg-muted/60 rounded-md px-2 py-1"
              >
                <CheckCircle2 className="h-3 w-3 text-primary flex-shrink-0" />
                {item}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="space-y-2 pt-1">
        {validity.expired ? (
          <a
            href={whatsappUpdateUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full min-h-[48px] rounded-xl bg-primary text-primary-foreground font-display font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          >
            <MessageCircle className="h-4.5 w-4.5" />
            Solicitar atualização
          </a>
        ) : (
          <motion.a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            whileTap={{ scale: 0.98 }}
            className="w-full min-h-[48px] rounded-xl bg-primary text-primary-foreground font-display font-semibold text-sm flex items-center justify-center gap-2"
          >
            <MessageCircle className="h-4.5 w-4.5" />
            Falar com especialista
          </motion.a>
        )}
      </div>
    </motion.div>
  );
}
