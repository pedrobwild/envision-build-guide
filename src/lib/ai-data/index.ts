/**
 * Entry-point da camada de AI Data Analysis.
 * Reexporta tudo para que consumidores (UI, hooks) façam:
 *
 *     import { runInsightEngine, planAnalysis } from "@/lib/ai-data";
 */

export * from "./types";
export * from "./dataCatalog";
export * from "./metricDefinitions";
export * from "./domainGlossary";
export * from "./statistics";
export * from "./insightScoring";
export * from "./visualizationRecommender";
export * from "./insightEngine";
export * from "./analysisPlanner";
