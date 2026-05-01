import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useActiveRole, homePathForRole } from "@/hooks/useActiveRole";
import { Loader2 } from "lucide-react";

/**
 * Redireciona o usuário para a home do papel ativo.
 *
 * Regras:
 *   • Não autenticado → /login
 *   • Sem papel resolvido (ex.: usuário inativo ou sem roles) → /admin
 *     (rota protegida que renderiza fallback adequado)
 *   • Caso contrário → /painel/<papel-ativo>
 *
 * O papel ativo vem de `profiles.active_role` (persistido) com
 * fallback admin > comercial > orcamentista quando NULL ou inválido.
 */
export function RoleRedirect() {
  const { user, loading: authLoading } = useAuth();
  const { activeRole, loading: roleLoading } = useActiveRole();

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return <Navigate to={homePathForRole(activeRole)} replace />;
}
