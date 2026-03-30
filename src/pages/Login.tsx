import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Mail, Lock, Eye, EyeOff,
  AlertCircle, ShieldCheck, HelpCircle, ArrowLeft,
} from "lucide-react";
import authBg from "@/assets/auth-bg.png";
import bwildLogo from "@/assets/logo-bwild-white.png";
import { toast as sonnerToast } from "sonner";

type Mode = "login" | "signup" | "forgot";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("login");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setLoading(true);

    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) setFormError(error.message);
      else {
        sonnerToast.success("E-mail de recuperação enviado!", { description: "Verifique sua caixa de entrada." });
        setMode("login");
      }
      setLoading(false);
      return;
    }

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setFormError(error.message);
      else sonnerToast.success("Conta criada! Verifique seu e-mail para confirmar.", { duration: 6000 });
      setLoading(false);
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
        } else {
          setFormError("Não foi possível entrar. Tente novamente ou fale com o suporte.");
        }
        return;
      }
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
      <div className="flex flex-col justify-center items-center md:items-start w-full md:max-w-lg px-5 sm:px-12 md:px-16 py-10 sm:py-16 mx-auto md:mx-0">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white leading-tight mb-10 sm:mb-12 text-center md:text-left w-full font-display">
          Orçamentos Bwild<span className="text-[#366478]">.</span>
        </h1>

        {formError && (
          <div
            role="alert"
            aria-live="assertive"
            className="flex items-start gap-2.5 rounded-lg border border-red-400/30 bg-red-500/10 p-3.5 mb-6 w-full"
          >
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-300 font-body">{formError}</p>
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
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 bg-white/10 border-white/30 text-white placeholder:text-white/60 focus-visible:ring-white/40 focus-visible:border-white/50 text-base font-body"
              disabled={loading}
              autoFocus
            />
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
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handlePasswordKeyEvent}
                  onKeyUp={handlePasswordKeyEvent}
                  className="h-12 bg-white/10 border-white/30 text-white placeholder:text-white/50 pr-11 focus-visible:ring-white/40 focus-visible:border-white/50 text-base font-body"
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
                onClick={() => setMode("forgot")}
                className="text-xs text-white/90 hover:text-white hover:underline font-medium font-body"
              >
                Esqueci minha senha
              </button>
            </div>
          )}

          {/* Submit */}
          <Button
            type="submit"
            className="w-full h-12 bg-white text-slate-900 hover:bg-white/90 font-semibold text-base font-body"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {mode === "forgot" ? "Enviando..." : mode === "signup" ? "Criando..." : "Entrando..."}
              </>
            ) : (
              mode === "forgot" ? "Enviar e-mail" : mode === "signup" ? "Criar conta" : "Entrar"
            )}
          </Button>

          {/* Toggle mode */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setMode(mode === "signup" ? "login" : mode === "forgot" ? "login" : "signup")}
              className="text-sm text-white/80 hover:text-white transition-colors font-body inline-flex items-center gap-1.5"
            >
              {mode === "forgot" && <ArrowLeft className="h-3.5 w-3.5" />}
              {mode === "signup" ? "Já tem conta? Entrar" : mode === "forgot" ? "Voltar ao login" : "Não tem conta? Criar"}
            </button>
          </div>
        </form>

        {/* Footer */}
        <div className="mt-8 flex items-center justify-center gap-1.5 text-sm text-white/80 w-full font-body">
          <HelpCircle className="h-4 w-4 shrink-0" />
          <span>Problemas?</span>
          <a
            href="https://wa.me/5511911906183?text=Preciso%20de%20ajuda%20com%20o%20acesso%20ao%20sistema."
            target="_blank"
            rel="noopener noreferrer"
            className="text-white hover:underline font-medium"
          >
            Falar com suporte
          </a>
        </div>

        <div className="mt-6 flex flex-col items-center gap-1 w-full text-center">
          <div className="flex items-center gap-1.5 text-xs text-white/70 font-body">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Acesso seguro · LGPD</span>
          </div>
          <p className="text-xs text-white/60 font-body">
            © {new Date().getFullYear()} Bwild · Todos os direitos reservados
          </p>
        </div>
      </div>
    </div>
  );
}
