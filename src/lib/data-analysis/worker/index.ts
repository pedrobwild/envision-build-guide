/**
 * Cliente do worker — encapsula `new Worker(...)` e o protocolo
 * request/response em uma promise.
 *
 * Quando o ambiente não suporta Workers (SSR, jsdom em testes),
 * cai automaticamente para execução síncrona no main thread.
 */

import { analyze } from "../analyze";
import { analyzeQuality } from "@/lib/data-quality";
import type {
  AnalysisResult,
  Dataset,
  DataQualityReport,
} from "@/components/ai-analysis/types";
import type { WorkerRequest, WorkerResponse } from "./analysis.worker";

export interface RunAnalysisOptions {
  question?: string;
  enableForecast?: boolean;
  topK?: number;
  minSampleForCorrelation?: number;
}

export interface RunAnalysisResult {
  analysis: AnalysisResult;
  quality: DataQualityReport;
  /** "worker" quando a chamada foi delegada; "main" quando síncrono. */
  ranIn: "worker" | "main";
}

let _worker: Worker | null = null;
let _seq = 0;

function workerSupported(): boolean {
  return typeof Worker !== "undefined" && typeof window !== "undefined";
}

function getWorker(): Worker {
  if (!_worker) {
    _worker = new Worker(new URL("./analysis.worker.ts", import.meta.url), {
      type: "module",
    });
  }
  return _worker;
}

/**
 * Executa pipeline de análise no worker (ou síncrono em fallback).
 * Datasets pequenos (<1000 linhas) rodam síncrono mesmo com worker
 * disponível — overhead de postMessage não compensa.
 */
export async function runAnalysis(
  dataset: Dataset,
  options: RunAnalysisOptions = {},
): Promise<RunAnalysisResult> {
  const SMALL_THRESHOLD = 1000;

  if (!workerSupported() || dataset.rows.length < SMALL_THRESHOLD) {
    const analysis = analyze({
      dataset,
      question: options.question,
      options: {
        enableForecast: options.enableForecast,
        topK: options.topK,
        minSampleForCorrelation: options.minSampleForCorrelation,
      },
    });
    const quality = analyzeQuality(dataset);
    return { analysis, quality, ranIn: "main" };
  }

  const id = ++_seq;
  const w = getWorker();
  return new Promise<RunAnalysisResult>((resolve, reject) => {
    const handler = (ev: MessageEvent<WorkerResponse>) => {
      if (ev.data.id !== id) return;
      w.removeEventListener("message", handler);
      if (ev.data.ok) {
        resolve({ analysis: ev.data.analysis, quality: ev.data.quality, ranIn: "worker" });
      } else {
        reject(new Error(ev.data.error));
      }
    };
    w.addEventListener("message", handler);
    const req: WorkerRequest = {
      id,
      dataset,
      question: options.question,
      enableForecast: options.enableForecast,
      topK: options.topK,
      minSampleForCorrelation: options.minSampleForCorrelation,
    };
    w.postMessage(req);
  });
}

/** Encerra o worker (útil em hot-reload de dev e testes). */
export function terminateAnalysisWorker(): void {
  if (_worker) {
    _worker.terminate();
    _worker = null;
  }
}
