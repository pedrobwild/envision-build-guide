import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2, Mail, Lock, Eye, EyeOff,
  AlertCircle, ShieldCheck, HelpCircle, ArrowLeft,
} from "lucide-react";
import authBg from "@/assets/bg-auth-v2.png";
import bwildLogo from "@/assets/logo-bwild-white.png";
import bwildEngineLogo from "@/assets/bwild-engine-logo.png";
import { z } from "zod";
import { useAuthRetryState } from "@/hooks/useAuthRetryState";

const loginSchema = z.object({
  email: z.string().trim().min(1, "Informe seu e-mail.").email("Digite um e-mail válido."),
  password: z.string().min(1, "Informe sua senha."),
});

type Mode = "login" | "forgot";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [mode, setMode] = useState<Mode>("login");
  const navigate = useNavigate();
  const authRetry = useAuthRetryState();

  useEffect(() => {
    let isMounted = true;
    let sessionCheckTimeout: number | null = null;

    const finishSessionCheck = () => {
      if (!isMounted) return;
      setCheckingSession(false);
      if (sessionCheckTimeout !== null) {
        window.clearTimeout(sessionCheckTimeout);
        sessionCheckTimeout = null;
      }
    };

    sessionCheckTimeout = window.setTimeout(() => {
      if (!isMounted) return;
      setCheckingSession(false);
    }, 8000);

    (async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (!isMounted) return;
        if (error || !session?.user) {
          if (error) await supabase.auth.signOut().catch(() => {});
          finishSessionCheck();
          return;
        }
        // Valida o JWT com o servidor — se estiver corrompido (bad_jwt /
        // missing sub claim), limpa a sessão local e mantém o usuário no
        // login em vez de navegar para "/" e travar a UI.
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (!isMounted) return;
        if (userError || !userData?.user) {
          await supabase.auth.signOut().catch(() => {});
          try {
            Object.keys(localStorage)
              .filter((k) => k.startsWith("sb-") && k.includes("-auth-token"))
              .forEach((k) => localStorage.removeItem(k));
          } catch { /* ignore */ }
          finishSessionCheck();
          return;
        }
        navigate("/", { replace: true });
        finishSessionCheck();
      } catch {
        finishSessionCheck();
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        if (event === "SIGNED_IN" && session?.user) {
          setTimeout(() => {
            if (isMounted) navigate("/", { replace: true });
          }, 0);
        }
        if (event === "SIGNED_OUT") finishSessionCheck();
      }
    );

    return () => {
      isMounted = false;
      if (sessionCheckTimeout !== null) window.clearTimeout(sessionCheckTimeout);
      subscription.unsubscribe();
    };
  }, [navigate]);

  function validate(): boolean {
    if (mode === "forgot") {
      const result = z.string().trim().min(1, "Informe seu e-mail.").email("Digite um e-mail válido.").safeParse(email);
      if (result.success) { setFieldErrors({}); return true; }
      setFieldErrors({ email: result.error.issues[0]?.message });
      return false;
    }
    const result = loginSchema.safeParse({ email, password });
    if (result.success) { setFieldErrors({}); return true; }
    const errs: { email?: string; password?: string } = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0] as "email" | "password";
      if (!errs[field]) errs[field] = issue.message;
    }
    setFieldErrors(errs);
    return false;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);
    if (!validate()) return;
    setLoading(true);

    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setLoading(false);
      if (error) {
        if (/rate limit/i.test(error.message)) {
          setFormError("Muitas tentativas. Aguarde alguns minutos antes de pedir outro e-mail.");
        } else {
          setFormError("Não foi possível enviar o e-mail de recuperação. Tente novamente em instantes.");
        }
      } else {
        setFieldErrors({});
        setMode("login");
        setSuccessMessage("E-mail de recuperação enviado! Verifique sua caixa de entrada (e o spam).");
      }
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setLoading(false);
        if (error.message.includes("Invalid login credentials")) {
          setFormError("E-mail ou senha incorretos. Verifique e tente novamente.");
        } else if (error.message.includes("Email not confirmed")) {
          setFormError("Seu acesso ainda não foi ativado. Fale com o suporte para liberar.");
        } else if (/rate limit/i.test(error.message)) {
          setFormError("Muitas tentativas. Aguarde alguns minutos e tente novamente.");
        } else if (/network|fetch|timeout/i.test(error.message)) {
          setFormError("Sem conexão no momento. Verifique sua internet e tente novamente.");
        } else {
          setFormError("Não foi possível entrar. Tente novamente ou fale com o suporte.");
        }
        return;
      }
      // Sucesso: navega; o redirect desmonta o componente, mas garantimos
      // limpeza do loading caso a navegação seja interceptada.
      setLoading(false);
      navigate("/admin");
    } catch {
      setLoading(false);
      setFormError("Não foi possível entrar. Tente novamente ou fale com o suporte.");
    }
  };

  const handlePasswordKeyEvent = (e: React.KeyboardEvent) => {
    if (typeof e.getModifierState === "function") {
      setCapsLockOn(e.getModifierState("CapsLock"));
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-4 border-primary/20" />
            <div className="absolute inset-0 h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground font-body">Verificando sessão...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-[100dvh] flex relative bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${authBg})` }}
    >
      {/* Logo – visible only on mobile */}
      <img
        src={bwildLogo}
        alt="Bwild"
        className="absolute top-6 right-6 h-8 md:hidden object-contain"
      />

      {/* Form – centered on mobile, left on desktop */}
      <div className="flex flex-col items-center md:items-start w-full md:max-w-lg px-5 sm:px-12 md:px-16 pt-8 sm:pt-12 pb-10 sm:pb-16 mx-auto md:mx-0">
        <img
          src={bwildEngineLogo}
          alt="Bwild Engine"
          className="w-64 sm:w-80 md:w-96 h-auto object-contain mb-6 sm:mb-8 mx-auto"
        />

        {successMessage && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-start gap-2.5 rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3.5 mb-6 w-full"
          >
            <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" />
            <p className="text-sm font-body text-emerald-300">{successMessage}</p>
          </div>
        )}

        {formError && (
          <div
            role="alert"
            aria-live="assertive"
            className="flex items-start gap-2.5 rounded-lg border border-red-400/30 bg-red-500/10 p-3.5 mb-6 w-full"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
            <p className="text-sm font-body text-red-300">{formError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 w-full" noValidate>
          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="login-email" className="text-white flex items-center gap-1.5 text-sm font-medium font-body">
              <Mail className="h-3.5 w-3.5" /> E-mail
            </Label>
            <Input
              id="login-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
              }}
              onBlur={() => { if (fieldErrors.email) validate(); }}
              className="h-12 bg-white/10 border-white/30 text-white placeholder:text-white/50 focus-visible:ring-white/40 focus-visible:border-white/50 text-base font-body"
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? "login-email-error" : undefined}
              disabled={loading}
              autoFocus
            />
            {fieldErrors.email && (
              <p id="login-email-error" role="alert" className="text-xs text-red-400 mt-1 font-body">
                {fieldErrors.email}
              </p>
            )}
          </div>

          {/* Password */}
          {mode !== "forgot" && (
            <div className="space-y-2">
              <Label htmlFor="login-password" className="text-white flex items-center gap-1.5 text-sm font-medium font-body">
                <Lock className="h-3.5 w-3.5" /> Senha
              </Label>
              <div className="relative">
                <Input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
                  }}
                  onKeyDown={handlePasswordKeyEvent}
                  onKeyUp={handlePasswordKeyEvent}
                  className="h-12 bg-white/10 border-white/30 text-white placeholder:text-white/50 pr-11 focus-visible:ring-white/40 focus-visible:border-white/50 text-base font-body"
                  aria-invalid={!!fieldErrors.password}
                  aria-describedby={fieldErrors.password ? "login-password-error" : undefined}
                  disabled={loading}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {fieldErrors.password && (
                <p id="login-password-error" role="alert" className="text-xs text-red-400 mt-1 font-body">
                  {fieldErrors.password}
                </p>
              )}
              {capsLockOn && (
                <p className="text-xs text-amber-400 flex items-center gap-1 mt-1 font-body">
                  <AlertCircle className="h-3 w-3" />
                  Caps Lock está ativado
                </p>
              )}
            </div>
          )}

          {/* Forgot password link */}
          {mode === "login" && (
            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={() => { setMode("forgot"); setFormError(null); setSuccessMessage(null); setFieldErrors({}); }}
                className="text-xs text-white/80 hover:text-white hover:underline font-medium font-body"
              >
                Esqueci minha senha
              </button>
            </div>
          )}

          {/* Submit */}
          <Button
            type="submit"
            className="w-full h-12 bg-white text-slate-900 hover:bg-white/90 font-semibold text-base font-body"
            disabled={loading || authRetry.reconnecting}
            aria-busy={loading || authRetry.reconnecting}
          >
            {authRetry.reconnecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {authRetry.reason === "offline"
                  ? "Aguardando conexão…"
                  : `Reconectando… (${authRetry.attempt}/${authRetry.maxAttempts})`}
              </>
            ) : loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {mode === "forgot" ? "Enviando..." : "Entrando..."}
              </>
            ) : (
              mode === "forgot" ? "Enviar e-mail de recuperação" : "Entrar"
            )}
          </Button>

          {authRetry.reconnecting && (
            <p
              role="status"
              aria-live="polite"
              className="text-xs text-white/70 text-center font-body -mt-2"
            >
              {authRetry.reason === "offline"
                ? "Você está offline. Aguardaremos a rede voltar para concluir sua entrada."
                : "Conexão instável. Não feche a página — tentaremos novamente automaticamente."}
            </p>
          )}

          {/* Back to login from forgot */}
          {mode === "forgot" && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => { setMode("login"); setFormError(null); setSuccessMessage(null); setFieldErrors({}); }}
                className="text-sm text-white/80 hover:text-white transition-colors font-body inline-flex items-center gap-1.5"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar ao login
              </button>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="mt-8 flex items-center justify-center gap-1.5 text-sm text-white/70 w-full font-body">
          <HelpCircle className="h-4 w-4 shrink-0" />
          <span>Problemas?</span>
          <a
            href="https://wa.me/5511911906183?text=Preciso%20de%20ajuda%20com%20o%20acesso%20ao%20sistema."
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/90 hover:text-white hover:underline font-medium"
          >
            Falar com suporte
          </a>
        </div>

        <div className="mt-6 flex flex-col items-center gap-1 w-full text-center">
          <div className="flex items-center gap-1.5 text-xs text-white/50 font-body">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Acesso seguro · LGPD</span>
          </div>
          <p className="text-xs text-white/40 font-body">
            © {new Date().getFullYear()} Bwild · Todos os direitos reservados
          </p>
        </div>
      </div>
    </div>
  );
}
