/**
 * Recomenda o tipo de visualização ideal a partir do tipo de insight e
 * da forma dos dados (séries temporais, distribuições, comparações).
 *
 * Regras simples e explicáveis — o objetivo é que cada insight venha com
 * uma sugestão de visualização razoável sem precisar de um LLM.
 */

import type { Insight, VisualizationHint, VisualizationType } from "./types";

export interface SeriesShape {
  /** quantos pontos no eixo X (tempo). */
  timePoints?: number;
  /** quantos grupos categóricos. */
  categories?: number;
  /** se o dado tem múltiplas séries. */
  multiSeries?: boolean;
  /** se o dado representa um funil. */
  funnel?: boolean;
  /** se há lat/lng ou cidade/bairro. */
  hasGeo?: boolean;
}

export function recommendVisualization(insightType: Insight["type"], shape: SeriesShape = {}): VisualizationType {
  if (shape.funnel) return "funnel";
  if (shape.hasGeo) return "map";

  switch (insightType) {
    case "predictive":
    case "comparative":
      return shape.timePoints && shape.timePoints > 6 ? "line" : "bar";
    case "funnel":
      return "funnel";
    case "geographic":
      return "map";
    case "financial":
      return shape.timePoints && shape.timePoints > 1 ? "area" : "bar";
    case "operational":
    case "diagnostic":
      return shape.categories && shape.categories > 1 ? "bar" : "kpi";
    case "data_quality":
      return "table";
    case "descriptive":
    default:
      if (shape.timePoints && shape.timePoints > 1) return "line";
      if (shape.categories && shape.categories > 1) return "bar";
      return "kpi";
  }
}

export function buildVisualization(
  insightType: Insight["type"],
  shape: SeriesShape,
  data: VisualizationHint["data"],
  axes: { x?: string; y?: string; groupBy?: string } = {},
): VisualizationHint {
  return {
    type: recommendVisualization(insightType, shape),
    data,
    ...axes,
  };
}
