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

interface NavItem {
  title: string;
  url: string;
  icon: React.ElementType;
  roles: AppRole[] | "all";
  end?: boolean;
  actionUrl?: string;
  actionLabel?: string;
}

const NAV_ITEMS: NavItem[] = [
  { title: "Painel Geral", url: "/admin", icon: LayoutDashboard, roles: "all", end: true },
  { title: "Solicitações", url: "/admin/solicitacoes", icon: FileText, roles: ["admin", "comercial"], actionUrl: "/admin/solicitacoes/nova", actionLabel: "Nova solicitação" },
  { title: "Minha Produção", url: "/admin/producao", icon: Hammer, roles: ["admin", "orcamentista"] },
  { title: "Meu Pipeline", url: "/admin/comercial", icon: Briefcase, roles: ["admin", "comercial"] },
  { title: "Operações", url: "/admin/operacoes", icon: Settings, roles: ["admin"] },
  { title: "Financeiro", url: "/admin/financeiro", icon: DollarSign, roles: ["admin"] },
  { title: "Usuários", url: "/admin/usuarios", icon: Users, roles: ["admin"] },
  { title: "QA", url: "/qa", icon: Shield, roles: ["admin"] },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useUserProfile();
  const { signOut } = useAuth();

  const userRoles = profile?.roles ?? [];

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.roles === "all") return true;
    return item.roles.some((r) => userRoles.includes(r));
  });

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
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.url} className="group/action">
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.end}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-body text-muted-foreground hover:bg-muted/50 transition-colors"
                      activeClassName="bg-primary/10 text-primary font-medium"
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
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-2">
        {!collapsed && profile && (
          <div className="px-2 py-1.5 mb-1">
            <p className="text-xs font-medium font-body text-foreground truncate">
              {profile.full_name || "Usuário"}
            </p>
            <p className="text-[11px] text-muted-foreground font-body truncate">
              {userRoles.join(", ") || "sem perfil"}
            </p>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground text-xs"
          onClick={handleSignOut}
        >
          <LogOut className="h-3.5 w-3.5" />
          {!collapsed && "Sair"}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
