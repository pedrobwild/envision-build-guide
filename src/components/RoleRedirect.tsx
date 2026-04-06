import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Loader2 } from "lucide-react";

/**
 * Smart redirect based on user role.
 * - Not logged in → /login
 * - comercial → /admin/comercial
 * - orcamentista → /admin/producao
 * - admin (or fallback) → /admin
 */
export function RoleRedirect() {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading, isAdmin, isComercial, isOrcamentista } = useUserProfile();

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (!isAdmin && isComercial) return <Navigate to="/admin/comercial" replace />;
  if (!isAdmin && isOrcamentista) return <Navigate to="/admin/producao" replace />;

  return <Navigate to="/admin" replace />;
}
