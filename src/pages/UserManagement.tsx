import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Users,
  UserPlus,
  Loader2,
  Search,
  MoreVertical,
  Shield,
  ShieldCheck,
  ShieldAlert,
  UserX,
  UserCheck,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { ROLES, type AppRole } from "@/lib/role-constants";

interface ManagedUser {
  id: string;
  full_name: string | null;
  email: string;
  is_active: boolean;
  created_at: string | null;
  roles: AppRole[];
}

export default function UserManagement() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("comercial");
  const [inviting, setInviting] = useState(false);

  // Role edit dialog
  const [editUser, setEditUser] = useState<ManagedUser | null>(null);
  const [editRoles, setEditRoles] = useState<AppRole[]>([]);
  const [savingRoles, setSavingRoles] = useState(false);

  const callAdminAPI = useCallback(
    async (body: Record<string, unknown>) => {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body,
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    []
  );

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await callAdminAPI({ action: "list_users" });
      setUsers(data.users || []);
    } catch (err: unknown) {
      toast.error("Erro ao carregar usuários: " + (err instanceof Error ? err.message : String(err)));
    }
    setLoading(false);
  }, [callAdminAPI]);

  useEffect(() => {
    if (session) loadUsers();
  }, [session, loadUsers]);

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      await callAdminAPI({
        action: "invite_user",
        email: inviteEmail.trim().toLowerCase(),
        full_name: inviteName.trim(),
        role: inviteRole,
      });
      toast.success(`Usuário ${inviteEmail} criado com sucesso.`);
      setInviteOpen(false);
      setInviteEmail("");
      setInviteName("");
      setInviteRole("comercial");
      loadUsers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
    setInviting(false);
  }

  async function handleSaveRoles() {
    if (!editUser) return;
    setSavingRoles(true);
    try {
      await callAdminAPI({
        action: "update_roles",
        user_id: editUser.id,
        roles: editRoles,
      });
      toast.success("Perfis atualizados.");
      setEditUser(null);
      loadUsers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
    setSavingRoles(false);
  }

  async function handleToggleActive(user: ManagedUser) {
    try {
      await callAdminAPI({
        action: "toggle_active",
        user_id: user.id,
        is_active: !user.is_active,
      });
      toast.success(user.is_active ? "Usuário desativado." : "Usuário reativado.");
      loadUsers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  function toggleEditRole(role: AppRole) {
    setEditRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  }

  const roleIcon = (role: AppRole) => {
    switch (role) {
      case "admin":
        return <ShieldAlert className="h-3 w-3" />;
      case "comercial":
        return <ShieldCheck className="h-3 w-3" />;
      case "orcamentista":
        return <Shield className="h-3 w-3" />;
    }
  };

  const roleBadgeColor = (role: AppRole) => {
    switch (role) {
      case "admin":
        return "bg-red-100 text-red-800 border-red-200";
      case "comercial":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "orcamentista":
        return "bg-amber-100 text-amber-800 border-amber-200";
    }
  };

  // Filters
  const filtered = users.filter((u) => {
    const matchSearch =
      !search ||
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole =
      roleFilter === "all" ||
      (roleFilter === "none" ? u.roles.length === 0 : u.roles.includes(roleFilter as AppRole));
    return matchSearch && matchRole;
  });

  const activeCount = users.filter((u) => u.is_active).length;
  const withoutRole = users.filter((u) => u.roles.length === 0).length;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold font-display text-foreground flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Gestão de Usuários
            </h1>
            <p className="text-sm text-muted-foreground font-body mt-1">
              {users.length} usuários · {activeCount} ativos
              {withoutRole > 0 && (
                <span className="text-amber-600 ml-2">· {withoutRole} sem perfil</span>
              )}
            </p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-4 w-4" />
            Convidar Usuário
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-40 h-9 text-sm">
              <SelectValue placeholder="Perfil" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os perfis</SelectItem>
              <SelectItem value="none">Sem perfil</SelectItem>
              {Object.entries(ROLES).map(([key, { label }]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Users list */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 flex flex-col items-center text-center">
              <Users className="h-8 w-8 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground font-body">
                {search || roleFilter !== "all"
                  ? "Nenhum usuário encontrado com os filtros aplicados."
                  : "Nenhum usuário cadastrado ainda."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left font-medium text-muted-foreground px-4 py-3 font-body">Usuário</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3 font-body">Email</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3 font-body">Perfis</th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3 font-body">Status</th>
                      <th className="text-right font-medium text-muted-foreground px-4 py-3 font-body w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((u) => (
                      <tr key={u.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-medium text-foreground font-body">
                            {u.full_name || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-muted-foreground font-body">{u.email}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {u.roles.length === 0 ? (
                              <span className="text-xs text-muted-foreground italic font-body">Sem perfil</span>
                            ) : (
                              u.roles.map((role) => (
                                <Badge
                                  key={role}
                                  variant="outline"
                                  className={`text-[11px] gap-1 ${roleBadgeColor(role)}`}
                                >
                                  {roleIcon(role)} {ROLES[role].label}
                                </Badge>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {u.is_active ? (
                            <Badge variant="outline" className="text-[11px] bg-green-50 text-green-700 border-green-200">
                              Ativo
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[11px] bg-muted text-muted-foreground">
                              Inativo
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreVertical className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditUser(u);
                                  setEditRoles([...u.roles]);
                                }}
                              >
                                <Shield className="h-3.5 w-3.5 mr-2" />
                                Editar perfis
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleToggleActive(u)}>
                                {u.is_active ? (
                                  <>
                                    <UserX className="h-3.5 w-3.5 mr-2" />
                                    Desativar
                                  </>
                                ) : (
                                  <>
                                    <UserCheck className="h-3.5 w-3.5 mr-2" />
                                    Reativar
                                  </>
                                )}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <UserPlus className="h-5 w-5 text-primary" />
              Convidar Usuário
            </DialogTitle>
            <DialogDescription className="font-body text-sm">
              O usuário receberá um email para definir sua senha.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium font-body text-foreground">Email *</label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="email@empresa.com"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium font-body text-foreground">Nome completo</label>
              <Input
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Nome do colaborador"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium font-body text-foreground">Perfil *</label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as AppRole)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLES).map(([key, { label, description }]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex flex-col">
                        <span>{label}</span>
                        <span className="text-xs text-muted-foreground">{description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setInviteOpen(false)} disabled={inviting}>
              Cancelar
            </Button>
            <Button onClick={handleInvite} disabled={!inviteEmail.trim() || inviting}>
              {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4 mr-1" />}
              Convidar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Edit Dialog */}
      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-base">
              Editar Perfis
            </DialogTitle>
            <DialogDescription className="font-body text-sm">
              {editUser?.full_name || editUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {(Object.entries(ROLES) as [AppRole, { label: string; description: string }][]).map(
              ([key, { label, description }]) => (
                <label
                  key={key}
                  className="flex items-start gap-3 cursor-pointer rounded-lg border p-3 hover:bg-muted/30 transition-colors"
                >
                  <Checkbox
                    checked={editRoles.includes(key)}
                    onCheckedChange={() => toggleEditRole(key)}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="flex items-center gap-1.5">
                      {roleIcon(key)}
                      <span className="text-sm font-medium font-body">{label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground font-body">{description}</p>
                  </div>
                </label>
              )
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditUser(null)} disabled={savingRoles}>
              Cancelar
            </Button>
            <Button onClick={handleSaveRoles} disabled={savingRoles}>
              {savingRoles ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
