import { useEffect, useState } from "react";
import {
  LayoutDashboard,
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
  Brain,
  TrendingUp,
  MessageCircle,
  Stethoscope,
  Bug,
  GitBranch,
  Trash2,
  Copy,
  ChevronDown,
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
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/lib/role-constants";

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  roles: AppRole[] | "all";
  end?: boolean;
  actionUrl?: string;
  actionLabel?: string;
}

interface NavSubGroup {
  label: string;
  items: NavItem[];
}

const DASHBOARD_ITEM: NavItem = {
  title: "Painel Geral", url: "/admin", icon: LayoutDashboard, roles: "all", end: true,
};

const COMERCIAL_ITEMS: NavItem[] = [
  { title: "Pipeline Comercial", url: "/admin/comercial", icon: Briefcase, roles: ["admin", "comercial", "orcamentista"] },
  { title: "KPIs de Vendas", url: "/admin/comercial/kpis", icon: BarChart3, roles: ["admin", "comercial", "orcamentista"] },
  { title: "Conversão", url: "/admin/comercial/conversao", icon: GitBranch, roles: ["admin", "comercial", "orcamentista"] },
  { title: "Agenda", url: "/admin/agenda", icon: CalendarClock, roles: ["admin", "comercial", "orcamentista"] },
  { title: "Insights por Consultor", url: "/admin/insights", icon: Brain, roles: ["admin", "comercial", "orcamentista"] },
  { title: "Clientes", url: "/admin/crm", icon: Users, roles: ["admin", "comercial", "orcamentista"] },
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
  { title: "Forecast & Previsibilidade", url: "/admin/forecast", icon: TrendingUp, roles: ["admin"] },
  { title: "Financeiro", url: "/admin/financeiro", icon: DollarSign, roles: ["admin"] },
];

// Ferramentas — sub-agrupado para reduzir carga visual
const FERRAMENTAS_SUBGROUPS: NavSubGroup[] = [
  {
    label: "Integrações",
    items: [
      { title: "Leads", url: "/admin/leads", icon: Inbox, roles: ["admin", "comercial", "orcamentista"] },
      { title: "Regras de Roteamento", url: "/admin/leads/regras", icon: RouteIcon, roles: ["admin"] },
      { title: "Digisac", url: "/admin/digisac", icon: MessageCircle, roles: ["admin"] },
    ],
  },
  {
    label: "Diagnóstico",
    items: [
      { title: "Diagnóstico de Orçamento", url: "/admin/diagnostico", icon: Stethoscope, roles: ["admin", "comercial", "orcamentista"] },
      { title: "Avaliação QA", url: "/qa", icon: Shield, roles: ["admin"] },
      { title: "Bug Reports", url: "/admin/bug-reports", icon: Bug, roles: ["admin", "comercial", "orcamentista"] },
    ],
  },
  {
    label: "Sistema",
    items: [
      { title: "Sistema", url: "/admin/sistema", icon: Wrench, roles: ["admin"] },
      { title: "Saneamento de Dados", url: "/admin/imoveis-duplicados", icon: Copy, roles: ["admin"] },
      { title: "Lixeira", url: "/admin/lixeira", icon: Trash2, roles: ["admin"] },
    ],
  },
];

const ROLE_TONE: Record<string, string> = {
  admin: "bg-sidebar-primary/15 text-sidebar-primary ring-sidebar-primary/30",
  comercial: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30",
  orcamentista: "bg-amber-500/15 text-amber-400 ring-amber-500/30",
};

function NavItemRow({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const inner = (
    <SidebarMenuItem className="group/action">
      <SidebarMenuButton asChild>
        <NavLink
          to={item.url}
          end={item.end}
          className={cn(
            "group/nav relative flex items-center gap-2.5 rounded-md px-2 py-[7px] text-[12.5px] font-body text-sidebar-foreground/65",
            "hover:text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors duration-150",
            "before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-0 before:w-[2px] before:rounded-r-full before:bg-sidebar-primary before:transition-all before:duration-200 hover:before:h-3.5",
            collapsed && "justify-center px-0"
          )}
          activeClassName="!text-sidebar-foreground font-medium bg-sidebar-primary/10 before:!h-5 [&_svg]:!text-sidebar-primary"
        >
          <item.icon className="h-[15px] w-[15px] shrink-0 text-sidebar-foreground/55 group-hover/nav:text-sidebar-foreground/85 transition-colors" />
          {!collapsed && <span className="flex-1 tracking-tight truncate">{item.title}</span>}
          {!collapsed && item.actionUrl && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    to={item.actionUrl}
                    onClick={(e) => e.stopPropagation()}
                    className="opacity-0 group-hover/action:opacity-100 transition-opacity h-5 w-5 flex items-center justify-center rounded bg-sidebar-primary/10 text-sidebar-primary hover:bg-sidebar-primary/20 ring-1 ring-sidebar-primary/20"
                  >
                    <Plus className="h-3 w-3" />
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

  if (!collapsed) return inner;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{inner}</TooltipTrigger>
        <TooltipContent side="right" className="text-xs font-body">{item.title}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useUserProfile();
  const { signOut } = useAuth();

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

  const ferramentasSubgroups = FERRAMENTAS_SUBGROUPS
    .map((g) => ({ ...g, items: g.items.filter(canSee) }))
    .filter((g) => g.items.length > 0);

  const ferramentasHasActive = ferramentasSubgroups.some((g) =>
    g.items.some((it) => location.pathname.startsWith(it.url))
  );
  const [toolsOpen, setToolsOpen] = useState<boolean>(ferramentasHasActive);

  useEffect(() => {
    if (ferramentasHasActive) setToolsOpen(true);
  }, [ferramentasHasActive]);

  async function handleSignOut() {
    await signOut();
    navigate("/login");
  }

  const renderGroup = (label: string, items: NavItem[]) => {
    if (items.length === 0) return null;
    return (
      <SidebarGroup className="px-1">
        {!collapsed ? (
          <SidebarGroupLabel className="text-[9.5px] uppercase tracking-[0.16em] text-sidebar-foreground/35 font-body font-semibold px-2 mb-1 mt-3 flex items-center justify-between">
            <span>{label}</span>
            <span className="text-sidebar-foreground/25 font-mono normal-case tracking-normal text-[9px]">
              {items.length}
            </span>
          </SidebarGroupLabel>
        ) : (
          <div className="mx-2.5 my-2 h-px bg-sidebar-border/60" />
        )}
        <SidebarGroupContent>
          <SidebarMenu className="gap-px">
            {items.map((item) => (
              <NavItemRow key={item.url} item={item} collapsed={collapsed} />
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  const renderToolsGroup = () => {
    if (ferramentasSubgroups.length === 0) return null;

    if (collapsed) {
      // Modo colapsado: lista flat de todos os tools com tooltip
      const flat = ferramentasSubgroups.flatMap((g) => g.items);
      return (
        <SidebarGroup className="px-1">
          <div className="mx-2.5 my-2 h-px bg-sidebar-border/60" />
          <SidebarGroupContent>
            <SidebarMenu className="gap-px">
              {flat.map((item) => (
                <NavItemRow key={item.url} item={item} collapsed />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      );
    }

    return (
      <SidebarGroup className="px-1">
        <Collapsible open={toolsOpen} onOpenChange={setToolsOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="w-full group flex items-center justify-between px-2 mt-3 mb-1 text-[9.5px] uppercase tracking-[0.16em] text-sidebar-foreground/35 font-body font-semibold hover:text-sidebar-foreground/60 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Wrench className="h-3 w-3" />
                Ferramentas
              </span>
              <ChevronDown
                className={cn(
                  "h-3 w-3 text-sidebar-foreground/30 transition-transform duration-200",
                  toolsOpen && "rotate-180"
                )}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up overflow-hidden">
            <div className="space-y-2 mt-1">
              {ferramentasSubgroups.map((subgroup) => (
                <div key={subgroup.label}>
                  <p className="text-[9px] uppercase tracking-[0.14em] text-sidebar-foreground/25 font-body font-medium px-2 mb-0.5">
                    {subgroup.label}
                  </p>
                  <SidebarGroupContent>
                    <SidebarMenu className="gap-px">
                      {subgroup.items.map((item) => (
                        <NavItemRow key={item.url} item={item} collapsed={false} />
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </SidebarGroup>
    );
  };

  const initials = (profile?.full_name || "U")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");

  const primaryRole = userRoles[0];

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border/60">
      <SidebarHeader className={cn("pt-4 pb-3", collapsed ? "px-2" : "px-4")}>
        <div className="flex items-center justify-center">
          <img
            src={logoDark}
            alt="Bwild"
            className={collapsed ? "h-5 object-contain" : "h-7 object-contain"}
          />
        </div>
      </SidebarHeader>

      <div className="mx-3 h-px bg-sidebar-border/60" />

      <SidebarContent className="py-1.5 px-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-sidebar-border [&::-webkit-scrollbar-thumb]:rounded-full">
        <SidebarGroup className="px-1 pt-1">
          <SidebarGroupContent>
            <SidebarMenu className="gap-px">
              <NavItemRow item={DASHBOARD_ITEM} collapsed={collapsed} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {renderGroup("Comercial", comercialItems)}
        {renderGroup("Gestão de Projetos", projetosItems)}
        {renderGroup("Dados Mestres", dadosMestresItems)}
        {renderGroup("Análise & Relatórios", analiseItems)}
        {renderToolsGroup()}
      </SidebarContent>

      <SidebarFooter className="p-2.5 border-t border-sidebar-border/60">
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
          <div className="flex items-center gap-2.5 px-2 py-2 mb-1.5 rounded-lg bg-sidebar-accent/40 ring-1 ring-sidebar-border/40 hover:bg-sidebar-accent/60 transition-colors">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-sidebar-primary/35 to-sidebar-primary/10 ring-1 ring-sidebar-primary/30 flex items-center justify-center text-[11px] font-display font-bold text-sidebar-primary-foreground shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold font-body text-sidebar-foreground truncate tracking-tight leading-tight">
                {profile.full_name || "Usuário"}
              </p>
              {primaryRole && (
                <span
                  className={cn(
                    "inline-flex items-center mt-0.5 text-[8.5px] font-body font-semibold uppercase tracking-wider px-1.5 py-px rounded ring-1 leading-none",
                    ROLE_TONE[primaryRole] ?? "bg-sidebar-accent text-sidebar-foreground/60 ring-sidebar-border"
                  )}
                >
                  {primaryRole}
                </span>
              )}
            </div>
          </div>
        ) : collapsed && profile ? (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="h-8 w-8 mx-auto mb-1.5 rounded-full bg-gradient-to-br from-sidebar-primary/35 to-sidebar-primary/10 ring-1 ring-sidebar-primary/30 flex items-center justify-center text-[11px] font-display font-bold text-sidebar-primary-foreground cursor-default">
                  {initials}
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p className="font-medium text-xs">{profile.full_name || "Usuário"}</p>
                <p className="text-[10px] opacity-70 uppercase tracking-wider">{userRoles.join(", ")}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}

        {collapsed ? (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-full h-8 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/70"
                  onClick={handleSignOut}
                >
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">Sair</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/70 text-[12px] font-body rounded-md transition-colors h-8"
            onClick={handleSignOut}
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
