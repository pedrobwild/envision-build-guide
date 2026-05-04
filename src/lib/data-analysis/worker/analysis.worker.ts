/**
 * Web Worker que roda `analyze()` + `analyzeQuality()` em background,
 * evitando travamento da UI em datasets grandes.
 *
 * Mensageria simples request/response com `id` para correlacionar.
 *
 * Vite expõe este worker via `new Worker(new URL("./analysis.worker.ts", import.meta.url), { type: "module" })`.
 */

import { analyze } from "../analyze";
import { analyzeQuality } from "@/lib/data-quality";
import type {
  AnalysisRequest,
  AnalysisResult,
  Dataset,
  DataQualityReport,
} from "@/components/ai-analysis/types";

export interface WorkerRequest {
  id: number;
  dataset: Dataset;
  question?: string;
  enableForecast?: boolean;
  topK?: number;
  minSampleForCorrelation?: number;
}

export type WorkerResponse =
  | { id: number; ok: true; analysis: AnalysisResult; quality: DataQualityReport }
  | { id: number; ok: false; error: string };

self.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  try {
    const request: AnalysisRequest = {
      dataset: req.dataset,
      question: req.question,
      options: {
        enableForecast: req.enableForecast,
        topK: req.topK,
        minSampleForCorrelation: req.minSampleForCorrelation,
      },
    };
    const analysis = analyze(request);
    const quality = analyzeQuality(req.dataset);
    const response: WorkerResponse = { id: req.id, ok: true, analysis, quality };
    (self as unknown as { postMessage: (m: WorkerResponse) => void }).postMessage(response);
  } catch (e) {
    const response: WorkerResponse = {
      id: req.id,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
    (self as unknown as { postMessage: (m: WorkerResponse) => void }).postMessage(response);
  }
});

// Garante que TS reconheça este arquivo como módulo
export {};
