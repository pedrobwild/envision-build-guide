/**
 * Teste de integração: garante que, quando há markers do backend disponíveis,
 * o cabeçalho usa `budgetTimeFromMarkers` (fonte de verdade) e NÃO o cálculo
 * local sobre `events`. Também valida o caminho de fallback (sem markers).
 *
 * Reproduz o padrão de seleção usado em `src/pages/BudgetInternalDetail.tsx`
 * num componente leve para evitar montar a página inteira com providers.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  computeBudgetTime,
  budgetTimeFromMarkers,
  type StatusChangeEvent,
} from "@/lib/budget-time-in-stage";
import type { BudgetTimeMarkers } from "@/hooks/useBudgetTimeMarkers";

// Espelha o padrão real do cabeçalho em BudgetInternalDetail.tsx (linhas ~709-728).
function HeaderTimeBadges(props: {
  internalStatus: string;
  createdAt: string;
  events: StatusChangeEvent[];
  markers: BudgetTimeMarkers | null;
  now?: Date;
}) {
  const { totalDaysOpen, daysInStage, isFrozen, frozenAt, currentStageStart } =
    props.markers
      ? budgetTimeFromMarkers(props.markers, props.now)
      : computeBudgetTime({
          internalStatus: props.internalStatus,
          createdAt: props.createdAt,
          events: props.events,
          now: props.now,
        });
  return (
    <div>
      <span data-testid="total">{totalDaysOpen}</span>
      <span data-testid="stage">{daysInStage}</span>
      <span data-testid="frozen">{isFrozen ? "yes" : "no"}</span>
      <span data-testid="frozen-at">{frozenAt ? frozenAt.toISOString() : ""}</span>
      <span data-testid="stage-start">
        {currentStageStart ? currentStageStart.toISOString() : ""}
      </span>
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

describe("Header time badges — backend markers vs local fallback", () => {
  it("usa markers do backend quando disponíveis e ignora cálculo local divergente", () => {
    // Markers do backend dizem: criado há 30 dias, etapa atual há 2 dias.
    const markers: BudgetTimeMarkers = {
      budget_id: "b1",
      internal_status: "in_progress",
      created_at: daysAgoIso(30),
      current_stage_start: daysAgoIso(2),
      frozen_at: null,
      is_frozen: false,
      reference_at: NOW.toISOString(),
    };
    // Eventos locais propositalmente divergentes — o componente NÃO deve usá-los.
    const events: StatusChangeEvent[] = [
      { event_type: "status_change", to_status: "in_progress", created_at: daysAgoIso(20) },
    ];

    render(
      <HeaderTimeBadges
        internalStatus="in_progress"
        createdAt={daysAgoIso(99)} // valor "errado" para provar que veio do marker
        events={events}
        markers={markers}
        now={NOW}
      />,
    );

    expect(screen.getByTestId("source").textContent).toBe("backend");
    expect(screen.getByTestId("total").textContent).toBe("30");
    expect(screen.getByTestId("stage").textContent).toBe("2");
    expect(screen.getByTestId("frozen").textContent).toBe("no");
    // Datas exatas vêm do backend.
    expect(screen.getByTestId("stage-start").textContent).toBe(daysAgoIso(2));
  });

  it("respeita o congelamento dos markers (contrato_fechado pausa o cronômetro)", () => {
    const markers: BudgetTimeMarkers = {
      budget_id: "b1",
      internal_status: "contrato_fechado",
      created_at: daysAgoIso(10),
      current_stage_start: daysAgoIso(3),
      frozen_at: daysAgoIso(3),
      is_frozen: true,
      reference_at: daysAgoIso(3),
    };

    render(
      <HeaderTimeBadges
        internalStatus="contrato_fechado"
        createdAt={daysAgoIso(10)}
        events={[]}
        markers={markers}
        now={NOW}
      />,
    );

    expect(screen.getByTestId("frozen").textContent).toBe("yes");
    // 10 - 3 = 7 dias até congelar; etapa atual = 0 (entrou no mesmo momento).
    expect(screen.getByTestId("total").textContent).toBe("7");
    expect(screen.getByTestId("stage").textContent).toBe("0");
    expect(screen.getByTestId("frozen-at").textContent).toBe(daysAgoIso(3));
  });

  it("cai para cálculo local quando markers ainda não chegaram (loading/erro)", () => {
    const events: StatusChangeEvent[] = [
      { event_type: "status_change", to_status: "in_progress", created_at: daysAgoIso(4) },
    ];
    render(
      <HeaderTimeBadges
        internalStatus="in_progress"
        createdAt={daysAgoIso(15)}
        events={events}
        markers={null}
        now={NOW}
      />,
    );

    expect(screen.getByTestId("source").textContent).toBe("local");
    expect(screen.getByTestId("total").textContent).toBe("15");
    expect(screen.getByTestId("stage").textContent).toBe("4");
  });
});
