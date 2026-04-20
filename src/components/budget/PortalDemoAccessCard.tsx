import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Sparkles } from "lucide-react";

const PORTAL_DEMO_URL = "https://portal-bwild.lovable.app/obra/6e451628-4818-4d36-8011-2db95c2b6b1b";

/**
 * Card destacado para o cliente acessar a obra demo do Portal BWild.
 * Acesso direto, sem necessidade de login (perfil customer somente leitura).
 */
export function PortalDemoAccessCard() {
  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-background to-background overflow-hidden">
      <CardContent className="p-4 sm:p-5 md:p-6">
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
      </CardContent>
    </Card>
  );
}
