import { useLocation, useNavigate, Link } from "react-router-dom";
import { ChevronLeft, Search } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { CommandPaletteTrigger } from "@/components/CommandPalette";

/**
 * Header contextual mobile.
 *
 * Substitui o breadcrumb truncado em rotas internas do /admin com:
 *   • botão voltar quando há para onde voltar (sub-rota)
 *   • título da página atual
 *   • atalho para a paleta de comandos (busca global)
 *
 * Em /admin (raiz), mantém apenas o trigger da sidebar + busca, igual ao layout original.
 */
const ROUTE_TITLES: Array<{ test: RegExp; title: string }> = [
  { test: /^\/admin\/budget\//, title: "Orçamento" },
  { test: /^\/admin\/demanda\//, title: "Negócio" },
  { test: /^\/admin\/clientes\//, title: "Cliente" },
  { test: /^\/admin\/clientes$/, title: "Clientes" },
  { test: /^\/admin\/comercial\/conversao/, title: "Conversão" },
  { test: /^\/admin\/comercial/, title: "Comercial" },
  { test: /^\/admin\/producao/, title: "Produção" },
  { test: /^\/admin\/operacoes/, title: "Operações" },
  { test: /^\/admin\/financeiro/, title: "Financeiro" },
  { test: /^\/admin\/agenda/, title: "Agenda" },
  { test: /^\/admin\/catalogo/, title: "Catálogo" },
  { test: /^\/admin\/templates/, title: "Templates" },
  { test: /^\/admin\/usuarios/, title: "Usuários" },
  { test: /^\/admin\/lixeira/, title: "Lixeira" },
  { test: /^\/admin\/sistema/, title: "Sistema" },
  { test: /^\/admin\/solicitacoes\/nova/, title: "Nova solicitação" },
  { test: /^\/admin\/solicitacoes/, title: "Solicitações" },
  { test: /^\/admin\/imoveis-duplicados/, title: "Imóveis duplicados" },
  { test: /^\/admin\/crm/, title: "Clientes" },
];

function pageTitleFor(path: string): string | null {
  for (const r of ROUTE_TITLES) if (r.test.test(path)) return r.title;
  return null;
}

export function MobilePageHeader() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isRoot = pathname === "/admin" || pathname === "/admin/";
  const title = isRoot ? null : pageTitleFor(pathname);
  const canGoBack = !isRoot;

  return (
    <header className="sticky top-0 z-30 h-12 flex items-center justify-between gap-2 border-b border-hairline bg-surface-1/90 backdrop-blur-md shrink-0 px-2 lg:hidden">
      <div className="flex items-center gap-1 min-w-0">
        {canGoBack ? (
          <button
            type="button"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/admin"))}
            aria-label="Voltar"
            className="tap-target flex items-center justify-center rounded-md text-foreground press-feedback active:bg-muted/60"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        ) : (
          <SidebarTrigger className="tap-target" />
        )}
        {title && (
          <Link
            to="/admin"
            className="ml-0.5 text-sm font-display font-semibold text-foreground truncate max-w-[55vw]"
            aria-label={`Você está em ${title}. Tocar leva para o Início`}
          >
            {title}
          </Link>
        )}
      </div>
      <div className="flex items-center gap-1">
        <CommandPaletteTrigger />
      </div>
    </header>
  );
}
