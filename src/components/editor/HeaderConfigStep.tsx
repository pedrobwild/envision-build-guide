import { Eye, EyeOff, Type } from "lucide-react";
import { useState } from "react";
import type { HeaderConfig } from "@/components/budget/BudgetHeader";

interface HeaderConfigStepProps {
  config: HeaderConfig;
  onChange: (config: HeaderConfig) => void;
}

const TOGGLES: { key: keyof HeaderConfig; label: string; description: string }[] = [
  { key: "hide_badge", label: "Badge 'Orçamento'", description: "Selo superior com o tipo do documento" },
  { key: "hide_client_context", label: "Barra de contexto", description: "Linha com nome do cliente e condomínio" },
  { key: "hide_subtitle", label: "Subtítulo personalizado", description: "Ex: 'Orçamento personalizado para…'" },
  { key: "hide_tagline", label: "Tagline", description: "Ex: 'Projeto personalizado · Gestão completa · Execução com garantia'" },
  { key: "hide_stat_badges", label: "Badges de estatísticas", description: "'5 anos garantia' e '100% digital'" },
  { key: "hide_status_strip", label: "Barra de status", description: "Etapa, Próximo, Início e validade" },
  { key: "hide_validity", label: "Data de validade", description: "Exibição da validade do orçamento" },
  { key: "hide_consultora", label: "Nome da consultora", description: "Exibição do nome da consultora comercial" },
];

export function HeaderConfigStep({ config, onChange }: HeaderConfigStepProps) {
  const toggle = (key: keyof HeaderConfig) => {
    onChange({ ...config, [key]: !config[key] });
  };

  const setText = (key: "custom_tagline" | "custom_subtitle", value: string) => {
    onChange({ ...config, [key]: value || undefined });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display text-lg font-bold text-foreground mb-1">
          Configuração do Cabeçalho
        </h3>
        <p className="text-sm text-muted-foreground font-body">
          Escolha quais elementos exibir ou ocultar no cabeçalho do orçamento público.
        </p>
      </div>

      {/* Visibility toggles */}
      <div className="space-y-1">
        {TOGGLES.map((item) => {
          const isHidden = !!config[item.key];
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => toggle(item.key)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left min-h-[48px]"
            >
              <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${isHidden ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'}`}>
                {isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <span className={`text-sm font-medium font-body block ${isHidden ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                  {item.label}
                </span>
                <span className="text-xs text-muted-foreground font-body">{item.description}</span>
              </div>
              <span className={`text-xs font-body px-2 py-0.5 rounded-full ${isHidden ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'}`}>
                {isHidden ? "Oculto" : "Visível"}
              </span>
            </button>
          );
        })}
      </div>

      {/* Custom text fields */}
      <div className="space-y-4 pt-2 border-t border-border">
        <div className="flex items-center gap-2 mb-2">
          <Type className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground font-body">Textos personalizados</span>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground font-body">Tagline (opcional)</label>
          <input
            type="text"
            value={config.custom_tagline || ""}
            onChange={(e) => setText("custom_tagline", e.target.value)}
            placeholder="Projeto personalizado · Gestão completa · Execução com garantia"
            className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm font-body placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground font-body">Subtítulo (opcional)</label>
          <input
            type="text"
            value={config.custom_subtitle || ""}
            onChange={(e) => setText("custom_subtitle", e.target.value)}
            placeholder="Orçamento personalizado para [cliente]"
            className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm font-body placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
          />
        </div>
      </div>
    </div>
  );
}
