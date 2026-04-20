import { AlertCircle, ExternalLink, Mail, Phone, User } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { DuplicateMatch } from "@/hooks/useDuplicateClientCheck";

const MATCH_LABELS: Record<DuplicateMatch["matched_by"][number], { label: string; icon: React.ElementType }> = {
  email: { label: "E-mail", icon: Mail },
  phone: { label: "Telefone", icon: Phone },
  name: { label: "Nome", icon: User },
};

interface DuplicateClientAlertProps {
  matches: DuplicateMatch[];
  onPickExisting?: (id: string) => void;
  className?: string;
}

/**
 * Banner inline que avisa sobre possíveis duplicatas enquanto o usuário
 * preenche o formulário. Oferece ação para abrir o cliente existente.
 */
export function DuplicateClientAlert({
  matches,
  onPickExisting,
  className,
}: DuplicateClientAlertProps) {
  if (matches.length === 0) return null;

  const isHighConfidence = matches.some(
    (m) => m.matched_by.includes("email") || m.matched_by.includes("phone"),
  );

  return (
    <div
      className={cn(
        "rounded-lg border p-3 space-y-2",
        isHighConfidence
          ? "bg-warning/10 border-warning/30"
          : "bg-muted/50 border-border",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <AlertCircle
          className={cn(
            "h-4 w-4 shrink-0 mt-0.5",
            isHighConfidence ? "text-warning" : "text-muted-foreground",
          )}
        />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-body font-semibold text-foreground">
            {isHighConfidence
              ? "Cliente já existe?"
              : "Possíveis duplicatas encontradas"}
          </p>
          <p className="text-[11px] text-muted-foreground font-body mt-0.5">
            Encontramos {matches.length} cliente{matches.length !== 1 ? "s" : ""} com dados parecidos.
            Verifique antes de criar um novo.
          </p>
        </div>
      </div>

      <ul className="space-y-1.5">
        {matches.map((m) => (
          <li
            key={m.id}
            className="flex items-center gap-2 rounded-md bg-background/80 ring-1 ring-border/60 px-2 py-1.5"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                {m.sequential_code && (
                  <span className="text-[9px] font-mono uppercase text-muted-foreground/70">
                    {m.sequential_code}
                  </span>
                )}
                <span className="text-xs font-body font-medium text-foreground truncate">
                  {m.name}
                </span>
                {m.matched_by.map((reason) => {
                  const meta = MATCH_LABELS[reason];
                  const Icon = meta.icon;
                  return (
                    <span
                      key={reason}
                      className="inline-flex items-center gap-0.5 text-[9px] font-body font-medium px-1 py-0.5 rounded bg-warning/15 text-warning"
                    >
                      <Icon className="h-2.5 w-2.5" />
                      {meta.label}
                    </span>
                  );
                })}
              </div>
              {(m.email || m.phone) && (
                <p className="text-[10px] text-muted-foreground font-body truncate mt-0.5">
                  {m.email || m.phone}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {onPickExisting && (
                <button
                  type="button"
                  onClick={() => onPickExisting(m.id)}
                  className="text-[10px] font-body font-medium text-primary hover:underline"
                >
                  Usar este
                </button>
              )}
              <Link
                to={`/admin/crm/${m.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Abrir cliente"
              >
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
