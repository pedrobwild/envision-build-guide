import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Stethoscope,
  Copy,
  ShieldAlert,
  ShieldCheck,
  Info,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getPublicBudgetUrl } from "@/lib/getPublicUrl";
import { toast } from "sonner";
import { diagnoseBudgetRls, type RlsDiagnosticReport } from "@/lib/rls-diagnostics";

type StepStatus = "idle" | "running" | "ok" | "warn" | "fail" | "skipped";

interface StepResult {
  id: string;
  label: string;
  description: string;
  status: StepStatus;
  detail?: string;
  durationMs?: number;
  data?: Record<string, unknown>;
}

const INITIAL_STEPS: StepResult[] = [
  {
    id: "input",
    label: "Identificador informado",
    description: "Extrai o public_id da URL ou aceita o código direto.",
    status: "idle",
  },
  {
    id: "exists",
    label: "Orçamento existe no banco",
    description: "Procura por public_id na tabela budgets (sem filtros de status).",
    status: "idle",
  },
  {
    id: "rpc",
    label: "RPC pública get_public_budget",
    description: "Chama a RPC que alimenta a página /o/:publicId. Falha aqui = orçamento não publicado ou bloqueado por RLS.",
    status: "idle",
  },
  {
    id: "sections",
    label: "Carregamento de seções",
    description: "Lê as seções vinculadas (colunas públicas).",
    status: "idle",
  },
  {
    id: "items",
    label: "Carregamento de itens",
    description: "Lê os itens das seções encontradas.",
    status: "idle",
  },
  {
    id: "frontend",
    label: "Renderização do frontend",
    description: "Faz HEAD na URL pública para confirmar que o app carrega (HTTP 200).",
    status: "idle",
  },
  {
    id: "assets",
    label: "Bundle de assets",
    description: "Confirma que /index.html está acessível (sem erro de cache/CDN).",
    status: "idle",
  },
  {
    id: "rls",
    label: "Permissões de RLS (anônimo vs. você)",
    description:
      "Compara o que o cliente final (anônimo) enxerga com o que você enxerga logado. Recomendado quando a RPC/fetch falha.",
    status: "idle",
  },
];

function extractPublicId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  // Accept full URLs like https://.../o/abc123
  const match = trimmed.match(/\/o\/([A-Za-z0-9-]+)/);
  if (match?.[1]) return match[1];
  return trimmed;
}

function StatusIcon({ status }: { status: StepStatus }) {
  if (status === "running") return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  if (status === "ok") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (status === "warn") return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  if (status === "fail") return <XCircle className="h-4 w-4 text-destructive" />;
  if (status === "skipped") return <div className="h-4 w-4 rounded-full bg-muted" />;
  return <div className="h-4 w-4 rounded-full border border-border" />;
}

function statusBadge(status: StepStatus) {
  const map: Record<StepStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    idle: { label: "Pendente", variant: "outline" },
    running: { label: "Rodando…", variant: "secondary" },
    ok: { label: "OK", variant: "default" },
    warn: { label: "Atenção", variant: "secondary" },
    fail: { label: "Falhou", variant: "destructive" },
    skipped: { label: "Pulada", variant: "outline" },
  };
  const { label, variant } = map[status];
  return <Badge variant={variant}>{label}</Badge>;
}

export default function BudgetDiagnosticsPage() {
  useEffect(() => {
    document.title = "Diagnóstico do Orçamento · BWild";
  }, []);
  const [input, setInput] = useState("");
  const [steps, setSteps] = useState<StepResult[]>(INITIAL_STEPS);
  const [running, setRunning] = useState(false);
  const [resolvedId, setResolvedId] = useState<string>("");
  const [rlsReport, setRlsReport] = useState<RlsDiagnosticReport | null>(null);

  function updateStep(id: string, patch: Partial<StepResult>) {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  async function runDiagnostics() {
    const publicId = extractPublicId(input);
    setSteps(INITIAL_STEPS.map((s) => ({ ...s, status: "idle", detail: undefined, data: undefined, durationMs: undefined })));
    setResolvedId(publicId);
    setRlsReport(null);

    if (!publicId) {
      toast.error("Informe um public_id ou URL do orçamento.");
      return;
    }

    setRunning(true);

    // 1. input
    updateStep("input", {
      status: "ok",
      detail: `Identificador detectado: ${publicId}`,
    });

    // 2. exists in DB
    updateStep("exists", { status: "running" });
    const t1 = performance.now();
    const { data: dbRow, error: dbError } = await supabase
      .from("budgets")
      .select("id, public_id, status, internal_status, project_name, client_name, version_number, updated_at")
      .eq("public_id", publicId)
      .maybeSingle();
    const dbDur = Math.round(performance.now() - t1);

    if (dbError) {
      updateStep("exists", {
        status: "fail",
        detail: `Erro Supabase: ${dbError.message}`,
        durationMs: dbDur,
      });
      // Continue diagnostics — the row may still be visible via RPC
    } else if (!dbRow) {
      updateStep("exists", {
        status: "fail",
        detail: "Nenhum orçamento encontrado com esse public_id (pode ser permissão RLS ou ID inexistente).",
        durationMs: dbDur,
      });
    } else {
      const statusOk = dbRow.status === "published" || dbRow.status === "minuta_solicitada";
      updateStep("exists", {
        status: statusOk ? "ok" : "warn",
        detail: statusOk
          ? `Encontrado · status="${dbRow.status}"`
          : `Encontrado, mas status="${dbRow.status}" não é público. RPC vai retornar vazio.`,
        durationMs: dbDur,
        data: dbRow as unknown as Record<string, unknown>,
      });
    }

    // 3. RPC
    updateStep("rpc", { status: "running" });
    const t2 = performance.now();
    const { data: rpcData, error: rpcError } = await supabase.rpc("get_public_budget", {
      p_public_id: publicId,
    });
    const rpcDur = Math.round(performance.now() - t2);

    let budgetIdFromRpc: string | null = null;
    if (rpcError) {
      updateStep("rpc", {
        status: "fail",
        detail: `RPC falhou: ${rpcError.message}`,
        durationMs: rpcDur,
      });
    } else if (!rpcData) {
      updateStep("rpc", {
        status: "fail",
        detail: "RPC retornou null. Causa típica: status ≠ published/minuta_solicitada.",
        durationMs: rpcDur,
      });
    } else {
      const obj = rpcData as Record<string, unknown>;
      budgetIdFromRpc = (obj.id as string) ?? null;
      updateStep("rpc", {
        status: "ok",
        detail: `RPC respondeu OK · projeto="${obj.project_name ?? "?"}"`,
        durationMs: rpcDur,
        data: obj,
      });
    }

    const budgetId = budgetIdFromRpc ?? dbRow?.id ?? null;

    // 4. sections
    if (!budgetId) {
      updateStep("sections", { status: "skipped", detail: "Sem budget_id resolvido." });
      updateStep("items", { status: "skipped", detail: "Sem budget_id resolvido." });
    } else {
      updateStep("sections", { status: "running" });
      const t3 = performance.now();
      const { data: sections, error: secErr } = await supabase
        .from("sections")
        .select("id, title, order_index")
        .eq("budget_id", budgetId)
        .order("order_index");
      const secDur = Math.round(performance.now() - t3);

      if (secErr) {
        updateStep("sections", {
          status: "fail",
          detail: `Erro: ${secErr.message}`,
          durationMs: secDur,
        });
        updateStep("items", { status: "skipped", detail: "Falha ao ler seções." });
      } else {
        const count = sections?.length ?? 0;
        updateStep("sections", {
          status: count > 0 ? "ok" : "warn",
          detail: `${count} seção(ões) encontrada(s)`,
          durationMs: secDur,
        });

        // 5. items
        updateStep("items", { status: "running" });
        const sectionIds = (sections ?? []).map((s) => s.id);
        const t4 = performance.now();
        const { data: items, error: itemsErr } = await supabase
          .from("items")
          .select("id, section_id")
          .in("section_id", sectionIds.length ? sectionIds : ["__none__"]);
        const itemsDur = Math.round(performance.now() - t4);

        if (itemsErr) {
          updateStep("items", {
            status: "fail",
            detail: `Erro: ${itemsErr.message}`,
            durationMs: itemsDur,
          });
        } else {
          const itemCount = items?.length ?? 0;
          updateStep("items", {
            status: itemCount > 0 ? "ok" : "warn",
            detail: `${itemCount} item(ns) encontrado(s)`,
            durationMs: itemsDur,
          });
        }
      }
    }

    // 6. frontend HEAD
    const publicUrl = getPublicBudgetUrl(publicId);
    updateStep("frontend", { status: "running" });
    const t5 = performance.now();
    try {
      const res = await fetch(publicUrl, { method: "GET", mode: "no-cors", cache: "no-store" });
      const dur = Math.round(performance.now() - t5);
      // no-cors gives opaque response; success is "no network error"
      updateStep("frontend", {
        status: "ok",
        detail: `URL respondeu (modo opaco). Tipo: ${res.type}`,
        durationMs: dur,
      });
    } catch (err) {
      const dur = Math.round(performance.now() - t5);
      updateStep("frontend", {
        status: "fail",
        detail: `Falha de rede: ${(err as Error).message}`,
        durationMs: dur,
      });
    }

    // 7. assets (index.html)
    updateStep("assets", { status: "running" });
    const t6 = performance.now();
    try {
      const res = await fetch(`${new URL(publicUrl).origin}/index.html?t=${Date.now()}`, {
        method: "GET",
        mode: "no-cors",
        cache: "no-store",
      });
      const dur = Math.round(performance.now() - t6);
      updateStep("assets", {
        status: "ok",
        detail: `index.html acessível. Tipo: ${res.type}`,
        durationMs: dur,
      });
    } catch (err) {
      const dur = Math.round(performance.now() - t6);
      updateStep("assets", {
        status: "warn",
        detail: `HEAD falhou (provavelmente CORS, não bloqueia render real): ${(err as Error).message}`,
        durationMs: dur,
      });
    }

    // 8. RLS — sempre roda; útil tanto em sucesso quanto em falha,
    // mas o card de recomendações destaca apenas quando há divergência.
    updateStep("rls", { status: "running" });
    const t7 = performance.now();
    try {
      const report = await diagnoseBudgetRls(publicId);
      const dur = Math.round(performance.now() - t7);
      setRlsReport(report);
      const blockedAnon = report.checks.some(
        (c) => c.role === "anon" && (c.status === "blocked" || c.status === "error")
      );
      const criticalRecs = report.recommendations.filter((r) => r.severity === "critical").length;
      updateStep("rls", {
        status: criticalRecs > 0 ? "fail" : blockedAnon ? "warn" : "ok",
        detail:
          criticalRecs > 0
            ? `${criticalRecs} ajuste(s) crítico(s) recomendado(s) — veja "Recomendações de RLS" abaixo.`
            : blockedAnon
            ? "Há diferenças entre acesso anônimo e autenticado — veja recomendações."
            : "Permissões consistentes entre anônimo e autenticado.",
        durationMs: dur,
      });
    } catch (err) {
      const dur = Math.round(performance.now() - t7);
      updateStep("rls", {
        status: "fail",
        detail: `Falha ao executar diagnóstico de RLS: ${(err as Error).message}`,
        durationMs: dur,
      });
    }

    setRunning(false);
  }

  const summary = (() => {
    const fails = steps.filter((s) => s.status === "fail");
    const warns = steps.filter((s) => s.status === "warn");
    if (fails.length > 0) {
      return {
        tone: "fail" as const,
        title: `Falhou em ${fails.length} etapa(s)`,
        message: fails.map((f) => `• ${f.label}: ${f.detail ?? "—"}`).join("\n"),
      };
    }
    if (warns.length > 0) {
      return {
        tone: "warn" as const,
        title: `Concluído com ${warns.length} aviso(s)`,
        message: warns.map((w) => `• ${w.label}: ${w.detail ?? "—"}`).join("\n"),
      };
    }
    if (steps.every((s) => s.status === "ok" || s.status === "skipped")) {
      return {
        tone: "ok" as const,
        title: "Tudo certo",
        message: "Todas as etapas passaram. O orçamento deve abrir normalmente.",
      };
    }
    return null;
  })();

  const publicUrl = resolvedId ? getPublicBudgetUrl(resolvedId) : "";

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Stethoscope className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-display font-bold tracking-tight">Diagnóstico do Orçamento</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Cole a URL pública (ex.: <code className="text-xs bg-muted px-1 py-0.5 rounded">https://bwildengine.com/o/abc123</code>) ou apenas o public_id e
          identifique exatamente em qual etapa o carregamento falha.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identificador</CardTitle>
          <CardDescription>URL completa ou public_id (12 caracteres).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="public-id">URL ou public_id</Label>
            <Input
              id="public-id"
              placeholder="https://bwildengine.com/o/8ceb5d539faf"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !running) runDiagnostics();
              }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={runDiagnostics} disabled={running} className="gap-2">
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {running ? "Diagnosticando…" : "Rodar diagnóstico"}
            </Button>
            {publicUrl && (
              <>
                <Button variant="outline" asChild className="gap-2">
                  <a href={publicUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Abrir orçamento
                  </a>
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    navigator.clipboard.writeText(publicUrl);
                    toast.success("URL copiada");
                  }}
                >
                  <Copy className="h-4 w-4" />
                  Copiar URL
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {summary && (
        <Card
          className={
            summary.tone === "fail"
              ? "border-destructive/50 bg-destructive/5"
              : summary.tone === "warn"
              ? "border-amber-500/50 bg-amber-500/5"
              : "border-emerald-500/50 bg-emerald-500/5"
          }
        >
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <StatusIcon status={summary.tone === "ok" ? "ok" : summary.tone === "warn" ? "warn" : "fail"} />
              {summary.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs whitespace-pre-wrap font-body text-foreground/80">{summary.message}</pre>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Etapas</CardTitle>
          <CardDescription>Execução sequencial. Falha em uma etapa não interrompe as demais sempre que possível.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {steps.map((step, idx) => (
            <div key={step.id}>
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <StatusIcon status={step.status} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-sm font-medium">
                      {idx + 1}. {step.label}
                    </p>
                    <div className="flex items-center gap-2">
                      {typeof step.durationMs === "number" && (
                        <span className="text-[10px] text-muted-foreground tabular-nums">{step.durationMs}ms</span>
                      )}
                      {statusBadge(step.status)}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                  {step.detail && (
                    <p className="text-xs mt-1 text-foreground/80 break-words">
                      {step.detail}
                    </p>
                  )}
                  {step.data && (
                    <details className="mt-2">
                      <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                        Ver dados retornados
                      </summary>
                      <pre className="mt-2 text-[10px] bg-muted/50 p-2 rounded overflow-x-auto max-h-48">
                        {JSON.stringify(step.data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
              {idx < steps.length - 1 && <Separator className="my-3" />}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dicas rápidas</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p><strong className="text-foreground">RPC vazia:</strong> o orçamento provavelmente não está em <code className="text-xs">published</code> ou <code className="text-xs">minuta_solicitada</code>.</p>
          <p><strong className="text-foreground">Existe no banco mas não abre:</strong> verifique o status interno e republique pelo editor.</p>
          <p><strong className="text-foreground">Tudo OK aqui mas o cliente não vê:</strong> orientar refresh forçado (Ctrl+Shift+R) ou aba anônima — pode ser cache do navegador/extensão.</p>
        </CardContent>
      </Card>
    </div>
  );
}
