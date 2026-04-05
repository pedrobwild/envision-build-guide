import { useState, lazy, Suspense } from "react";
import {
  Trash2,
  Activity,
  Sparkles,
  BookOpen,
  History,
  Lightbulb,
  Loader2,
  ExternalLink,
  RefreshCw,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import IntegrationSyncPanel from "@/components/admin/IntegrationSyncPanel";
import AiSyncInsightsPanel from "@/components/admin/AiSyncInsightsPanel";

type SearchMode = "ux" | "references" | "benchmarking";

interface ToolCard {
  id: string;
  icon: React.ElementType;
  iconBg: string;
  title: string;
  description: string;
  buttonLabel: string;
  mode?: SearchMode;
  defaultQuery?: string;
  action?: "cleanup" | "health" | "audit";
}

const PORTAL_AREAS = [
  { value: "orcamento_publico", label: "Orçamento Público", description: "Página do cliente, escopo, preços, simulador" },
  { value: "editor_orcamento", label: "Editor de Orçamento", description: "Importação, seções, itens, publicação" },
  { value: "dashboard_admin", label: "Dashboard Administrativo", description: "KPIs, atalhos, listagem de orçamentos" },
  { value: "pipeline_comercial", label: "Pipeline Comercial", description: "Kanban, demandas, solicitações" },
  { value: "catalogo", label: "Catálogo", description: "Itens, categorias, fornecedores, preços" },
  { value: "gestao_usuarios", label: "Gestão de Usuários", description: "Papéis, permissões, ativação" },
  { value: "workspace_producao", label: "Workspace de Produção", description: "Briefing, timeline, comentários" },
  { value: "navegacao_geral", label: "Navegação Geral", description: "Header, menus, rotas, mobile" },
  { value: "financeiro", label: "Financeiro", description: "Histórico, margens, ajustes" },
];

const TOOL_CARDS: ToolCard[] = [
  {
    id: "cleanup",
    icon: Trash2,
    iconBg: "bg-muted",
    title: "Limpeza de Arquivos",
    description:
      "Remove fisicamente arquivos expirados ou deletados há mais de 7 dias do armazenamento. Esta operação é executada automaticamente por cron, mas pode ser disparada manualmente.",
    buttonLabel: "Executar Limpeza Agora",
    action: "cleanup",
  },
  {
    id: "health",
    icon: Activity,
    iconBg: "bg-green-100 dark:bg-green-900/30",
    title: "Health & Diagnostics",
    description: "Status do sistema, latência e ferramentas de debug",
    buttonLabel: "Ver Status",
    action: "health",
  },
  {
    id: "ux",
    icon: Sparkles,
    iconBg: "bg-purple-100 dark:bg-purple-900/30",
    title: "UX Insights com IA",
    description: "Sugestões de melhorias de hierarquia, copy e UX",
    buttonLabel: "Gerar Insights",
    mode: "ux",
    defaultQuery:
      "Analise as melhores práticas de UX para um sistema de orçamentos de reformas residenciais. Sugira melhorias para: navegação, apresentação de valores, fluxo de aprovação do cliente e experiência mobile.",
  },
  {
    id: "references",
    icon: BookOpen,
    iconBg: "bg-blue-100 dark:bg-blue-900/30",
    title: "Pesquisa de Referências",
    description: "Pesquise funcionalidades de softwares de gestão de obras com IA",
    buttonLabel: "Pesquisar",
    mode: "references",
    defaultQuery:
      "Quais são as funcionalidades mais inovadoras dos principais softwares de gestão de obras e reformas em 2026? Inclua tendências de IA, automação e experiência do cliente.",
  },
  {
    id: "audit",
    icon: History,
    iconBg: "bg-orange-100 dark:bg-orange-900/30",
    title: "Auditoria do Sistema",
    description: "Visualize todas as alterações do sistema",
    buttonLabel: "Ver Registros",
    action: "audit",
  },
  {
    id: "benchmarking",
    icon: Lightbulb,
    iconBg: "bg-amber-100 dark:bg-amber-900/30",
    title: "Sugestões de Funcionalidades",
    description:
      "Benchmarking de softwares de gestão de obras para identificar oportunidades de diferenciação e novas funcionalidades",
    buttonLabel: "Gerar Sugestões",
    mode: "benchmarking",
    defaultQuery:
      "Faça um benchmarking detalhado dos principais softwares de gestão de obras (Houzz Pro, Buildertrend, CoConstruct, Procore, Veja Obra, Obra Prima, Sienge). Liste as funcionalidades mais relevantes que um sistema de orçamentos de reformas residenciais deveria ter, organizando por: 1) Experiência do Cliente, 2) Gestão Financeira, 3) Automação e IA, 4) Comunicação, 5) Relatórios e Analytics. Destaque oportunidades de diferenciação.",
  },
];

export default function SystemToolsPage() {
  const [activeDialog, setActiveDialog] = useState<ToolCard | null>(null);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState("");
  const [citations, setCitations] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedArea, setSelectedArea] = useState("");
  const [uxContext, setUxContext] = useState("");
  const [uxResult, setUxResult] = useState("");
  const [uxLoading, setUxLoading] = useState(false);
  const [showUxPanel, setShowUxPanel] = useState(false);
  const [benchArea, setBenchArea] = useState("");
  const [benchContext, setBenchContext] = useState("");
  const [benchResult, setBenchResult] = useState("");
  const [benchLoading, setBenchLoading] = useState(false);
  const [showBenchPanel, setShowBenchPanel] = useState(false);
  const { toast } = useToast();

  const handleOpenTool = (card: ToolCard) => {
    if (card.action) {
      toast({
        title: "Em breve",
        description: `A funcionalidade "${card.title}" será implementada em breve.`,
      });
      return;
    }
    if (card.mode === "ux") {
      setShowUxPanel(true);
      setSelectedArea("");
      setUxContext("");
      setUxResult("");
      return;
    }
    if (card.mode === "benchmarking") {
      setShowBenchPanel(true);
      setBenchArea("");
      setBenchContext("");
      setBenchResult("");
      return;
    }
    setActiveDialog(card);
    setQuery(card.defaultQuery ?? "");
    setResult("");
    setCitations([]);
  };

  const handleSearch = async () => {
    if (!activeDialog?.mode || !query.trim()) return;
    setLoading(true);
    setResult("");
    setCitations([]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Erro", description: "Sessão expirada. Faça login novamente.", variant: "destructive" });
        return;
      }

      const res = await supabase.functions.invoke("perplexity-search", {
        body: { query: query.trim(), mode: activeDialog.mode },
      });

      if (res.error) {
        throw new Error(res.error.message || "Erro na busca");
      }

      setResult(res.data?.content ?? "Sem resultados.");
      setCitations(res.data?.citations ?? []);
    } catch (err: unknown) {
      console.error(err);
      toast({
        title: "Erro na pesquisa",
        description: (err instanceof Error ? err.message : null) || "Não foi possível completar a pesquisa.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUxSearch = async () => {
    if (!selectedArea) return;
    setUxLoading(true);
    setUxResult("");

    try {
      const res = await supabase.functions.invoke("ux-insights", {
        body: { area: selectedArea, context: uxContext.trim() || undefined },
      });

      if (res.error) throw new Error(res.error.message || "Erro na análise");
      setUxResult(res.data?.content ?? "Sem resultados.");
    } catch (err: unknown) {
      console.error(err);
      toast({
        title: "Erro na análise",
        description: err.message || "Não foi possível gerar as sugestões.",
        variant: "destructive",
      });
    } finally {
      setUxLoading(false);
    }
  };

  const handleBenchSearch = async () => {
    if (!benchArea) return;
    setBenchLoading(true);
    setBenchResult("");

    try {
      const res = await supabase.functions.invoke("feature-suggestions", {
        body: { area: benchArea, context: benchContext.trim() || undefined },
      });

      if (res.error) throw new Error(res.error.message || "Erro na análise");
      setBenchResult(res.data?.content ?? "Sem resultados.");
    } catch (err: unknown) {
      console.error(err);
      toast({
        title: "Erro na análise",
        description: err.message || "Não foi possível gerar as sugestões.",
        variant: "destructive",
      });
    } finally {
      setBenchLoading(false);
    }
  };

  const handleCopyResult = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!", description: "Resultado copiado para a área de transferência." });
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Sistema</h1>
        <p className="text-sm text-muted-foreground font-body">
          Ferramentas de manutenção, diagnóstico e pesquisa com IA
        </p>
      </div>

      {/* Cleanup card — full width like reference */}
      <Card className="border bg-card">
        <CardContent className="p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className={`${TOOL_CARDS[0].iconBg} p-2.5 rounded-lg`}>
              <Trash2 className="h-5 w-5 text-foreground/70" />
            </div>
            <div>
              <h2 className="text-lg font-display font-semibold text-foreground">
                {TOOL_CARDS[0].title}
              </h2>
              <p className="text-sm text-muted-foreground font-body mt-1">
                {TOOL_CARDS[0].description}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => handleOpenTool(TOOL_CARDS[0])}
          >
            <Trash2 className="h-4 w-4" />
            {TOOL_CARDS[0].buttonLabel}
          </Button>
        </CardContent>
      </Card>

      <IntegrationSyncPanel />

      {/* AI Sync Monitor */}
      <AiSyncInsightsPanel />

      {/* Remaining cards */}
      <div className="space-y-3">
        {TOOL_CARDS.slice(1).map((card) => (
          <Card key={card.id} className="border bg-card">
            <CardContent className="p-4 sm:p-5 flex items-center gap-4">
              <div className={`${card.iconBg} p-2.5 rounded-full shrink-0`}>
                <card.icon className="h-5 w-5 text-foreground/70" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-semibold text-foreground text-sm">
                  {card.title}
                </h3>
                <p className="text-xs text-muted-foreground font-body mt-0.5">
                  {card.description}
                </p>
              </div>
              <Button
                variant={card.id === "audit" ? "default" : "outline"}
                size="sm"
                className="shrink-0"
                onClick={() => handleOpenTool(card)}
              >
                {card.buttonLabel}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* UX Insights Panel */}
      {showUxPanel && (
        <Card className="border bg-card">
          <CardContent className="p-6 space-y-5">
            <div className="flex items-start gap-3">
              <div className="bg-purple-100 dark:bg-purple-900/30 p-2.5 rounded-lg">
                <Sparkles className="h-5 w-5 text-foreground/70" />
              </div>
              <div>
                <h2 className="text-lg font-display font-semibold text-foreground">Configurar Análise</h2>
                <p className="text-sm text-muted-foreground font-body mt-1">
                  Selecione a área do sistema e adicione contexto opcional para sugestões mais direcionadas.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">Área do Sistema</label>
              <Select value={selectedArea} onValueChange={setSelectedArea}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione uma área..." />
                </SelectTrigger>
                <SelectContent>
                  {PORTAL_AREAS.map((area) => (
                    <SelectItem key={area.value} value={area.value}>
                      <div className="flex flex-col">
                        <span className="font-medium">{area.label}</span>
                        <span className="text-xs text-muted-foreground">{area.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Contexto adicional (opcional)</label>
              <Textarea
                value={uxContext}
                onChange={(e) => setUxContext(e.target.value)}
                placeholder="Ex: Os clientes estão tendo dificuldade para encontrar o simulador de parcelas..."
                rows={3}
                className="font-body text-sm resize-none"
              />
            </div>

            <Button
              onClick={handleUxSearch}
              disabled={uxLoading || !selectedArea}
              className="gap-2"
            >
              {uxLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {uxLoading ? "Analisando..." : "Gerar Sugestões"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* UX Results */}
      {uxResult && (
        <Card className="border bg-card animate-in fade-in">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-display font-semibold text-foreground">Sugestões de UX</h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleUxSearch} disabled={uxLoading} className="gap-1.5">
                  <RefreshCw className={`h-3.5 w-3.5 ${uxLoading ? "animate-spin" : ""}`} />
                  Regenerar
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleCopyResult(uxResult)} className="gap-1.5">
                  <Copy className="h-3.5 w-3.5" />
                  Copiar
                </Button>
              </div>
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none font-body">
              <ReactMarkdown>{uxResult}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Benchmarking Panel */}
      {showBenchPanel && (
        <Card className="border bg-card animate-in fade-in">
          <CardContent className="p-6 space-y-5">
            <div className="flex items-start gap-3">
              <div className="bg-amber-100 dark:bg-amber-900/30 p-2.5 rounded-lg">
                <Lightbulb className="h-5 w-5 text-foreground/70" />
              </div>
              <div>
                <h2 className="text-lg font-display font-semibold text-foreground">Configurar Benchmarking</h2>
                <p className="text-sm text-muted-foreground font-body mt-1">
                  Selecione a área do sistema para receber sugestões de funcionalidades baseadas em concorrentes reais.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">Área do Sistema</label>
              <Select value={benchArea} onValueChange={setBenchArea}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione uma área..." />
                </SelectTrigger>
                <SelectContent>
                  {PORTAL_AREAS.map((area) => (
                    <SelectItem key={area.value} value={area.value}>
                      <div className="flex flex-col">
                        <span className="font-medium">{area.label}</span>
                        <span className="text-xs text-muted-foreground">{area.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Contexto adicional (opcional)</label>
              <Textarea
                value={benchContext}
                onChange={(e) => setBenchContext(e.target.value)}
                placeholder="Ex: Precisamos de funcionalidades de comunicação com o cliente em tempo real..."
                rows={3}
                className="font-body text-sm resize-none"
              />
            </div>

            <Button
              onClick={handleBenchSearch}
              disabled={benchLoading || !benchArea}
              className="gap-2"
            >
              {benchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lightbulb className="h-4 w-4" />}
              {benchLoading ? "Pesquisando concorrentes..." : "Gerar Sugestões"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Benchmarking Results */}
      {benchResult && (
        <Card className="border bg-card animate-in fade-in">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-display font-semibold text-foreground">Sugestões de Funcionalidades</h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleBenchSearch} disabled={benchLoading} className="gap-1.5">
                  <RefreshCw className={`h-3.5 w-3.5 ${benchLoading ? "animate-spin" : ""}`} />
                  Regenerar
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleCopyResult(benchResult)} className="gap-1.5">
                  <Copy className="h-3.5 w-3.5" />
                  Copiar
                </Button>
              </div>
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none font-body">
              <ReactMarkdown>{benchResult}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog for AI-powered tools */}
      <Dialog open={!!activeDialog && !!activeDialog.mode} onOpenChange={(open) => !open && setActiveDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              {activeDialog && <activeDialog.icon className="h-5 w-5" />}
              {activeDialog?.title}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            <div className="space-y-2">
              <Textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Digite sua pesquisa..."
                rows={3}
                className="font-body text-sm resize-none"
              />
              <Button
                onClick={handleSearch}
                disabled={loading || !query.trim()}
                className="gap-2"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {loading ? "Pesquisando..." : "Pesquisar com IA"}
              </Button>
            </div>

            {result && (
              <ScrollArea className="flex-1 min-h-0">
                <div className="prose prose-sm dark:prose-invert max-w-none font-body">
                  <ReactMarkdown>{result}</ReactMarkdown>
                </div>
                {citations.length > 0 && (
                  <div className="mt-4 pt-3 border-t">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Fontes:</p>
                    <div className="space-y-1">
                      {citations.map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-primary hover:underline truncate"
                        >
                          <ExternalLink className="h-3 w-3 shrink-0" />
                          {url}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </ScrollArea>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
