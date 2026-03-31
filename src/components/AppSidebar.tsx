import { useEffect } from "react";
import {
  LayoutDashboard,
  FileText,
  Plus,
  Hammer,
  Briefcase,
  Settings,
  DollarSign,
  Shield,
  LogOut,
  Users,
  PanelLeftOpen,
  Package,
  Wrench,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useAuth } from "@/hooks/useAuth";
import logoDark from "@/assets/logo-bwild-dark.png";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { AppRole } from "@/lib/role-constants";
import { useIsMobile } from "@/hooks/use-mobile";

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  roles: AppRole[] | "all";
  end?: boolean;
  actionUrl?: string;
  actionLabel?: string;
}

// Grouped navigation structure
interface NavGroup {
  label: string;
  items: NavItem[];
}

const DASHBOARD_ITEM: NavItem = {
  title: "Painel Geral", url: "/admin", icon: LayoutDashboard, roles: "all", end: true,
};

const PRINCIPAL_ITEMS: NavItem[] = [
  { title: "Pipeline Comercial", url: "/admin/comercial", icon: Briefcase, roles: ["admin", "comercial"] },
  { title: "Solicitações", url: "/admin/solicitacoes", icon: FileText, roles: ["admin", "comercial"], actionUrl: "/admin/solicitacoes/nova", actionLabel: "Nova solicitação" },
];

const ORCAMENTO_ITEMS: NavItem[] = [
  { title: "Minha Produção", url: "/admin/producao", icon: Hammer, roles: ["admin", "orcamentista"] },
  { title: "Catálogo Mestre", url: "/admin/catalogo", icon: Package, roles: ["admin", "orcamentista"] },
];

const GESTAO_ITEMS: NavItem[] = [
  { title: "Operações", url: "/admin/operacoes", icon: Settings, roles: ["admin"] },
  { title: "Financeiro", url: "/admin/financeiro", icon: DollarSign, roles: ["admin"] },
  { title: "Usuários", url: "/admin/usuarios", icon: Users, roles: ["admin"] },
];

const FERRAMENTAS_ITEMS: NavItem[] = [
  { title: "Avaliação QA", url: "/qa", icon: Shield, roles: ["admin"] },
  { title: "Sistema", url: "/admin/sistema", icon: Wrench, roles: ["admin"] },
];

function renderNavItem(item: NavItem, collapsed: boolean) {
  return (
    <SidebarMenuItem key={item.url} className="group/action">
      <SidebarMenuButton asChild>
        <NavLink
          to={item.url}
          end={item.end}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-body text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
          activeClassName="bg-sidebar-accent text-sidebar-primary-foreground font-medium"
        >
          <item.icon className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="flex-1">{item.title}</span>}
          {!collapsed && item.actionUrl && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    to={item.actionUrl}
                    onClick={(e) => e.stopPropagation()}
                    className="opacity-0 group-hover/action:opacity-100 transition-opacity h-6 w-6 flex items-center justify-center rounded-md hover:bg-muted"
                  >
                    <Plus className="h-4 w-4" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right"><p>{item.actionLabel}</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useUserProfile();
  const { signOut } = useAuth();
  const isMobile = useIsMobile();

  const userRoles = profile?.roles ?? [];

  const canSee = (item: NavItem) => {
    if (item.roles === "all") return true;
    return (item.roles as AppRole[]).some((r) => userRoles.includes(r));
  };

  // Auto-collapse on budget editor route for smaller screens
  const isBudgetEditor = /^\/admin\/budget\//.test(location.pathname);

  useEffect(() => {
    if (isBudgetEditor && !collapsed && window.innerWidth < 1280) {
      toggleSidebar();
    }
  }, [isBudgetEditor]);

  // Role-based ordering for Trabalho group
  const orderedTrabalho = [...TRABALHO_ITEMS].filter(canSee);
  if (userRoles.includes("orcamentista") && !userRoles.includes("admin")) {
    // Produção first for orcamentista
    orderedTrabalho.sort((a, b) =>
      a.url === "/admin/producao" ? -1 : b.url === "/admin/producao" ? 1 : 0
    );
  } else if (userRoles.includes("comercial") && !userRoles.includes("admin")) {
    // Pipeline first for comercial
    orderedTrabalho.sort((a, b) =>
      a.url === "/admin/comercial" ? -1 : b.url === "/admin/comercial" ? 1 : 0
    );
  }

  const gestaoItems = GESTAO_ITEMS.filter(canSee);
  const ferramentasItems = FERRAMENTAS_ITEMS.filter(canSee);

  async function handleSignOut() {
    await signOut();
    navigate("/login");
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-3">
        {!collapsed ? (
          <img src={logoDark} alt="Bwild" className="h-6" />
        ) : (
          <img src={logoDark} alt="Bwild" className="h-5 mx-auto" />
        )}
      </SidebarHeader>

      <Separator />

      <SidebarContent>
        {/* Dashboard — always visible */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {renderNavItem(DASHBOARD_ITEM, collapsed)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Trabalho group */}
        {orderedTrabalho.length > 0 && (
          <>
            <Separator className="mx-2" />
            <SidebarGroup>
              {!collapsed && (
                <SidebarGroupLabel className="text-xs uppercase tracking-wide text-sidebar-foreground/50 font-body">
                  Trabalho
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {orderedTrabalho.map((item) => renderNavItem(item, collapsed))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        {/* Gestão group */}
        {gestaoItems.length > 0 && (
          <>
            <Separator className="mx-2" />
            <SidebarGroup>
              {!collapsed && (
                <SidebarGroupLabel className="text-xs uppercase tracking-wide text-sidebar-foreground/50 font-body">
                  Gestão
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {gestaoItems.map((item) => renderNavItem(item, collapsed))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        {/* Ferramentas group */}
        {ferramentasItems.length > 0 && (
          <>
            <Separator className="mx-2" />
            <SidebarGroup>
              {!collapsed && (
                <SidebarGroupLabel className="text-xs uppercase tracking-wide text-sidebar-foreground/50 font-body">
                  Ferramentas
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {ferramentasItems.map((item) => renderNavItem(item, collapsed))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="p-2">
        {/* Reopen button when collapsed on budget editor */}
        {collapsed && isBudgetEditor && (
          <Button
            variant="ghost"
            size="icon"
            className="w-full h-8 mb-1"
            onClick={toggleSidebar}
          >
            <PanelLeftOpen className="h-4 w-4" />
          </Button>
        )}
        {!collapsed && profile && (
          <div className="px-2 py-1.5 mb-1">
            <p className="text-xs font-medium font-body text-sidebar-foreground truncate">
              {profile.full_name || "Usuário"}
            </p>
            <p className="text-[11px] text-sidebar-foreground/50 font-body truncate">
              {userRoles.join(", ") || "sem perfil"}
            </p>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent text-xs"
          onClick={handleSignOut}
        >
          <LogOut className="h-3.5 w-3.5" />
          {!collapsed && "Sair"}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
