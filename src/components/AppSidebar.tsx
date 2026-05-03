import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
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
  HeartPulse,
  Bug,
  GitBranch,
  Trash2,
  Copy,
  ChevronDown,
  Search,
  ChevronsUpDown,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useAuth } from "@/hooks/useAuth";
import logoDark from "@/assets/logo-bwild-dark.png";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/lib/role-constants";

/* ────────────────────────────────────────────────────────────────────────── */
/* Tipos                                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  roles: AppRole[] | "all";
  end?: boolean;
}

interface NavSection {
  /** id estável para chave React */
  id: string;
  /** label opcional. Se ausente, vira só whitespace (estilo Linear) */
  label?: string;
  items: NavItem[];
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Estrutura — agrupamentos pensados para hierarquia plana, não rotulada      */
/* (estilo Linear / Vercel / Attio: less labels, more whitespace)             */
/* ────────────────────────────────────────────────────────────────────────── */

const PRIMARY_SECTION: NavSection = {
  id: "primary",
  items: [
    { title: "Painel", url: "/admin", icon: LayoutDashboard, roles: "all", end: true },
  ],
};

const COMERCIAL_SECTION: NavSection = {
  id: "comercial",
  label: "Comercial",
  items: [
    { title: "Pipeline", url: "/admin/comercial", icon: Briefcase, roles: ["admin", "comercial", "orcamentista"] },
    { title: "Conversão", url: "/admin/comercial/conversao", icon: GitBranch, roles: ["admin", "comercial", "orcamentista"] },
    { title: "KPIs", url: "/admin/comercial/kpis", icon: BarChart3, roles: ["admin", "comercial", "orcamentista"] },
    { title: "Agenda", url: "/admin/agenda", icon: CalendarClock, roles: ["admin", "comercial", "orcamentista"] },
    { title: "Insights", url: "/admin/insights", icon: Brain, roles: ["admin", "comercial", "orcamentista"] },
    { title: "Clientes", url: "/admin/crm", icon: Users, roles: ["admin", "comercial", "orcamentista"] },
  ],
};

const PRODUCAO_SECTION: NavSection = {
  id: "producao",
  label: "Produção",
  items: [
    { title: "Pipeline Orçamentos", url: "/admin/producao", icon: Hammer, roles: ["admin", "orcamentista"] },
    { title: "Templates", url: "/admin/templates", icon: LayoutTemplate, roles: ["admin", "orcamentista"] },
    { title: "Catálogo", url: "/admin/catalogo", icon: Package, roles: ["admin", "orcamentista"] },
    { title: "Biblioteca de fotos", url: "/admin/biblioteca-fotos", icon: ImagePlus, roles: ["admin", "orcamentista"] },
  ],
};

const ADMIN_SECTION: NavSection = {
  id: "admin",
  label: "Administração",
  items: [
    { title: "Operações", url: "/admin/operacoes", icon: Settings, roles: ["admin"] },
    { title: "Saúde da operação", url: "/admin/saude-operacao", icon: HeartPulse, roles: ["admin"] },
    { title: "Análises", url: "/admin/analises", icon: BarChart3, roles: ["admin"] },
    { title: "Forecast", url: "/admin/forecast", icon: TrendingUp, roles: ["admin"] },
    { title: "Financeiro", url: "/admin/financeiro", icon: DollarSign, roles: ["admin"] },
    { title: "Usuários", url: "/admin/usuarios", icon: Users, roles: ["admin", "orcamentista"] },
  ],
};

interface ToolGroup {
  id: string;
  label: string;
  items: NavItem[];
}

const TOOL_GROUPS: ToolGroup[] = [
  {
    id: "integracoes",
    label: "Integrações",
    items: [
      { title: "Leads", url: "/admin/leads", icon: Inbox, roles: ["admin", "comercial", "orcamentista"] },
      { title: "Roteamento", url: "/admin/leads/regras", icon: RouteIcon, roles: ["admin"] },
      { title: "Digisac", url: "/admin/digisac", icon: MessageCircle, roles: ["admin"] },
    ],
  },
  {
    id: "diagnostico",
    label: "Diagnóstico",
    items: [
      { title: "Diagnóstico", url: "/admin/diagnostico", icon: Stethoscope, roles: ["admin", "comercial", "orcamentista"] },
      { title: "QA", url: "/qa", icon: Shield, roles: ["admin"] },
      { title: "Bug reports", url: "/admin/bug-reports", icon: Bug, roles: ["admin", "comercial", "orcamentista"] },
    ],
  },
  {
    id: "sistema",
    label: "Sistema",
    items: [
      { title: "Sistema", url: "/admin/sistema", icon: Wrench, roles: ["admin"] },
      { title: "Saneamento", url: "/admin/imoveis-duplicados", icon: Copy, roles: ["admin"] },
      { title: "Lixeira", url: "/admin/lixeira", icon: Trash2, roles: ["admin"] },
    ],
  },
];

/* ────────────────────────────────────────────────────────────────────────── */
/* Item de navegação — densidade Linear/Vercel                                */
/* ────────────────────────────────────────────────────────────────────────── */

function NavRow({
  item,
  collapsed,
  isActive,
}: {
  item: NavItem;
  collapsed: boolean;
  isActive: boolean;
}) {
  const Icon = item.icon;

  const link = (
    <NavLink
      to={item.url}
      end={item.end}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-md font-body transition-colors duration-100 outline-none",
        "focus-visible:ring-1 focus-visible:ring-sidebar-ring",
        collapsed
          ? "h-9 w-9 mx-auto justify-center"
          : "h-7 px-2 text-[13px]",
        isActive
          ? "bg-sidebar-accent text-white"
          : "text-white/85 hover:text-white hover:bg-sidebar-accent/60",
      )}
      activeClassName=""
    >
      {/* indicador ativo lateral super-discreto (Linear-style) */}
      {!collapsed && (
        <span
          aria-hidden
          className={cn(
            "absolute left-0 top-1/2 -translate-y-1/2 h-3.5 w-[2px] rounded-r-full bg-sidebar-primary transition-opacity",
            isActive ? "opacity-100" : "opacity-0",
          )}
        />
      )}
      <Icon
        className={cn(
          "shrink-0 transition-colors",
          collapsed ? "h-[17px] w-[17px]" : "h-[15px] w-[15px]",
          isActive ? "text-white" : "text-white/85 group-hover:text-white",
        )}
        strokeWidth={isActive ? 2 : 1.85}
      />
      {!collapsed && (
        <span className="truncate leading-none">{item.title}</span>
      )}
    </NavLink>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8} className="text-xs font-body py-1 px-2">
        {item.title}
      </TooltipContent>
    </Tooltip>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Sidebar                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  comercial: "Comercial",
  orcamentista: "Orçamentista",
};

const ROLE_DOT: Record<string, string> = {
  admin: "bg-sidebar-primary",
  comercial: "bg-emerald-400",
  orcamentista: "bg-amber-400",
};

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useUserProfile();
  const { signOut, user } = useAuth();

  const userRoles = profile?.roles ?? [];

  const canSee = (item: NavItem) => {
    if (item.roles === "all") return true;
    return (item.roles as AppRole[]).some((r) => userRoles.includes(r));
  };

  const isItemActive = (item: NavItem) =>
    item.end ? location.pathname === item.url : location.pathname.startsWith(item.url);

  const isBudgetEditor = /^\/admin\/budget\//.test(location.pathname);

  // Auto-colapsa a sidebar no editor de orçamento em telas médias
  useEffect(() => {
    if (isBudgetEditor && !collapsed && window.innerWidth < 1280) {
      toggleSidebar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBudgetEditor]);

  const sections = useMemo(() => {
    return [PRIMARY_SECTION, COMERCIAL_SECTION, PRODUCAO_SECTION, ADMIN_SECTION]
      .map((s) => ({ ...s, items: s.items.filter(canSee) }))
      .filter((s) => s.items.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRoles.join(",")]);

  const toolGroups = useMemo(() => {
    return TOOL_GROUPS.map((g) => ({ ...g, items: g.items.filter(canSee) })).filter(
      (g) => g.items.length > 0,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRoles.join(",")]);

  const toolsActive = toolGroups.some((g) => g.items.some(isItemActive));
  const [toolsOpen, setToolsOpen] = useState<boolean>(toolsActive);
  useEffect(() => {
    if (toolsActive) setToolsOpen(true);
  }, [toolsActive]);

  async function handleSignOut() {
    await signOut();
    navigate("/login");
  }

  function openCommandPalette() {
    // Dispara o atalho global Cmd/Ctrl+K — captado por useGlobalShortcuts
    const event = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
      ctrlKey: true,
      bubbles: true,
    });
    window.dispatchEvent(event);
  }

  const initials = (profile?.full_name || "U")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");

  const primaryRole = userRoles[0];

  return (
    <TooltipProvider delayDuration={250}>
      <Sidebar collapsible="icon" className="border-r border-sidebar-border/60 bg-sidebar">
        {/* Header — logo + dispositivo de busca/comando */}
        <SidebarHeader className={cn("pt-3 pb-2", collapsed ? "px-2" : "px-3")}>
          <div className={cn("flex items-center", collapsed ? "justify-center" : "justify-start px-1 h-7")}>
            <img
              src={logoDark}
              alt="Bwild"
              className={collapsed ? "h-4 object-contain" : "h-5 object-contain"}
            />
          </div>

          {/* Search trigger — abre command palette (Cmd+K) */}
          <button
            type="button"
            onClick={openCommandPalette}
            className={cn(
              "mt-2.5 group flex items-center rounded-md transition-colors",
              "bg-sidebar-accent/50 hover:bg-sidebar-accent/80 text-white/80 hover:text-white",
              "ring-1 ring-sidebar-border/40 hover:ring-sidebar-border",
              collapsed ? "h-8 w-8 mx-auto justify-center" : "h-7 w-full px-2 gap-2",
            )}
            aria-label="Buscar (Cmd+K)"
          >
            <Search className="h-[14px] w-[14px] shrink-0" strokeWidth={2} />
            {!collapsed && (
              <>
                <span className="text-[12.5px] font-body flex-1 text-left">Buscar…</span>
                <kbd className="hidden md:inline-flex items-center gap-0.5 text-[10px] font-mono text-white/75 bg-sidebar-background/60 ring-1 ring-sidebar-border/60 rounded px-1 py-px leading-none">
                  ⌘K
                </kbd>
              </>
            )}
          </button>
        </SidebarHeader>

        {/* Conteúdo — navegação */}
        <SidebarContent
          className={cn(
            "py-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-sidebar-border/50 [&::-webkit-scrollbar-thumb]:rounded-full",
            collapsed ? "px-1.5" : "px-2",
          )}
        >
          {sections.map((section, idx) => (
            <div
              key={section.id}
              className={cn(
                idx > 0 && "mt-3",
                // separador discreto no modo colapsado entre seções (após a primeira)
                collapsed && idx > 0 && "pt-3 border-t border-sidebar-border/40 mx-1",
              )}
            >
              {!collapsed && section.label && (
                <div className="px-2 mb-1 flex items-center">
                  <span className="text-[10.5px] uppercase tracking-[0.08em] text-white/70 font-body font-semibold">
                    {section.label}
                  </span>
                </div>
              )}
              <ul className="space-y-px">
                {section.items.map((item) => (
                  <li key={item.url}>
                    <NavRow
                      item={item}
                      collapsed={collapsed}
                      isActive={isItemActive(item)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Ferramentas — collapsible, sempre por último */}
          {toolGroups.length > 0 && (
            <div
              className={cn(
                "mt-3",
                collapsed && "pt-3 border-t border-sidebar-border/40 mx-1",
              )}
            >
              {collapsed ? (
                // Colapsado: lista flat (todas as ferramentas como ícones)
                <ul className="space-y-px">
                  {toolGroups.flatMap((g) =>
                    g.items.map((item) => (
                      <li key={item.url}>
                        <NavRow item={item} collapsed isActive={isItemActive(item)} />
                      </li>
                    )),
                  )}
                </ul>
              ) : (
                <Collapsible open={toolsOpen} onOpenChange={setToolsOpen}>
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "w-full group flex items-center justify-between px-2 py-1 rounded-md",
                        "text-[10.5px] uppercase tracking-[0.08em] font-body font-medium",
                        "text-sidebar-foreground/35 hover:text-sidebar-foreground/65 transition-colors",
                      )}
                    >
                      <span>Ferramentas</span>
                      <ChevronDown
                        className={cn(
                          "h-3 w-3 transition-transform duration-150",
                          toolsOpen && "rotate-180",
                        )}
                        strokeWidth={2}
                      />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
                    <div className="mt-1 space-y-2.5">
                      {toolGroups.map((group) => (
                        <div key={group.id}>
                          <div className="px-2 mb-0.5 text-[10px] text-sidebar-foreground/30 font-body font-medium tracking-wide">
                            {group.label}
                          </div>
                          <ul className="space-y-px">
                            {group.items.map((item) => (
                              <li key={item.url}>
                                <NavRow
                                  item={item}
                                  collapsed={false}
                                  isActive={isItemActive(item)}
                                />
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          )}
        </SidebarContent>

        {/* Footer — perfil compacto com menu (Vercel/Linear style) */}
        <SidebarFooter
          className={cn(
            "border-t border-sidebar-border/60",
            collapsed ? "p-1.5" : "p-2",
          )}
        >
          {collapsed && isBudgetEditor && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 mx-auto mb-1 text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
                  onClick={toggleSidebar}
                >
                  <PanelLeftOpen className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                Expandir
              </TooltipContent>
            </Tooltip>
          )}

          {profile && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "group flex items-center rounded-md transition-colors outline-none",
                    "hover:bg-sidebar-accent/60 focus-visible:ring-1 focus-visible:ring-sidebar-ring",
                    collapsed ? "h-8 w-8 mx-auto justify-center" : "w-full h-9 px-1.5 gap-2",
                  )}
                  aria-label="Conta"
                >
                  <span className="relative shrink-0">
                    <span
                      className={cn(
                        "h-6 w-6 rounded-full bg-gradient-to-br from-sidebar-primary/40 to-sidebar-primary/15",
                        "ring-1 ring-sidebar-primary/25 flex items-center justify-center",
                        "text-[10.5px] font-display font-semibold text-sidebar-foreground",
                      )}
                    >
                      {initials}
                    </span>
                    {primaryRole && (
                      <span
                        className={cn(
                          "absolute -bottom-px -right-px h-2 w-2 rounded-full ring-2 ring-sidebar",
                          ROLE_DOT[primaryRole] ?? "bg-sidebar-foreground/40",
                        )}
                      />
                    )}
                  </span>
                  {!collapsed && (
                    <>
                      <span className="min-w-0 flex-1 text-left">
                        <span className="block text-[12.5px] font-body font-medium text-sidebar-foreground truncate leading-tight">
                          {profile.full_name || "Usuário"}
                        </span>
                        {primaryRole && (
                          <span className="block text-[10.5px] font-body text-sidebar-foreground/45 truncate leading-tight">
                            {ROLE_LABEL[primaryRole] ?? primaryRole}
                          </span>
                        )}
                      </span>
                      <ChevronsUpDown className="h-3 w-3 text-sidebar-foreground/35 shrink-0" />
                    </>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side={collapsed ? "right" : "top"}
                align="start"
                sideOffset={8}
                className="w-56"
              >
                <DropdownMenuLabel className="font-body">
                  <div className="text-[12px] font-medium truncate">
                    {profile.full_name || "Usuário"}
                  </div>
                  {user?.email && (
                    <div className="text-[11px] text-muted-foreground font-normal truncate">
                      {user.email}
                    </div>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/admin/usuarios")} className="text-[12.5px]">
                  <Users className="h-3.5 w-3.5 mr-2" />
                  Usuários
                </DropdownMenuItem>
                <DropdownMenuItem onClick={openCommandPalette} className="text-[12.5px]">
                  <Search className="h-3.5 w-3.5 mr-2" />
                  Buscar
                  <kbd className="ml-auto text-[10px] font-mono text-muted-foreground">⌘K</kbd>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-[12.5px] text-destructive focus:text-destructive">
                  <LogOut className="h-3.5 w-3.5 mr-2" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </SidebarFooter>
      </Sidebar>
    </TooltipProvider>
  );
}
