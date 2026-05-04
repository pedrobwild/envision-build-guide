import { useLocation, Link, useParams } from "react-router-dom";
import { useUserProfile } from "@/hooks/useUserProfile";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useIsMobile } from "@/hooks/use-mobile";

type Crumb = { label: string; href?: string };

const ROUTE_LABELS: Record<string, string> = {
  "/admin": "Início",
  "/admin/solicitacoes": "Solicitações",
  "/admin/solicitacoes/nova": "Nova Solicitação",
  "/admin/comparar": "Comparar Versões",
  "/admin/usuarios": "Usuários",
  "/admin/producao": "Pipeline Orçamentos",
  "/admin/comercial": "Pipeline Comercial",
  "/admin/operacoes": "Operações",
  "/admin/financeiro": "Financeiro",
  "/qa": "Avaliação QA",
  "/admin/sistema": "Sistema",
  "/admin/lixeira": "Lixeira",
};

export function AdminBreadcrumb() {
  const location = useLocation();
  const isMobile = useIsMobile();
  const { profile } = useUserProfile();
  const pathname = location.pathname;

  const roles = profile?.roles ?? [];

  const crumbs: Crumb[] = [];

  // Budget editor route: /admin/budget/:id
  const budgetMatch = pathname.match(/^\/admin\/budget\/([^/]+)/);
  // Budget internal detail (commercial pipeline): /admin/demanda/:id
  const demandaMatch = pathname.match(/^\/admin\/demanda\/([^/]+)/);

  if (budgetMatch) {
    crumbs.push({ label: "Início", href: "/admin" });

    // Role-based origin
    if (roles.includes("orcamentista") && !roles.includes("admin")) {
      crumbs.push({ label: "Pipeline Orçamentos", href: "/admin/producao" });
    } else if (roles.includes("comercial") && !roles.includes("admin")) {
      crumbs.push({ label: "Pipeline Comercial", href: "/admin/comercial" });
    }

    crumbs.push({ label: "Orçamento" });
  } else if (demandaMatch) {
    // Detalhe interno do negócio (origem comercial)
    crumbs.push({ label: "Início", href: "/admin" });
    crumbs.push({ label: "Pipeline Comercial", href: "/admin/comercial" });
    crumbs.push({ label: "Detalhe do negócio" });
  } else if (ROUTE_LABELS[pathname]) {
    // Build crumbs from path segments
    if (pathname === "/admin") {
      crumbs.push({ label: "Início" });
    } else if (pathname === "/qa") {
      crumbs.push({ label: "Início", href: "/admin" });
      crumbs.push({ label: "Avaliação QA" });
    } else {
      crumbs.push({ label: "Início", href: "/admin" });

      // Check for intermediate segments
      if (pathname.startsWith("/admin/solicitacoes/")) {
        crumbs.push({ label: "Solicitações", href: "/admin/solicitacoes" });
      }

      crumbs.push({ label: ROUTE_LABELS[pathname] });
    }
  } else {
    // Unknown route — just show Início
    crumbs.push({ label: "Início", href: "/admin" });
    crumbs.push({ label: "Página" });
  }

  // On mobile, show only last 2 crumbs
  const displayCrumbs = isMobile && crumbs.length > 2
    ? crumbs.slice(-2)
    : crumbs;

  // Don't render if only one crumb (we're on Início)
  if (crumbs.length <= 1) return null;

  return (
    <Breadcrumb className="hidden lg:block px-4 sm:px-6 py-2">
      <BreadcrumbList>
        {displayCrumbs.map((crumb, i) => {
          const isLast = i === displayCrumbs.length - 1;
          return (
            <BreadcrumbItem key={i}>
              {i > 0 && <BreadcrumbSeparator />}
              {isLast ? (
                <BreadcrumbPage className="text-sm">{crumb.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link to={crumb.href!} className="text-sm text-muted-foreground hover:text-foreground">
                    {crumb.label}
                  </Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
