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
    <div className="min-h-screen relative flex items-center overflow-hidden"
      style={{
        background: "linear-gradient(135deg, hsl(210 40% 12%) 0%, hsl(210 55% 20%) 40%, hsl(200 50% 30%) 70%, hsl(195 45% 25%) 100%)",
      }}
    >
      {/* Subtle texture overlay */}
      <div className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        }}
      />

      {/* Logo top-right */}
      <div className="absolute top-8 right-8 md:top-12 md:right-16">
        <img src={logoBwildWhite} alt="Bwild" className="h-12 md:h-16 w-auto opacity-90" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-md px-8 md:px-16 py-12">
        {/* Title */}
        <h1 className="font-display text-3xl md:text-4xl font-bold text-white mb-10 leading-tight">
          Orçamentos Bwild
          <span className="text-emerald-400">.</span>
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-white/90 mb-2 font-body">
              <Mail className="h-4 w-4" />
              E-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg bg-white/10 backdrop-blur-sm border border-white/15 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/25 focus:border-white/30 font-body text-sm transition-all"
              placeholder="seu@email.com"
            />
          </div>

          {/* Password */}
          {mode !== "forgot" && (
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-white/90 mb-2 font-body">
                <Lock className="h-4 w-4" />
                Senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 rounded-lg bg-white/10 backdrop-blur-sm border border-white/15 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/25 focus:border-white/30 font-body text-sm transition-all pr-12"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
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
            <button
              type="button"
              onClick={() => setMode("forgot")}
              className="text-sm text-white/60 hover:text-white/90 transition-colors font-body"
            >
              Esqueci minha senha
            </button>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-white text-charcoal font-semibold font-body text-sm hover:bg-white/95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "forgot" ? "Enviar e-mail" : mode === "signup" ? "Criar conta" : "Entrar"}
          </button>

          {/* Toggle mode */}
          <button
            type="button"
            onClick={() => setMode(mode === "signup" ? "login" : mode === "forgot" ? "login" : "signup")}
            className="w-full text-sm text-white/50 hover:text-white/80 transition-colors font-body flex items-center justify-center gap-1.5"
          >
            {mode === "forgot" && <ArrowLeft className="h-3.5 w-3.5" />}
            {mode === "signup" ? "Já tem conta? Entrar" : mode === "forgot" ? "Voltar ao login" : "Não tem conta? Criar"}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-12 space-y-2 text-center">
          <p className="text-xs text-white/35 font-body flex items-center justify-center gap-1.5">
            <HelpCircle className="h-3 w-3" />
            Problemas?{" "}
            <span className="font-medium text-white/50 hover:text-white/70 cursor-pointer transition-colors">
              Falar com suporte
            </span>
          </p>
          <p className="text-xs text-white/25 font-body flex items-center justify-center gap-1.5">
            <ShieldCheck className="h-3 w-3" />
            Acesso seguro · LGPD
          </p>
          <p className="text-xs text-white/20 font-body">
            © 2026 Bwild · Todos os direitos reservados
          </p>
        </div>
      </div>
    </div>
  );
}
