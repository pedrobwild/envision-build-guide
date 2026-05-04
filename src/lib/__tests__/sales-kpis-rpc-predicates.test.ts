/**
 * Frozen snapshot of the filter predicates (start/end/owner) used by every
 * Sales KPI RPC. The goal is to fail loudly the moment someone changes the
 * filter criterion of a single RPC — even if the change is "harmless" — so the
 * dashboard, cohorts, time-in-stage and conversion blocks stay aligned.
 *
 * Strategy: introspect pg_get_functiondef via psql, extract the lines that
 * apply the `_start_date` / `_end_date` / `_owner_id` predicates, normalize
 * whitespace and assert against the snapshot below.
 *
 * The test auto-skips when the sandbox does not have managed Postgres access
 * (no $PGHOST), so it can run safely in CI without secrets.
 */
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";

const HAS_DB = Boolean(process.env.PGHOST);

const defCache = new Map<string, string>();
function fetchDef(proname: string, argsLike: string): string {
  const key = `${proname}::${argsLike}`;
  const cached = defCache.get(key);
  if (cached !== undefined) return cached;
  const sql = `SELECT pg_get_functiondef(p.oid)
               FROM pg_proc p
               WHERE p.proname = '${proname}'
                 AND pg_get_function_identity_arguments(p.oid) LIKE '${argsLike}'
               LIMIT 1`;
  const out = execFileSync("psql", ["-tAc", sql], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  defCache.set(key, out);
  return out;
}

/** Extract every line that mentions one of the global filter parameters and
 *  normalize whitespace so cosmetic edits don't break the snapshot. */
function extractPredicates(def: string): string[] {
  return def
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /(_start_date|_end_date|_owner_id|\$1|\$2|\$3)/.test(l))
    .filter((l) => /IS NULL OR/.test(l))
    .map((l) => l.replace(/\s+/g, " ").replace(/,\s*$/, ""));
}

type Spec = {
  name: string;
  argsLike: string;
  /** Frozen predicates — keep in sync with the migration. Order matters. */
  expected: string[];
};

const SPECS: Spec[] = [
  {
    name: "sales_kpis_dashboard",
    argsLike: "%timestamp%uuid",
    expected: [
      "WHERE (_start_date IS NULL OR lead_at >= _start_date)",
      "AND (_end_date IS NULL OR lead_at <= _end_date)",
      "AND (_owner_id IS NULL OR commercial_owner_id = _owner_id)",
    ],
  },
  {
    name: "sales_kpis_cohorts",
    argsLike: "%timestamp%uuid",
    expected: [
      "WHERE (_start_date IS NULL OR e.lead_at >= _start_date)",
      "AND (_end_date IS NULL OR e.lead_at <= _end_date)",
      "AND (_owner_id IS NULL OR e.commercial_owner_id = _owner_id)",
    ],
  },
  {
    name: "sales_kpis_lost_reasons",
    argsLike: "%timestamp%uuid",
    expected: [
      "WHERE (_start_date IS NULL OR eb.lead_at >= _start_date)",
      "AND (_end_date IS NULL OR eb.lead_at <= _end_date)",
      "AND (_owner_id IS NULL OR eb.commercial_owner_id = _owner_id)",
    ],
  },
  {
    // by_owner intentionally ignores _owner_id (it ranks all owners).
    name: "sales_kpis_by_owner",
    argsLike: "%timestamp%timestamp%",
    expected: [
      "WHERE (_start_date IS NULL OR e.lead_at >= _start_date)",
      "AND (_end_date IS NULL OR e.lead_at <= _end_date)",
    ],
  },
  {
    // time_in_stage filters by event timestamp (not lead_at) by design.
    name: "sales_kpis_time_in_stage",
    argsLike: "%timestamp%uuid",
    expected: [
      "AND (_owner_id IS NULL OR b.commercial_owner_id = _owner_id)",
      "AND (_start_date IS NULL OR be.created_at >= _start_date)",
      "AND (_end_date IS NULL OR be.created_at <= _end_date)",
    ],
  },
  {
    // EXECUTE'd dynamic SQL — predicates show up as $1/$2/$3 placeholders.
    name: "sales_conversion_by_segment",
    argsLike: "%text, timestamp%uuid",
    expected: [
      "WHERE ($1 IS NULL OR lead_at >= $1)",
      "AND ($2 IS NULL OR lead_at <= $2)",
      "AND ($3 IS NULL OR commercial_owner_id = $3)",
    ],
  },
];

describe("Sales KPI RPCs — frozen filter predicates", () => {
  if (!HAS_DB) {
    it.skip("requires managed Postgres access ($PGHOST)", () => {});
    return;
  }

  for (const spec of SPECS) {
    it(`${spec.name} applies the expected start/end/owner predicates`, () => {
      const def = fetchDef(spec.name, spec.argsLike);
      expect(def, `function ${spec.name} not found`).not.toBe("");
      const predicates = extractPredicates(def);
      expect(predicates).toEqual(spec.expected);
    });
  }

  it("every RPC filters by exactly the documented columns (no drift)", () => {
    // Cross-check: across all RPCs we only ever filter time on one of
    // {lead_at, be.created_at} and owner on commercial_owner_id. If a new
    // RPC starts filtering on a different column (e.g. created_at on budgets)
    // this test fails so the team has to consciously update the contract.
    const allowedTimeCols = new Set(["lead_at", "be.created_at", "e.lead_at", "eb.lead_at"]);
    const allowedOwnerCols = new Set([
      "commercial_owner_id",
      "e.commercial_owner_id",
      "eb.commercial_owner_id",
      "b.commercial_owner_id",
    ]);
    for (const spec of SPECS) {
      const def = fetchDef(spec.name, spec.argsLike);
      const lines = extractPredicates(def);
      for (const l of lines) {
        const timeMatch = l.match(/OR ([\w.]+) (?:>=|<=)/);
        if (timeMatch) {
          expect(allowedTimeCols.has(timeMatch[1]), `${spec.name}: unexpected time column ${timeMatch[1]}`).toBe(true);
        }
        const ownerMatch = l.match(/OR ([\w.]+) =/);
        if (ownerMatch) {
          expect(allowedOwnerCols.has(ownerMatch[1]), `${spec.name}: unexpected owner column ${ownerMatch[1]}`).toBe(true);
        }
      }
    }
  });
});
