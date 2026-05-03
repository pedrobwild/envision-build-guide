/**
 * Garante que cliques na Home Comercial (que constroem URLs como
 * `/admin/comercial?stage=action_needed` ou `?fila=sem-vis`) sejam
 * resolvidos no estado correto do dashboard — sem cair na "primeira etapa"
 * por engano.
 */

import { describe, it, expect } from "vitest";
import {
  parseDashboardSearch,
  serializeDashboardFilters,
  STAGE_TO_FILTER,
} from "../commercial-dashboard-url";

describe("parseDashboardSearch — defaults", () => {
  it("retorna estado neutro quando a URL está vazia", () => {
    expect(parseDashboardSearch("")).toEqual({
      queueFilter: null,
      statusFilter: "all",
      dueFilter: "all",
      sortBy: "recente",
      viewMode: "kanban",
      search: "",
      commercialFilter: "all",
      pipelineFilter: "all",
    });
  });

  it("ignora valores inválidos em vez de quebrar a tela", () => {
    const r = parseDashboardSearch("?status=hack&due=xxx&sort=foo&view=bar");
    expect(r.statusFilter).toBe("all");
    expect(r.dueFilter).toBe("all");
    expect(r.sortBy).toBe("recente");
    expect(r.viewMode).toBe("kanban");
  });
});

describe("parseDashboardSearch — stage da Home Comercial", () => {
  // Cada stage deve mapear para o status/due correto e forçar viewMode=list,
  // para que o usuário NÃO caia na "primeira etapa" do Kanban.
  const cases = Object.entries(STAGE_TO_FILTER);

  it.each(cases)("stage=%s aplica filtros corretos e força lista", (stage, target) => {
    const r = parseDashboardSearch(`?stage=${stage}`);
    expect(r.viewMode).toBe("list");
    expect(r.queueFilter).toBeNull();
    expect(r.statusFilter).toBe(target.status ?? "all");
    expect(r.dueFilter).toBe(target.due ?? "all");
  });

  it("stage desconhecido cai em estado neutro mas ainda força lista", () => {
    const r = parseDashboardSearch("?stage=foo_bar");
    expect(r.statusFilter).toBe("all");
    expect(r.viewMode).toBe("list"); // stage presente força lista
  });
});

describe("parseDashboardSearch — fila", () => {
  it.each(["prontos", "sem-vis", "esfriando"] as const)(
    "fila=%s ativa queueFilter, força lista e zera status/due",
    (fila) => {
      const r = parseDashboardSearch(`?fila=${fila}&status=enviado&due=overdue`);
      expect(r.queueFilter).toBe(fila);
      expect(r.statusFilter).toBe("all");
      expect(r.dueFilter).toBe("all");
      expect(r.viewMode).toBe("list");
    },
  );

  it("fila inválida é ignorada", () => {
    const r = parseDashboardSearch("?fila=invalida");
    expect(r.queueFilter).toBeNull();
  });
});

describe("parseDashboardSearch — status direto (DualFunnel)", () => {
  it("aceita chave de PIPELINE_SECTIONS", () => {
    const r = parseDashboardSearch("?status=enviado");
    expect(r.statusFilter).toBe("enviado");
  });
});

describe("serialize ⇄ parse roundtrip", () => {
  it("preserva o mesmo estado após reload", () => {
    const state = {
      queueFilter: null as null,
      statusFilter: "enviado",
      dueFilter: "overdue" as const,
      sortBy: "urgente" as const,
      viewMode: "list" as const,
      search: "joão",
      commercialFilter: "uid-123",
      pipelineFilter: "indicacao",
    };
    const qs = serializeDashboardFilters(state);
    const back = parseDashboardSearch(`?${qs}`);
    expect(back.statusFilter).toBe(state.statusFilter);
    expect(back.dueFilter).toBe(state.dueFilter);
    expect(back.sortBy).toBe(state.sortBy);
    expect(back.viewMode).toBe(state.viewMode);
    expect(back.search).toBe(state.search);
    expect(back.commercialFilter).toBe(state.commercialFilter);
    expect(back.pipelineFilter).toBe(state.pipelineFilter);
  });

  it("omite defaults na querystring (URL limpa)", () => {
    const qs = serializeDashboardFilters({
      queueFilter: null,
      statusFilter: "all",
      dueFilter: "all",
      sortBy: "recente",
      viewMode: "kanban",
      search: "",
      commercialFilter: "all",
      pipelineFilter: "all",
    });
    expect(qs).toBe("");
  });

  it("fila tem precedência sobre status/due na serialização", () => {
    const qs = serializeDashboardFilters({
      queueFilter: "sem-vis",
      statusFilter: "enviado",
      dueFilter: "overdue",
      sortBy: "recente",
      viewMode: "list",
      search: "",
      commercialFilter: "all",
      pipelineFilter: "all",
    });
    const params = new URLSearchParams(qs);
    expect(params.get("fila")).toBe("sem-vis");
    expect(params.get("status")).toBeNull();
    expect(params.get("due")).toBeNull();
  });
});
