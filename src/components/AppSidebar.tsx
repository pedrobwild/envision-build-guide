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
  ImagePlus,
  LayoutTemplate,
  Inbox,
  Route as RouteIcon,
  BarChart3,
  CalendarClock,
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

const DASHBOARD_ITEM: NavItem = {
  title: "Painel Geral", url: "/admin", icon: LayoutDashboard, roles: "all", end: true,
};

const COMERCIAL_ITEMS: NavItem[] = [
  { title: "Pipeline Comercial", url: "/admin/comercial", icon: Briefcase, roles: ["admin", "comercial"] },
  { title: "Agenda", url: "/admin/agenda", icon: CalendarClock, roles: ["admin", "comercial"] },
  { title: "Clientes", url: "/admin/crm", icon: Users, roles: ["admin", "comercial"] },
  { title: "Solicitações", url: "/admin/solicitacoes", icon: FileText, roles: ["admin", "comercial"], actionUrl: "/admin/solicitacoes/nova", actionLabel: "Nova solicitação" },
];

const PROJETOS_ITEMS: NavItem[] = [
  { title: "Pipeline Orçamentos", url: "/admin/producao", icon: Hammer, roles: ["admin", "orcamentista"] },
];

const DADOS_MESTRES_ITEMS: NavItem[] = [
  { title: "Templates", url: "/admin/templates", icon: LayoutTemplate, roles: ["admin", "orcamentista"] },
  { title: "Catálogo", url: "/admin/catalogo", icon: Package, roles: ["admin", "orcamentista"] },
  { title: "Biblioteca de Fotos", url: "/admin/biblioteca-fotos", icon: ImagePlus, roles: ["admin", "orcamentista"] },
  { title: "Usuários", url: "/admin/usuarios", icon: Users, roles: ["admin", "orcamentista"] },
];

const ANALISE_ITEMS: NavItem[] = [
  { title: "Operações", url: "/admin/operacoes", icon: Settings, roles: ["admin"] },
  { title: "Análises e Relatórios", url: "/admin/analises", icon: BarChart3, roles: ["admin"] },
  { title: "Financeiro", url: "/admin/financeiro", icon: DollarSign, roles: ["admin"] },
];

const FERRAMENTAS_ITEMS: NavItem[] = [
  { title: "Leads (Integrações)", url: "/admin/leads", icon: Inbox, roles: ["admin", "comercial"] },
  { title: "Regras de Roteamento", url: "/admin/leads/regras", icon: RouteIcon, roles: ["admin"] },
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
          className="group/nav relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-body text-sidebar-foreground/65 hover:text-sidebar-foreground hover:bg-sidebar-accent/70 transition-all duration-200 before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-0 before:w-[2px] before:rounded-r-full before:bg-sidebar-primary before:transition-all before:duration-200 hover:before:h-4"
          activeClassName="!text-sidebar-foreground font-medium bg-gradient-to-r from-sidebar-primary/15 via-sidebar-primary/8 to-transparent shadow-premium-sm before:!h-5 [&_svg]:!text-sidebar-primary"
        >
          <item.icon className="h-4 w-4 shrink-0 text-sidebar-foreground/50 group-hover/nav:text-sidebar-foreground/80 transition-colors" />
          {!collapsed && <span className="flex-1 tracking-tight truncate">{item.title}</span>}
          {!collapsed && item.actionUrl && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    to={item.actionUrl}
                    onClick={(e) => e.stopPropagation()}
                    className="opacity-0 group-hover/action:opacity-100 transition-all duration-200 h-6 w-6 flex items-center justify-center rounded-md bg-sidebar-primary/10 text-sidebar-primary hover:bg-sidebar-primary/20 ring-1 ring-sidebar-primary/20"
                  >
                    <Plus className="h-3.5 w-3.5" />
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

  const isBudgetEditor = /^\/admin\/budget\//.test(location.pathname);

  useEffect(() => {
    if (isBudgetEditor && !collapsed && window.innerWidth < 1280) {
      toggleSidebar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBudgetEditor]);

  const comercialItems = COMERCIAL_ITEMS.filter(canSee);
  const projetosItems = PROJETOS_ITEMS.filter(canSee);
  const dadosMestresItems = DADOS_MESTRES_ITEMS.filter(canSee);
  const analiseItems = ANALISE_ITEMS.filter(canSee);
  const ferramentasItems = FERRAMENTAS_ITEMS.filter(canSee);

  async function handleSignOut() {
    await signOut();
    navigate("/login");
  }

  const renderGroup = (label: string, items: NavItem[]) => {
    if (items.length === 0) return null;
    return (
      <SidebarGroup className="px-1">
        {!collapsed ? (
          <SidebarGroupLabel className="text-[9.5px] uppercase tracking-[0.14em] text-sidebar-foreground/35 font-body font-semibold px-2.5 mb-0.5 mt-2">
            {label}
          </SidebarGroupLabel>
        ) : (
          <div className="mx-3 my-2 h-px bg-gradient-to-r from-transparent via-sidebar-border to-transparent" />
        )}
        <SidebarGroupContent>
          <SidebarMenu className="gap-0.5">
            {items.map((item) => renderNavItem(item, collapsed))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  const initials = (profile?.full_name || "U")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border/60">
      <SidebarHeader className={collapsed ? "p-3" : "p-4"}>
        <div className="flex items-center justify-center">
          <img
            src={logoDark}
            alt="Bwild"
            className={collapsed ? "h-5 object-contain" : "h-7 object-contain"}
          />
        </div>
      </SidebarHeader>

      <div className="mx-3 h-px bg-gradient-to-r from-transparent via-sidebar-border to-transparent" />

      <SidebarContent className="py-2 px-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-sidebar-border [&::-webkit-scrollbar-thumb]:rounded-full">
        <SidebarGroup className="px-1">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {renderNavItem(DASHBOARD_ITEM, collapsed)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {renderGroup("Comercial", comercialItems)}
        {renderGroup("Gestão de Projetos", projetosItems)}
        {renderGroup("Dados Mestres", dadosMestresItems)}
        {renderGroup("Análise & Relatórios", analiseItems)}
        {renderGroup("Ferramentas", ferramentasItems)}
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border/60">
        {collapsed && isBudgetEditor && (
          <Button
            variant="ghost"
            size="icon"
            className="w-full h-8 mb-1 text-sidebar-foreground/60 hover:text-sidebar-foreground"
            onClick={toggleSidebar}
          >
            <PanelLeftOpen className="h-4 w-4" />
          </Button>
        )}
        {!collapsed && profile ? (
          <div className="flex items-center gap-2.5 px-2 py-2 mb-1 rounded-lg bg-gradient-to-br from-sidebar-accent/60 to-sidebar-accent/20 ring-1 ring-sidebar-border/50">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-sidebar-primary/30 to-sidebar-primary/10 ring-1 ring-sidebar-primary/30 flex items-center justify-center text-[11px] font-display font-bold text-sidebar-primary-foreground shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold font-body text-sidebar-foreground truncate tracking-tight leading-tight">
                {profile.full_name || "Usuário"}
              </p>
              <p className="text-[10px] text-sidebar-foreground/45 font-body truncate uppercase tracking-wider mt-0.5">
                {userRoles.join(", ") || "sem perfil"}
              </p>
            </div>
          </div>
        ) : collapsed && profile ? (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="h-8 w-8 mx-auto mb-1 rounded-full bg-gradient-to-br from-sidebar-primary/30 to-sidebar-primary/10 ring-1 ring-sidebar-primary/30 flex items-center justify-center text-[11px] font-display font-bold text-sidebar-primary-foreground">
                  {initials}
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p className="font-medium">{profile.full_name || "Usuário"}</p>
                <p className="text-[10px] opacity-70">{userRoles.join(", ")}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/70 text-xs rounded-lg transition-colors"
          onClick={handleSignOut}
        >
          <LogOut className="h-3.5 w-3.5" />
          {!collapsed && "Sair"}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
