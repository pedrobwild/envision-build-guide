/**
 * RoleSwitcher — dropdown no header do painel para alternar entre
 * Comercial / Orçamentista / Admin quando o usuário tem mais de
 * um papel atribuído.
 *
 * Regras de UX:
 *   • Se o usuário tem só 1 papel → não renderiza nada.
 *   • Mudar de papel persiste no Supabase via RPC `set_active_role`
 *     e navega para a home daquele papel.
 *   • Mostra ícone do papel ativo + label curta.
 */

import { useNavigate } from "react-router-dom";
import { Briefcase, Hammer, ShieldCheck, Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useActiveRole, homePathForRole } from "@/hooks/useActiveRole";
import { ROLES, type AppRole } from "@/lib/role-constants";

const ROLE_ICONS: Record<AppRole, React.ElementType> = {
  admin: ShieldCheck,
  comercial: Briefcase,
  orcamentista: Hammer,
};

const SHORT_LABEL: Record<AppRole, string> = {
  admin: "Admin",
  comercial: "Comercial",
  orcamentista: "Orçamentista",
};

export function RoleSwitcher() {
  const navigate = useNavigate();
  const { activeRole, availableRoles, setActiveRole, loading } = useActiveRole();

  // Só faz sentido o switcher quando há ≥2 papéis disponíveis.
  if (loading || availableRoles.length < 2 || !activeRole) return null;

  const ActiveIcon = ROLE_ICONS[activeRole];

  async function handleSelect(role: AppRole) {
    if (role === activeRole) return;
    try {
      await setActiveRole(role);
      navigate(homePathForRole(role));
    } catch {
      toast.error("Não foi possível trocar de painel.");
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 h-8 font-body text-xs border-border/70 hover:border-primary/40 hover:bg-accent/40"
        >
          <ActiveIcon className="h-3.5 w-3.5 text-primary" />
          <span className="font-medium">Painel: {SHORT_LABEL[activeRole]}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground/70 font-body font-semibold">
          Trocar de painel
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {availableRoles.map((role) => {
          const Icon = ROLE_ICONS[role];
          const isActive = role === activeRole;
          return (
            <DropdownMenuItem
              key={role}
              onSelect={() => handleSelect(role)}
              className="gap-2 cursor-pointer text-sm font-body"
            >
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              <div className="flex-1">
                <div className="font-medium text-foreground">{ROLES[role].label}</div>
                <div className="text-[10px] text-muted-foreground/70 font-body">
                  {ROLES[role].description}
                </div>
              </div>
              {isActive && <Check className="h-3.5 w-3.5 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
