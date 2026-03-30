import { Navigate } from "react-router-dom";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import type { AppRole } from "@/lib/role-constants";

interface RoleGuardProps {
  /** Allow access if user has ANY of these roles */
  allowedRoles: AppRole[];
  children: React.ReactNode;
  /** Where to redirect if unauthorized (default: /admin) */
  fallback?: string;
}

export function RoleGuard({ allowedRoles, children, fallback = "/admin" }: RoleGuardProps) {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useUserProfile();

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If user has no roles yet, allow access to /admin (dashboard will show appropriate state)
  if (!profile || profile.roles.length === 0) {
    if (allowedRoles.length === 0) return <>{children}</>;
    return <Navigate to={fallback} replace />;
  }

  const hasAccess = allowedRoles.some((role) => profile.roles.includes(role));
  if (!hasAccess) {
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
}
