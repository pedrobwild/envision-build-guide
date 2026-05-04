/**
 * Testa transições de internal_status no cabeçalho:
 *  1) markers do backend acompanham a mudança de status sem mostrar dados
 *     antigos (ex.: "etapa há X dias" da etapa anterior);
 *  2) durante a janela em que o backend ainda não respondeu (markers=null),
 *     o cálculo local assume coerentemente, sem quebra visual;
 *  3) ao receber novos markers, a UI volta a refletir a fonte do servidor.
 *
 * Espelha o padrão de seleção usado em `src/pages/BudgetInternalDetail.tsx`
 * num componente leve para isolar a regra de fonte de verdade.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  computeBudgetTime,
  budgetTimeFromMarkers,
  type StatusChangeEvent,
} from "@/lib/budget-time-in-stage";
import type { BudgetTimeMarkers } from "@/hooks/useBudgetTimeMarkers";

function HeaderTimeBadges(props: {
  internalStatus: string;
  createdAt: string;
  events: StatusChangeEvent[];
  markers: BudgetTimeMarkers | null;
  now?: Date;
}) {
  const { totalDaysOpen, daysInStage, isFrozen } = props.markers
    ? budgetTimeFromMarkers(props.markers, props.now)
    : computeBudgetTime({
        internalStatus: props.internalStatus,
        createdAt: props.createdAt,
        events: props.events,
        now: props.now,
      });
  return (
    <div>
      <span data-testid="status">{props.internalStatus}</span>
      <span data-testid="total">{totalDaysOpen}</span>
      <span data-testid="stage">{daysInStage}</span>
      <span data-testid="frozen">{isFrozen ? "yes" : "no"}</span>
      <span data-testid="source">{props.markers ? "backend" : "local"}</span>
    </div>
  );
}

const NOW = new Date("2026-05-04T12:00:00Z");
const daysAgoIso = (n: number) => {
  const d = new Date(NOW);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
};

const makeMarkers = (over: Partial<BudgetTimeMarkers>): BudgetTimeMarkers => ({
  budget_id: "b1",
  internal_status: "novo",
  created_at: daysAgoIso(20),
  current_stage_start: daysAgoIso(20),
  frozen_at: null,
  is_frozen: false,
  reference_at: NOW.toISOString(),
  ...over,
});

describe("Header time badges — transições de internal_status", () => {
  it("ao mudar de 'novo' para 'in_progress', usa o novo current_stage_start dos markers (sem dados da etapa anterior)", () => {
    // Estado inicial: status novo há 20 dias.
    const initialMarkers = makeMarkers({
      internal_status: "novo",
      current_stage_start: daysAgoIso(20),
    });
    const { rerender } = render(
      <HeaderTimeBadges
        internalStatus="novo"
        createdAt={daysAgoIso(20)}
        events={[]}
        markers={initialMarkers}
        now={NOW}
      />,
    );
    expect(screen.getByTestId("stage").textContent).toBe("20");
    expect(screen.getByTestId("total").textContent).toBe("20");

    // Transição: status muda para in_progress há 1 dia. Backend já respondeu
    // com novos markers. Total continua 20 (criação), etapa volta para 1.
    const newMarkers = makeMarkers({
      internal_status: "in_progress",
      current_stage_start: daysAgoIso(1),
    });
    rerender(
      <HeaderTimeBadges
        internalStatus="in_progress"
        createdAt={daysAgoIso(20)}
        events={[]}
        markers={newMarkers}
        now={NOW}
      />,
    );
    expect(screen.getByTestId("status").textContent).toBe("in_progress");
    expect(screen.getByTestId("source").textContent).toBe("backend");
    expect(screen.getByTestId("total").textContent).toBe("20");
    expect(screen.getByTestId("stage").textContent).toBe("1");
  });

  it("entre a mudança de status e a chegada dos novos markers, o fallback local mantém valores coerentes", () => {
    // 1) Backend responde para 'novo' há 10 dias.
    const markersNovo = makeMarkers({
      internal_status: "novo",
      created_at: daysAgoIso(10),
      current_stage_start: daysAgoIso(10),
    });
    const eventsBeforeChange: StatusChangeEvent[] = [];
    const { rerender } = render(
      <HeaderTimeBadges
        internalStatus="novo"
        createdAt={daysAgoIso(10)}
        events={eventsBeforeChange}
        markers={markersNovo}
        now={NOW}
      />,
    );
    expect(screen.getByTestId("source").textContent).toBe("backend");
    expect(screen.getByTestId("stage").textContent).toBe("10");

    // 2) Usuário muda status para 'in_progress'. Optimistic update no front:
    //    internal_status muda imediatamente, evento foi inserido em events,
    //    mas a RPC ainda não respondeu (markers=null pelo refresh).
    const eventsAfterChange: StatusChangeEvent[] = [
      { event_type: "status_change", to_status: "in_progress", created_at: daysAgoIso(0) },
    ];
    rerender(
      <HeaderTimeBadges
        internalStatus="in_progress"
        createdAt={daysAgoIso(10)}
        events={eventsAfterChange}
        markers={null}
        now={NOW}
      />,
    );
    // Fonte cai para "local", mas valores são consistentes com a transição:
    // total continua 10, etapa volta para 0 (entrou hoje).
    expect(screen.getByTestId("source").textContent).toBe("local");
    expect(screen.getByTestId("total").textContent).toBe("10");
    expect(screen.getByTestId("stage").textContent).toBe("0");

    // 3) RPC responde com markers atualizados. UI converge para backend
    //    sem mudança visual de "etapa" (continua 0).
    const markersInProgress = makeMarkers({
      internal_status: "in_progress",
      created_at: daysAgoIso(10),
      current_stage_start: daysAgoIso(0),
    });
    rerender(
      <HeaderTimeBadges
        internalStatus="in_progress"
        createdAt={daysAgoIso(10)}
        events={eventsAfterChange}
        markers={markersInProgress}
        now={NOW}
      />,
    );
    expect(screen.getByTestId("source").textContent).toBe("backend");
    expect(screen.getByTestId("total").textContent).toBe("10");
    expect(screen.getByTestId("stage").textContent).toBe("0");
  });

  it("ao entrar em 'contrato_fechado', cronômetro pausa imediatamente (frozen=yes) tanto no fallback quanto após chegada dos markers", () => {
    // Antes: in_progress há 5 dias.
    const markersInProgress = makeMarkers({
      internal_status: "in_progress",
      created_at: daysAgoIso(15),
      current_stage_start: daysAgoIso(5),
    });
    const { rerender } = render(
      <HeaderTimeBadges
        internalStatus="in_progress"
        createdAt={daysAgoIso(15)}
        events={[]}
        markers={markersInProgress}
        now={NOW}
      />,
    );
    expect(screen.getByTestId("frozen").textContent).toBe("no");

    // Optimistic: muda para contrato_fechado hoje, markers ainda nulos.
    const eventsClosed: StatusChangeEvent[] = [
      { event_type: "status_change", to_status: "contrato_fechado", created_at: daysAgoIso(0) },
    ];
    rerender(
      <HeaderTimeBadges
        internalStatus="contrato_fechado"
        createdAt={daysAgoIso(15)}
        events={eventsClosed}
        markers={null}
        now={NOW}
      />,
    );
    // Fallback local já reconhece o congelamento.
    expect(screen.getByTestId("source").textContent).toBe("local");
    expect(screen.getByTestId("frozen").textContent).toBe("yes");
    expect(screen.getByTestId("total").textContent).toBe("15");

    // Backend confirma com frozen_at=hoje. Frozen permanece yes; total não muda.
    const markersClosed = makeMarkers({
      internal_status: "contrato_fechado",
      created_at: daysAgoIso(15),
      current_stage_start: daysAgoIso(0),
      frozen_at: daysAgoIso(0),
      is_frozen: true,
      reference_at: daysAgoIso(0),
    });
    rerender(
      <HeaderTimeBadges
        internalStatus="contrato_fechado"
        createdAt={daysAgoIso(15)}
        events={eventsClosed}
        markers={markersClosed}
        now={NOW}
      />,
    );
    expect(screen.getByTestId("source").textContent).toBe("backend");
    expect(screen.getByTestId("frozen").textContent).toBe("yes");
    expect(screen.getByTestId("total").textContent).toBe("15");
    expect(screen.getByTestId("stage").textContent).toBe("0");
  });
});
