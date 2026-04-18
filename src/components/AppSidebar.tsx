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
  { title: "Clientes", url: "/admin/crm", icon: Users, roles: ["admin", "comercial"] },
  { title: "Leads (Integrações)", url: "/admin/leads", icon: Inbox, roles: ["admin", "comercial"] },
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
  { title: "Financeiro", url: "/admin/financeiro", icon: DollarSign, roles: ["admin"] },
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
          className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-body text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all duration-200"
          activeClassName="bg-sidebar-primary/15 text-sidebar-primary-foreground font-medium shadow-premium-sm"
        >
          <item.icon className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="flex-1 tracking-tight">{item.title}</span>}
          {!collapsed && item.actionUrl && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    to={item.actionUrl}
                    onClick={(e) => e.stopPropagation()}
                    className="opacity-0 group-hover/action:opacity-100 transition-all duration-200 h-6 w-6 flex items-center justify-center rounded-md hover:bg-sidebar-accent"
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
      <>
        <Separator className="mx-2 opacity-20" />
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-sidebar-foreground/40 font-body font-semibold px-2.5 mb-1">
              {label}
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => renderNavItem(item, collapsed))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </>
    );
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <img
          src={logoDark}
          alt="Bwild"
          className={collapsed ? "h-5 mx-auto object-contain" : "h-7 object-contain"}
        />
      </SidebarHeader>

      <Separator className="opacity-20" />

      <SidebarContent className="py-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
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

      <SidebarFooter className="p-3">
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
          <div className="px-2.5 py-2 mb-1 rounded-lg bg-sidebar-accent/50">
            <p className="text-xs font-semibold font-body text-sidebar-foreground truncate tracking-tight">
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
          className="w-full justify-start gap-2 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent text-xs rounded-lg"
          onClick={handleSignOut}
        >
          <LogOut className="h-3.5 w-3.5" />
          {!collapsed && "Sair"}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
