import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Loader2, Mail, Lock, Eye, EyeOff, ArrowLeft, HelpCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import logoBwildWhite from "@/assets/logo-bwild-white.png";

type Mode = "login" | "signup" | "forgot";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) setError(error.message);
      else {
        toast.success("E-mail de recuperação enviado!", { description: "Verifique sua caixa de entrada." });
        setMode("login");
      }
      setLoading(false);
      return;
    }

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else toast.success("Conta criada! Verifique seu e-mail para confirmar.", { duration: 6000 });
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else navigate("/admin");
    }
    setLoading(false);
  };

  return (
    <div
      className="min-h-screen relative flex items-center overflow-hidden"
      style={{
        background: "linear-gradient(160deg, #0a1628 0%, #0f2440 30%, #123456 55%, #154060 75%, #0f2440 100%)",
      }}
    >
      {/* Ocean-like subtle texture overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at 70% 60%, rgba(20,70,120,0.35) 0%, transparent 60%), radial-gradient(ellipse at 30% 80%, rgba(15,50,90,0.25) 0%, transparent 50%)",
        }}
      />

      {/* Logo top-right */}
      <div className="absolute top-8 right-8 md:top-12 md:right-16 z-20">
        <img src={logoBwildWhite} alt="Bwild" className="h-14 md:h-20 w-auto" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-lg px-10 md:px-20 py-12">
        {/* Title */}
        <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-12 leading-tight tracking-tight">
          Orçamentos Bwild
          <span className="text-emerald-400">.</span>
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email */}
          <div>
            <label className="flex items-center gap-2.5 text-sm font-medium text-white mb-2.5 font-body">
              <Mail className="h-4 w-4 opacity-80" />
              E-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3.5 rounded-xl border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 font-body text-sm transition-all"
              style={{ backgroundColor: "rgba(255,255,255,0.07)", backdropFilter: "blur(12px)" }}
              placeholder="seu@email.com"
            />
          </div>

          {/* Password */}
          {mode !== "forgot" && (
            <div>
              <label className="flex items-center gap-2.5 text-sm font-medium text-white mb-2.5 font-body">
                <Lock className="h-4 w-4 opacity-80" />
                Senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-3.5 rounded-xl border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 font-body text-sm transition-all pr-12"
                  style={{ backgroundColor: "rgba(255,255,255,0.07)", backdropFilter: "blur(12px)" }}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-300 font-body bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Forgot password link */}
          {mode === "login" && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => setMode("forgot")}
                className="text-sm text-blue-300/70 hover:text-blue-200 transition-colors font-body"
              >
                Esqueci minha senha
              </button>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-white text-[#0a1628] font-semibold font-body text-sm hover:bg-white/95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "forgot" ? "Enviar e-mail" : mode === "signup" ? "Criar conta" : "Entrar"}
          </button>

          {/* Toggle mode */}
          <div className="text-center">
            <button
              type="button"
              onClick={() => setMode(mode === "signup" ? "login" : mode === "forgot" ? "login" : "signup")}
              className="text-sm text-white/40 hover:text-white/70 transition-colors font-body inline-flex items-center gap-1.5"
            >
              {mode === "forgot" && <ArrowLeft className="h-3.5 w-3.5" />}
              {mode === "signup" ? "Já tem conta? Entrar" : mode === "forgot" ? "Voltar ao login" : "Não tem conta? Criar"}
            </button>
          </div>
        </form>

        {/* Footer */}
        <div className="mt-16 space-y-2 text-center">
          <p className="text-xs text-white/30 font-body flex items-center justify-center gap-1.5">
            <HelpCircle className="h-3 w-3" />
            Problemas?{" "}
            <span className="font-medium text-white/45 hover:text-white/60 cursor-pointer transition-colors">
              Falar com suporte
            </span>
          </p>
          <p className="text-xs text-white/20 font-body flex items-center justify-center gap-1.5">
            <ShieldCheck className="h-3 w-3" />
            Acesso seguro · LGPD
          </p>
          <p className="text-xs text-white/15 font-body">
            © 2026 Bwild · Todos os direitos reservados
          </p>
        </div>
      </div>
    </div>
  );
}
