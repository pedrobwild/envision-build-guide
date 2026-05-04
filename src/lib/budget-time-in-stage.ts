import { differenceInCalendarDays } from "date-fns";

/**
 * Eventos finais que congelam o cronômetro do negócio.
 * Mantenha esta lista em sincronia com o uso em BudgetInternalDetail.
 */
export const FROZEN_STATUSES = new Set(["contrato_fechado", "lost", "archived"]);

export interface StatusChangeEvent {
  event_type: string;
  to_status: string | null;
  created_at: string; // ISO
}

export interface BudgetTimeInput {
  /** Status atual do orçamento. */
  internalStatus: string;
  /** Data de criação do orçamento (ISO). */
  createdAt: string | null;
  /** Eventos do orçamento em ordem ASCENDENTE (mais antigo primeiro). */
  events: StatusChangeEvent[];
  /** Momento "agora" — útil para testes determinísticos. */
  now?: Date;
}

export interface BudgetTimeResult {
  /** Status final atingido (entrou em contrato_fechado/lost/archived). */
  isFrozen: boolean;
  /** Data do PRIMEIRO status_change que entrou em estado final. */
  frozenAt: Date | null;
  /** Início da etapa atual (último status_change que entrou no internal_status atual). Se não houver, usa createdAt. */
  currentStageStart: Date | null;
  /** Dias inteiros desde a criação até a referência (frozenAt ou now). */
  totalDaysOpen: number | null;
  /** Dias inteiros na etapa atual até a referência (frozenAt ou now). */
  daysInStage: number | null;
}

/**
 * Calcula o tempo de vida do negócio e o tempo na etapa atual.
 *
 * Regras:
 * - Se o negócio já entrou em "contrato_fechado", "lost" ou "archived", o cronômetro
 *   PARA no PRIMEIRO evento que levou a esse estado (eventos posteriores são ignorados).
 * - O início da etapa atual é o ÚLTIMO `status_change` cujo `to_status` === `internalStatus`.
 *   Se não houver, usa a criação do orçamento.
 * - `differenceInCalendarDays` é usado, então 0 = "hoje".
 */
export function computeBudgetTime(input: BudgetTimeInput): BudgetTimeResult {
  const now = input.now ?? new Date();
  const isFrozen = FROZEN_STATUSES.has(input.internalStatus);

  // PRIMEIRO status_change que entrou em estado final.
  const frozenEvent = isFrozen
    ? input.events.find(
        (e) => e.event_type === "status_change" && e.to_status && FROZEN_STATUSES.has(e.to_status),
      )
    : null;
  const frozenAt = frozenEvent ? new Date(frozenEvent.created_at) : null;
  const reference = frozenAt ?? now;

  // ÚLTIMO status_change que entrou no status atual (varremos do fim).
  let currentStageStart: Date | null = null;
  for (let i = input.events.length - 1; i >= 0; i--) {
    const e = input.events[i];
    if (e.event_type === "status_change" && e.to_status === input.internalStatus) {
      currentStageStart = new Date(e.created_at);
      break;
    }
  }
  if (!currentStageStart && input.createdAt) {
    currentStageStart = new Date(input.createdAt);
  }

  const totalDaysOpen = input.createdAt
    ? Math.max(0, differenceInCalendarDays(reference, new Date(input.createdAt)))
    : null;
  const daysInStage = currentStageStart
    ? Math.max(0, differenceInCalendarDays(reference, currentStageStart))
    : null;

  return {
    isFrozen,
    frozenAt,
    currentStageStart,
    totalDaysOpen,
    daysInStage,
  };
}

/**
 * Converte os marcos vindos da RPC `get_budget_time_markers` no mesmo
 * formato de `BudgetTimeResult`. Backend é a fonte de verdade — usar este
 * helper evita divergência entre cliente e banco.
 */
export function budgetTimeFromMarkers(
  markers: {
    internal_status: string;
    created_at: string | null;
    current_stage_start: string | null;
    frozen_at: string | null;
    is_frozen: boolean;
    reference_at: string;
  },
  now: Date = new Date(),
): BudgetTimeResult {
  const reference = markers.frozen_at ? new Date(markers.frozen_at) : now;
  const created = markers.created_at ? new Date(markers.created_at) : null;
  const stageStart = markers.current_stage_start
    ? new Date(markers.current_stage_start)
    : created;
  return {
    isFrozen: markers.is_frozen,
    frozenAt: markers.frozen_at ? new Date(markers.frozen_at) : null,
    currentStageStart: stageStart,
    totalDaysOpen: created
      ? Math.max(0, differenceInCalendarDays(reference, created))
      : null,
    daysInStage: stageStart
      ? Math.max(0, differenceInCalendarDays(reference, stageStart))
      : null,
  };
}
