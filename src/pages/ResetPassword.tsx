import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import { Loader2, Eye, EyeOff, AlertCircle, CheckCircle2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

type Status = "checking" | "ready" | "expired";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status>("checking");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const hash = window.location.hash;
    if (hash.includes("type=recovery") || hash.includes("access_token")) {
      setStatus("ready");
      return;
    }

    // If we already have a recovery session, allow.
    supabase.auth.getSession().then(() => {
      if (cancelled) return;
      // We can't reliably detect recovery from getSession, so keep waiting for the event.
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY") setStatus("ready");
    });

    // Safety net: if no recovery event arrives in 6s, assume the link is expired/invalid.
    const timeoutId = window.setTimeout(() => {
      if (!cancelled) {
        setStatus((prev) => (prev === "checking" ? "expired" : prev));
      }
    }, 6000);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      window.clearTimeout(timeoutId);
    };
  }, []);

  const validate = (): string | null => {
    if (password.length < 8) return "A senha deve ter no mínimo 8 caracteres.";
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      return "Use letras e números para uma senha mais segura.";
    }
    if (password !== confirm) return "As senhas não conferem.";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const v = validate();
    if (v) {
      setFormError(v);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      if (/same.*password|new password should be different/i.test(error.message)) {
        setFormError("A nova senha precisa ser diferente da anterior.");
      } else if (/expired|invalid|jwt/i.test(error.message)) {
        setStatus("expired");
      } else {
        setFormError("Não foi possível atualizar a senha. Tente novamente em instantes.");
      }
      return;
    }
    toast.success("Senha atualizada com sucesso!");
    navigate("/admin");
  };

  if (status === "checking") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground font-body">Validando link de recuperação...</p>
        </div>
      </div>
    );
  }

  if (status === "expired") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <ShieldAlert className="h-6 w-6 text-destructive" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground mb-2">Link expirado ou inválido</h1>
          <p className="text-sm text-muted-foreground font-body mb-6">
            O link de recuperação tem validade limitada e só pode ser usado uma vez. Solicite um novo para continuar.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center justify-center w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium font-body text-sm hover:bg-primary/90 transition-colors"
          >
            Voltar ao login
          </Link>
        </div>
      </div>
    );
  }

  const passwordsMatch = confirm.length > 0 && password === confirm;
  const passwordTooShort = password.length > 0 && password.length < 8;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-2xl font-bold text-foreground">Nova senha</h1>
          <p className="text-muted-foreground text-sm font-body mt-1">Defina uma senha forte para acessar sua conta</p>
        </div>

        {formError && (
          <div
            role="alert"
            aria-live="assertive"
            className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 mb-4"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-destructive" />
            <p className="text-sm font-body text-destructive">{formError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="new-password" className="block text-sm font-medium text-foreground mb-1.5 font-body">
              Nova senha
            </label>
            <div className="relative">
              <input
                id="new-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                aria-invalid={passwordTooShort}
                aria-describedby="password-hint"
                className="w-full px-4 py-2.5 pr-11 rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 font-body text-sm"
                placeholder="Mínimo 8 caracteres"
                disabled={loading}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p id="password-hint" className="text-xs text-muted-foreground mt-1 font-body">
              Use ao menos 8 caracteres, com letras e números.
            </p>
          </div>

          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium text-foreground mb-1.5 font-body">
              Confirme a nova senha
            </label>
            <input
              id="confirm-password"
              type={showPassword ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              aria-invalid={confirm.length > 0 && !passwordsMatch}
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 font-body text-sm"
              placeholder="Repita a senha"
              disabled={loading}
            />
            {confirm.length > 0 && !passwordsMatch && (
              <p role="alert" className="text-xs text-destructive mt-1 font-body">
                As senhas não conferem.
              </p>
            )}
            {passwordsMatch && password.length >= 8 && (
              <p className="text-xs text-success mt-1 font-body inline-flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Senhas conferem
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium font-body text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar nova senha
          </button>
        </form>
      </div>
    </div>
  );
}
