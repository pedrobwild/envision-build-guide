/**
 * Tooltips das badges de tempo no cabeçalho do negócio.
 *
 * Replica o builder de `title` usado em src/pages/BudgetInternalDetail.tsx
 * (linhas ~952-987) para validar que:
 *   - Com markers do backend, as datas exatas vêm da RPC `get_budget_time_markers`
 *     e a linha "Fonte: servidor" é exibida.
 *   - Com erro na RPC, cai em "Fonte: cálculo local — falha na RPC (...)".
 *   - Em loading (sem markers e sem erro), exibe "sincronizando com o servidor…".
 *   - Quando há `frozen_at`, a linha "Cronômetro pausado em ..." aparece em ambos os tooltips.
 */
import { describe, it, expect } from "vitest";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { BudgetTimeMarkers } from "@/hooks/useBudgetTimeMarkers";

interface BuildArgs {
  statusLabel: string;
  budgetCreatedAt: string | null;
  currentStageStart: Date | null;
  frozenEvent: { created_at: string } | null;
  timeMarkers: BudgetTimeMarkers | null;
  timeMarkersError: string | null;
}

function buildTooltips(args: BuildArgs) {
  const fmtDateTime = (d: Date) => format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  const sourceLabel = args.timeMarkers
    ? "Fonte: servidor (get_budget_time_markers)"
    : args.timeMarkersError
    ? `Fonte: cálculo local — falha na RPC (${args.timeMarkersError})`
    : "Fonte: cálculo local (sincronizando com o servidor…)";
  const createdAtIso = args.timeMarkers?.created_at ?? args.budgetCreatedAt;
  const stageStartIso = args.timeMarkers?.current_stage_start
    ?? (args.currentStageStart ? args.currentStageStart.toISOString() : null);
  const frozenAtIso = args.timeMarkers?.frozen_at
    ?? (args.frozenEvent ? args.frozenEvent.created_at : null);
  const createdLine = createdAtIso ? `Criado em ${fmtDateTime(new Date(createdAtIso))}` : null;
  const stageStartLine = stageStartIso
    ? `Etapa "${args.statusLabel}" iniciada em ${fmtDateTime(new Date(stageStartIso))}`
    : null;
  const frozenLine = frozenAtIso
    ? `Cronômetro pausado em ${fmtDateTime(new Date(frozenAtIso))} (entrada em "${args.statusLabel}")`
    : null;
  const totalTitle = [
    "Tempo total desde a criação do negócio.",
    createdLine,
    frozenLine,
    sourceLabel,
  ].filter(Boolean).join("\n");
  const stageTitle = [
    `Tempo na etapa atual ("${args.statusLabel}").`,
    stageStartLine,
    frozenLine,
    sourceLabel,
  ].filter(Boolean).join("\n");
  return { totalTitle, stageTitle };
}

const BACKEND_CREATED = "2026-04-01T10:30:00Z";
const BACKEND_STAGE = "2026-05-02T08:15:00Z";
const BACKEND_FROZEN = "2026-05-03T17:45:00Z";
const LOCAL_CREATED = "2026-04-15T09:00:00Z";

const fmt = (iso: string) =>
  format(new Date(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

describe("Header tooltip dates — backend markers vs fallback", () => {
  it("usa as datas exatas dos markers do backend e marca a fonte como servidor", () => {
    const markers: BudgetTimeMarkers = {
      budget_id: "b1",
      internal_status: "in_progress",
      created_at: BACKEND_CREATED,
      current_stage_start: BACKEND_STAGE,
      frozen_at: null,
      is_frozen: false,
      reference_at: "2026-05-04T12:00:00Z",
    };
    const { totalTitle, stageTitle } = buildTooltips({
      statusLabel: "Em produção",
      budgetCreatedAt: LOCAL_CREATED, // intencionalmente diferente — markers prevalecem
      currentStageStart: new Date("2026-04-20T00:00:00Z"),
      frozenEvent: null,
      timeMarkers: markers,
      timeMarkersError: null,
    });

    expect(totalTitle).toContain(`Criado em ${fmt(BACKEND_CREATED)}`);
    expect(totalTitle).toContain("Fonte: servidor (get_budget_time_markers)");
    expect(totalTitle).not.toContain("cálculo local");
    expect(totalTitle).not.toContain("Cronômetro pausado");

    expect(stageTitle).toContain(`Etapa "Em produção" iniciada em ${fmt(BACKEND_STAGE)}`);
    expect(stageTitle).toContain("Fonte: servidor (get_budget_time_markers)");
    // Não vaza o stageStart local divergente.
    expect(stageTitle).not.toContain(fmt("2026-04-20T00:00:00Z"));
  });

  it("inclui linha de congelamento quando markers trazem frozen_at", () => {
    const markers: BudgetTimeMarkers = {
      budget_id: "b1",
      internal_status: "contrato_fechado",
      created_at: BACKEND_CREATED,
      current_stage_start: BACKEND_FROZEN,
      frozen_at: BACKEND_FROZEN,
      is_frozen: true,
      reference_at: BACKEND_FROZEN,
    };
    const { totalTitle, stageTitle } = buildTooltips({
      statusLabel: "Contrato Fechado",
      budgetCreatedAt: BACKEND_CREATED,
      currentStageStart: new Date(BACKEND_FROZEN),
      frozenEvent: { created_at: BACKEND_FROZEN },
      timeMarkers: markers,
      timeMarkersError: null,
    });

    const expectedFrozen = `Cronômetro pausado em ${fmt(BACKEND_FROZEN)} (entrada em "Contrato Fechado")`;
    expect(totalTitle).toContain(expectedFrozen);
    expect(stageTitle).toContain(expectedFrozen);
    expect(totalTitle).toContain("Fonte: servidor (get_budget_time_markers)");
  });

  it("indica erro de RPC e usa as datas locais quando markers ausentes", () => {
    const { totalTitle, stageTitle } = buildTooltips({
      statusLabel: "Em produção",
      budgetCreatedAt: LOCAL_CREATED,
      currentStageStart: new Date("2026-04-20T00:00:00Z"),
      frozenEvent: null,
      timeMarkers: null,
      timeMarkersError: "rpc unavailable",
    });
    expect(totalTitle).toContain(`Criado em ${fmt(LOCAL_CREATED)}`);
    expect(totalTitle).toContain("Fonte: cálculo local — falha na RPC (rpc unavailable)");
    expect(stageTitle).toContain(`Etapa "Em produção" iniciada em ${fmt("2026-04-20T00:00:00Z")}`);
    expect(stageTitle).toContain("Fonte: cálculo local — falha na RPC (rpc unavailable)");
  });

  it("mostra fallback de loading quando não há markers nem erro", () => {
    const { totalTitle, stageTitle } = buildTooltips({
      statusLabel: "Novo",
      budgetCreatedAt: LOCAL_CREATED,
      currentStageStart: new Date(LOCAL_CREATED),
      frozenEvent: null,
      timeMarkers: null,
      timeMarkersError: null,
    });
    expect(totalTitle).toContain("Fonte: cálculo local (sincronizando com o servidor…)");
    expect(stageTitle).toContain("Fonte: cálculo local (sincronizando com o servidor…)");
    expect(totalTitle).not.toContain("falha na RPC");
  });

  it("omite a linha de congelamento quando não há frozen_at em nenhuma fonte", () => {
    const { totalTitle, stageTitle } = buildTooltips({
      statusLabel: "Em produção",
      budgetCreatedAt: LOCAL_CREATED,
      currentStageStart: new Date(LOCAL_CREATED),
      frozenEvent: null,
      timeMarkers: null,
      timeMarkersError: null,
    });
    expect(totalTitle).not.toContain("Cronômetro pausado");
    expect(stageTitle).not.toContain("Cronômetro pausado");
  });
});
