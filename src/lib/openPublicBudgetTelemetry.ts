/**
 * Telemetria estruturada do fluxo de abertura de orçamento público.
 *
 * Por que existe: o botão "Visualizar" do card pode falhar de várias formas
 * silenciosas (popup blocker, RPC vazia, RLS, draft órfão). Sem trilha, fica
 * impossível diagnosticar quando o usuário relata "não abriu". Este módulo
 * centraliza o registro de cada decisão importante e expõe o último diagnóstico
 * tanto via console quanto via `window.__openBudgetDiag` para inspeção manual.
 *
 * Não envia para servidor — fica só no console + window — porque os dados
 * incluem public_ids e queremos zero overhead em prod. Se quisermos exportar
 * depois, basta plugar um sink em `attachOpenBudgetSink`.
 */

import { logger } from "./logger";

export type OpenBudgetOutcome =
  | "opened_direct"          // status já publicado, abriu sem precisar resolver
  | "opened_via_rpc"         // RPC resolveu para versão publicada
  | "opened_via_fallback"    // camada 2 (consulta tabela) achou vencedora
  | "opened_after_publish"   // auto-publicou e abriu
  | "opened_original"        // catch geral: navegou no public_id original
  | "blocked_no_public_id"   // chamada com publicId vazio
  | "blocked_no_published"   // nenhuma versão publicada disponível
  | "blocked_rpc_error"      // RPC retornou erro e fallback também falhou
  | "blocked_publish_error"; // tentou auto-publicar mas update falhou

export interface OpenBudgetStep {
  ts: number;
  step: string;
  detail?: Record<string, unknown>;
}

export interface OpenBudgetDiagnosis {
  /** UUID v4 único desta tentativa de abertura. Aparece no toast, no console e na tabela `open_budget_telemetry.event_id` no servidor. */
  correlationId: string;
  /** UUID v4 da sessão de navegação (persistido em sessionStorage). Agrupa todas as tentativas de uma mesma aba — `open_budget_telemetry.correlation_id`. */
  sessionId: string;
  startedAt: number;
  durationMs: number;
  source: "by_public_id" | "by_budget_ref";
  inputPublicId: string | null;
  inputStatus: string | null;
  inputBudgetId: string | null;
  popupBlocked: boolean;
  resolvedPublicId: string | null;
  resolvedFrom: "rpc" | "fallback" | "direct" | "original" | null;
  outcome: OpenBudgetOutcome;
  errorMessage: string | null;
  steps: OpenBudgetStep[];
}

const SESSION_KEY = "__open_budget_correlation_id";

function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getSessionId(): string {
  if (typeof sessionStorage === "undefined") return uuid();
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = uuid();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return uuid();
  }
}

type Sink = (diag: OpenBudgetDiagnosis) => void;
const sinks: Sink[] = [];

/** Plug a custom sink (e.g., remote logger) — invoked after each open attempt. */
export function attachOpenBudgetSink(sink: Sink): () => void {
  sinks.push(sink);
  return () => {
    const i = sinks.indexOf(sink);
    if (i >= 0) sinks.splice(i, 1);
  };
}

/** Builder mutável usado durante o fluxo; chamadores commit() ao terminar. */
export class OpenBudgetTrace {
  private diag: OpenBudgetDiagnosis;

  constructor(source: OpenBudgetDiagnosis["source"], inputPublicId: string | null, inputBudgetId: string | null = null, inputStatus: string | null = null) {
    this.diag = {
      startedAt: Date.now(),
      durationMs: 0,
      source,
      inputPublicId,
      inputStatus,
      inputBudgetId,
      popupBlocked: false,
      resolvedPublicId: null,
      resolvedFrom: null,
      outcome: "opened_original",
      errorMessage: null,
      steps: [],
    };
  }

  step(step: string, detail?: Record<string, unknown>) {
    this.diag.steps.push({ ts: Date.now() - this.diag.startedAt, step, detail });
  }

  setPopupBlocked(blocked: boolean) {
    this.diag.popupBlocked = blocked;
    this.step("popup_status", { blocked });
  }

  setResolved(publicId: string | null, from: OpenBudgetDiagnosis["resolvedFrom"]) {
    this.diag.resolvedPublicId = publicId;
    this.diag.resolvedFrom = from;
    this.step("resolved", { publicId, from });
  }

  setError(message: string) {
    this.diag.errorMessage = message;
    this.step("error", { message });
  }

  commit(outcome: OpenBudgetOutcome): OpenBudgetDiagnosis {
    this.diag.outcome = outcome;
    this.diag.durationMs = Date.now() - this.diag.startedAt;
    this.step("commit", { outcome });

    // Expõe o último diagnóstico no window para inspeção manual no console.
    if (typeof window !== "undefined") {
      (window as unknown as { __openBudgetDiag?: OpenBudgetDiagnosis }).__openBudgetDiag = this.diag;
    }

    // Log estruturado: erros e bloqueios viram error/warn; sucessos ficam em debug.
    const isFailure = outcome.startsWith("blocked_");
    if (isFailure) {
      logger.error("[openPublicBudget] FALHOU", this.diag);
    } else if (this.diag.popupBlocked) {
      logger.warn("[openPublicBudget] popup blocker detectado", this.diag);
    } else {
      logger.debug("[openPublicBudget] ok", { outcome, durationMs: this.diag.durationMs, resolvedPublicId: this.diag.resolvedPublicId });
    }

    sinks.forEach((s) => { try { s(this.diag); } catch { /* sink não pode quebrar fluxo */ } });
    return this.diag;
  }

  /** Resumo curto e legível para mostrar em toast/alert. */
  summary(): string {
    const d = this.diag;
    const parts = [
      `outcome=${d.outcome}`,
      d.popupBlocked && "popup_blocked",
      d.resolvedPublicId && `→ ${d.resolvedPublicId}`,
      d.resolvedFrom && `(via ${d.resolvedFrom})`,
      d.errorMessage && `err: ${d.errorMessage}`,
    ].filter(Boolean);
    return parts.join(" · ");
  }
}
