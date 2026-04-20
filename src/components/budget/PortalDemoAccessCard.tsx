import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Sparkles, Copy, Check } from "lucide-react";
import { toast } from "sonner";

export const PORTAL_DEMO_EMAIL = "demo@bwild.com.br";
export const PORTAL_DEMO_PASSWORD = "123456";
export const PORTAL_DEMO_URL = `https://portal-bwild.lovable.app/obra/6e451628-4818-4d36-8011-2db95c2b6b1b?email=${encodeURIComponent(PORTAL_DEMO_EMAIL)}&password=${encodeURIComponent(PORTAL_DEMO_PASSWORD)}`;

/**
 * Card destacado para o cliente acessar a obra demo do Portal BWild.
 * Tenta pré-preencher login via query params; também exibe credenciais
 * com botão "Copiar" como fallback (perfil customer somente leitura).
 */
export function PortalDemoAccessCard() {
  const [copied, setCopied] = useState<"email" | "password" | null>(null);

  const handleCopy = async (value: string, type: "email" | "password") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(type);
      toast.success(`${type === "email" ? "E-mail" : "Senha"} copiado`);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-background to-background overflow-hidden">
      <CardContent className="p-4 sm:p-5 md:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <h3 className="text-base sm:text-lg font-display font-bold text-foreground">
              Veja o Portal em ação
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground font-body leading-relaxed">
              Navegue por uma obra real: cronograma, fotos semanais, documentos e relatórios — exatamente o que você terá durante a sua reforma.
            </p>
          </div>
          <Button asChild size="default" className="w-full sm:w-auto gap-2 flex-shrink-0">
            <a
              href={PORTAL_DEMO_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Acessar a obra demo no Portal BWild em nova aba"
            >
              <ExternalLink className="h-4 w-4" />
              Acessar obra demo
            </a>
          </Button>
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-body">
            Credenciais demo (caso solicitadas)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleCopy(PORTAL_DEMO_EMAIL, "email")}
              className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-background border border-border hover:border-primary/40 transition-colors text-left"
              aria-label="Copiar e-mail demo"
            >
              <div className="min-w-0">
                <span className="block text-[10px] text-muted-foreground font-body">E-mail</span>
                <span className="block text-xs sm:text-sm font-mono text-foreground truncate">{PORTAL_DEMO_EMAIL}</span>
              </div>
              {copied === "email" ? (
                <Check className="h-4 w-4 text-primary flex-shrink-0" />
              ) : (
                <Copy className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              )}
            </button>
            <button
              type="button"
              onClick={() => handleCopy(PORTAL_DEMO_PASSWORD, "password")}
              className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-background border border-border hover:border-primary/40 transition-colors text-left"
              aria-label="Copiar senha demo"
            >
              <div className="min-w-0">
                <span className="block text-[10px] text-muted-foreground font-body">Senha</span>
                <span className="block text-xs sm:text-sm font-mono text-foreground truncate">{PORTAL_DEMO_PASSWORD}</span>
              </div>
              {copied === "password" ? (
                <Check className="h-4 w-4 text-primary flex-shrink-0" />
              ) : (
                <Copy className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              )}
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
