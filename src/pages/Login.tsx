import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Loader2, ArrowLeft, Mail } from "lucide-react";
import { toast } from "sonner";

type Mode = "login" | "signup" | "forgot";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center mx-auto mb-4">
            <span className="text-primary-foreground font-display font-bold text-2xl">B</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">Bwild</h1>
          <p className="text-muted-foreground text-sm font-body mt-1">
            {mode === "forgot" ? "Recuperar senha" : "Painel Administrativo"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5 font-body">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 font-body text-sm"
              placeholder="seu@email.com"
            />
          </div>

          {mode !== "forgot" && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5 font-body">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 font-body text-sm"
                placeholder="••••••••"
              />
            </div>
          )}

          {error && <p className="text-sm text-destructive font-body">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium font-body text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "forgot" ? "Enviar e-mail" : mode === "signup" ? "Criar conta" : "Entrar"}
          </button>

          {mode === "login" && (
            <button
              type="button"
              onClick={() => setMode("forgot")}
              className="w-full text-xs text-muted-foreground hover:text-primary transition-colors font-body"
            >
              Esqueci minha senha
            </button>
          )}

          <button
            type="button"
            onClick={() => setMode(mode === "signup" ? "login" : mode === "forgot" ? "login" : "signup")}
            className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors font-body flex items-center justify-center gap-1.5"
          >
            {mode === "forgot" && <ArrowLeft className="h-3.5 w-3.5" />}
            {mode === "signup" ? "Já tem conta? Entrar" : mode === "forgot" ? "Voltar ao login" : "Não tem conta? Criar"}
          </button>
        </form>
      </div>
    </div>
  );
}
