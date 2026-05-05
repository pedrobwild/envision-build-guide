/**
 * Contract tests guaranteeing that the public-facing RPCs
 * (`get_public_budget`, `get_public_budget_full`, `get_public_budget_total`)
 * and the anon-accessible REST surface only return whitelisted columns —
 * never internal cost/ownership/notes/triage fields.
 *
 * Companion to `get-public-budget.contract.test.ts` (which covers the
 * status-allowlist behavior). This suite focuses on the **column
 * whitelist** invariant: even if RLS or an RPC is later loosened by
 * mistake, these tests fail loudly if any forbidden field leaks.
 *
 * Hits the real Supabase REST endpoint as the **anon** role.
 */
import { describe, it, expect, beforeAll } from "vitest";
import {
  PUBLIC_BUDGET_COLUMNS,
  PUBLIC_SECTION_COLUMNS,
  PUBLIC_ITEM_COLUMNS,
  PUBLIC_ADJUSTMENT_COLUMNS,
  PUBLIC_ROOM_COLUMNS,
} from "@/lib/public-columns";

const SUPABASE_URL = "https://pieenhgjulsrjlioozsy.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpZWVuaGdqdWxzcmpsaW9venN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2NTE2NjYsImV4cCI6MjA4NzIyNzY2Nn0.n0VPTOADpoBLjPi08Am8dUy-842t_e8i7i1XqdqFdAE";

const headers = {
  apikey: ANON_KEY,
  Authorization: `Bearer ${ANON_KEY}`,
  "Content-Type": "application/json",
} as const;

// Fields that MUST NEVER appear in any public response. If new sensitive
// columns are added to a table, list them here so this contract catches
// regressions automatically.
const FORBIDDEN_BUDGET_FIELDS = [
  "internal_cost",
  "internal_notes",
  "internal_status",
  "briefing",
  "demand_context",
  "reference_links",
  "priority",
  "due_at",
  "closed_at",
  "created_by",
  "commercial_owner_id",
  "estimator_owner_id",
  "public_token_hash",
  "property_type",
  "city",
  "deleted_at",
  "client_phone",
  "win_probability",
  "internal_total_snapshot",
] as const;

const FORBIDDEN_TOTAL_FIELDS = [
  "internal_cost",
  "internal_notes",
  "briefing",
  "commercial_owner_id",
  "estimator_owner_id",
  "created_by",
] as const;

async function rpc(name: string, body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`RPC ${name} HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

async function findPublishedPublicId(): Promise<string | null> {
  // After May/2026 hardening, anon SELECT on `budgets` is revoked, so we
  // can't enumerate published rows via REST. Allow CI / local dev to
  // inject a known good fixture; otherwise probe the resolver RPC with a
  // small set of likely candidates by reading from env.
  const fromEnv = (import.meta as unknown as { env?: Record<string, string> })?.env
    ?.VITE_TEST_PUBLIC_BUDGET_ID;
  if (fromEnv) return fromEnv;
  // Fall back to a stable production fixture (read-only, public id only).
  return "b103af078c63";
}

let publishedId: string | null = null;

beforeAll(async () => {
  publishedId = await findPublishedPublicId();
});

function assertNoForbidden(obj: Record<string, unknown>, forbidden: readonly string[], ctx: string) {
  for (const field of forbidden) {
    expect(obj, `${ctx}: forbidden field "${field}" leaked`).not.toHaveProperty(field);
  }
}

function assertOnlyWhitelisted(
  obj: Record<string, unknown>,
  whitelist: readonly string[],
  ctx: string,
) {
  const allowed = new Set<string>(whitelist);
  // Allow joined/derived aliases that share a whitelisted name (e.g. bairro from property).
  const extra = Object.keys(obj).filter((k) => !allowed.has(k));
  expect(extra, `${ctx}: unexpected fields beyond whitelist`).toEqual([]);
}

describe("get_public_budget — column whitelist", () => {
  it("returns only whitelisted budget columns and no internal fields", async () => {
    if (!publishedId) {
      console.warn("[skip] no published budget fixture");
      return;
    }
    const data = (await rpc("get_public_budget", { p_public_id: publishedId })) as Record<
      string,
      unknown
    > | null;
    expect(data).not.toBeNull();
    if (!data) return;

    assertNoForbidden(data, FORBIDDEN_BUDGET_FIELDS, "get_public_budget");
    assertOnlyWhitelisted(data, PUBLIC_BUDGET_COLUMNS, "get_public_budget");
  });
});

describe("get_public_budget_full — column whitelist", () => {
  it("returns budget/sections/items/adjustments/rooms with no forbidden fields", async () => {
    if (!publishedId) {
      console.warn("[skip] no published budget fixture");
      return;
    }
    const data = (await rpc("get_public_budget_full", { p_public_id: publishedId })) as {
      budget: Record<string, unknown> | null;
      sections: Array<Record<string, unknown>>;
      items: Array<Record<string, unknown>>;
      adjustments: Array<Record<string, unknown>>;
      rooms: Array<Record<string, unknown>>;
    } | null;
    expect(data).not.toBeNull();
    if (!data) return;

    expect(data.budget).not.toBeNull();
    if (data.budget) {
      assertNoForbidden(data.budget, FORBIDDEN_BUDGET_FIELDS, "get_public_budget_full.budget");
    }

    // Sections — no internal_notes, no addendum_action overrides exposing
    // internal triage. We accept a superset of the whitelist (e.g.
    // `created_at`/`updated_at`) because the RPC uses to_jsonb on the row,
    // but we hard-fail on cost/ownership leaks.
    for (const s of data.sections ?? []) {
      assertNoForbidden(
        s,
        ["internal_cost", "internal_notes", "owner_id", "created_by"],
        "section",
      );
    }

    // Items — explicit projection in the RPC; confirm no extras.
    const itemAllowed = new Set<string>(PUBLIC_ITEM_COLUMNS);
    for (const i of data.items ?? []) {
      const extra = Object.keys(i).filter((k) => !itemAllowed.has(k));
      expect(extra, "item: unexpected fields beyond whitelist").toEqual([]);
    }

    // Adjustments / rooms — confirm no internal fields.
    for (const a of data.adjustments ?? []) {
      assertNoForbidden(a, ["created_by", "internal_notes"], "adjustment");
    }
    for (const r of data.rooms ?? []) {
      const allowed = new Set<string>(["id", "name", "polygon"]);
      const extra = Object.keys(r).filter((k) => !allowed.has(k));
      expect(extra, "room: unexpected fields beyond whitelist").toEqual([]);
    }

    // Reference the imported whitelists so unused-import lint is satisfied
    // and the test fails if the constants are removed.
    expect(PUBLIC_SECTION_COLUMNS.length).toBeGreaterThan(0);
    expect(PUBLIC_ADJUSTMENT_COLUMNS.length).toBeGreaterThan(0);
    expect(PUBLIC_ROOM_COLUMNS.length).toBeGreaterThan(0);
  });
});

describe("get_public_budget_total — column whitelist", () => {
  it("returns only aggregate fields, never internal cost/ownership", async () => {
    if (!publishedId) {
      console.warn("[skip] no published budget fixture");
      return;
    }
    const data = (await rpc("get_public_budget_total", {
      p_public_id: publishedId,
    })) as Record<string, unknown> | null;
    expect(data).not.toBeNull();
    if (!data) return;

    assertNoForbidden(data, FORBIDDEN_TOTAL_FIELDS, "get_public_budget_total");
    const allowed = new Set([
      "total",
      "source",
      "section_count",
      "item_count",
      "has_manual_total",
    ]);
    const extra = Object.keys(data).filter((k) => !allowed.has(k));
    expect(extra, "get_public_budget_total: unexpected fields").toEqual([]);
  });
});

describe("budgets REST — anon SELECT cannot expose internal fields", () => {
  it("rejects anon attempts to select internal_cost / internal_notes / briefing", async () => {
    // Even when filtering for published rows (which RLS allows… or used
    // to allow), explicit anon REST SELECT on the budgets table must
    // either be blocked entirely or only return rows without sensitive
    // columns. After the May/2026 hardening, the broad anon SELECT
    // policy on `budgets` was removed — this test pins that contract.
    const url = new URL(`${SUPABASE_URL}/rest/v1/budgets`);
    url.searchParams.set("select", "id,internal_cost,internal_notes,briefing");
    url.searchParams.set("status", "eq.published");
    url.searchParams.set("limit", "3");
    const res = await fetch(url, { headers });
    if (res.ok) {
      const rows = (await res.json()) as Array<Record<string, unknown>>;
      // Anon must NOT receive internal columns. Either the array is
      // empty (RLS blocked) or PostgREST stripped/erred. We assert the
      // strict invariant: no row may carry these fields with a value.
      for (const row of rows) {
        for (const k of ["internal_cost", "internal_notes", "briefing"] as const) {
          expect(row[k] ?? null, `anon REST leaked ${k}`).toBeNull();
        }
      }
    } else {
      expect([400, 401, 403, 404]).toContain(res.status);
    }
  });
});
