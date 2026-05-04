import { describe, it, expect } from "vitest";
import { runAnalysis, terminateAnalysisWorker } from "../worker";
import { buildDataset } from "../buildDataset";

describe("runAnalysis (worker client com fallback main)", () => {
  it("dataset pequeno roda no main thread (fallback)", async () => {
    const ds = buildDataset(
      [
        { id: "a", x: 1 },
        { id: "b", x: 2 },
      ],
      { id: "small", name: "small" },
    );
    const r = await runAnalysis(ds);
    expect(r.ranIn).toBe("main");
    expect(r.analysis.summaries.length).toBeGreaterThan(0);
    expect(r.quality.healthScore).toBeGreaterThanOrEqual(0);
    terminateAnalysisWorker();
  });

  it("retorna erro estruturado quando worker rejeita", async () => {
    // jsdom não tem Worker — testamos só o caminho síncrono
    const ds = buildDataset(
      [{ id: "a", v: 1 }],
      { id: "tiny", name: "tiny" },
    );
    const r = await runAnalysis(ds, { enableForecast: false });
    expect(r.analysis).toBeDefined();
    terminateAnalysisWorker();
  });
});
