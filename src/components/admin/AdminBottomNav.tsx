import { useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Hammer, Briefcase, BarChart3, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserProfile } from "@/hooks/useUserProfile";
import type { AppRole } from "@/lib/role-constants";

interface TabItem {
  label: string;
  icon: React.ElementType;
  path: string;
  matchPaths: string[];
  roles: AppRole[] | "all";
  isAction?: boolean;
}

const TABS: TabItem[] = [
  {
    label: "Painel",
    icon: LayoutDashboard,
    path: "/admin",
    matchPaths: ["/admin"],
    roles: "all",
  },
  {
    label: "Produção",
    icon: Hammer,
    path: "/admin/producao",
    matchPaths: ["/admin/producao"],
    roles: ["admin", "orcamentista"],
  },
  {
    // Atalho de criação aponta para a lista de clientes — toda solicitação
    // deve nascer dentro do card de um cliente para evitar duplicidade.
    label: "",
    icon: Plus,
    path: "/admin/crm",
    matchPaths: ["/admin/crm"],
    roles: ["admin", "comercial"],
    isAction: true,
  },
  {
    label: "Comercial",
    icon: Briefcase,
    path: "/admin/comercial",
    matchPaths: ["/admin/comercial"],
    roles: ["admin", "comercial"],
  },
  {
    label: "Operações",
    icon: BarChart3,
    path: "/admin/operacoes",
    matchPaths: ["/admin/operacoes", "/admin/financeiro"],
    roles: ["admin"],
  },
];

// Routes where the bottom nav should be hidden (e.g. editor, detail pages)
const HIDDEN_PATTERNS = [
  /^\/admin\/budget\//,
  /^\/admin\/solicitacoes\/\w+$/,
];

export function AdminBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useUserProfile();
  const userRoles = profile?.roles ?? [];

  const shouldHide = HIDDEN_PATTERNS.some((p) => p.test(location.pathname));
  if (shouldHide) return null;

  const canSee = (tab: TabItem) => {
    if (tab.roles === "all") return true;
    return (tab.roles as AppRole[]).some((r) => userRoles.includes(r));
  };

  const visibleTabs = TABS.filter(canSee);

  const isActive = (tab: TabItem) =>
    tab.matchPaths.some((p) =>
      p === "/admin"
        ? location.pathname === "/admin"
        : location.pathname.startsWith(p)
    );

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border shadow-[0_-2px_10px_-2px_hsl(var(--foreground)/0.05)]"
      role="tablist"
      aria-label="Navegação principal"
    >
      <div
        className="flex items-end justify-around px-1"
        style={{ paddingBottom: "max(0.375rem, env(safe-area-inset-bottom, 0px))" }}
      >
        {visibleTabs.map((tab) => {
          const active = isActive(tab);
          const Icon = tab.icon;

          if (tab.isAction) {
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className="flex flex-col items-center justify-center -mt-3 group"
                aria-label="Novo orçamento"
              >
                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/25 active:scale-95 transition-transform">
                  <Icon className="h-5 w-5" />
                </div>
              </button>
            );
          }

          return (
            <button
              key={tab.path}
              role="tab"
              aria-selected={active}
              onClick={() => navigate(tab.path)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 py-2 px-3 min-w-[56px] transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground active:text-foreground"
              )}
            >
              <div className="relative">
                <Icon className="h-5 w-5" />
                {active && (
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                )}
              </div>
              <span className="text-[10px] font-body font-medium leading-tight">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
