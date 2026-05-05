import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("meta-lead-webhook handshake returns challenge with valid verify_token", async () => {
  const url = "https://pieenhgjulsrjlioozsy.supabase.co/functions/v1/meta-lead-webhook";
  const token = Deno.env.get("META_VERIFY_TOKEN");
  if (!token) throw new Error("META_VERIFY_TOKEN not set in test env");

  const qs = new URLSearchParams({
    "hub.mode": "subscribe",
    "hub.verify_token": token,
    "hub.challenge": "test_handshake_123",
  });
  const res = await fetch(`${url}?${qs}`);
  const body = await res.text();

  // Do NOT log token. Only assertions:
  console.log(`status=${res.status} body_length=${body.length} body_equals_challenge=${body === "test_handshake_123"}`);
  assertEquals(res.status, 200);
  assertEquals(body, "test_handshake_123");
});

Deno.test("meta-lead-webhook handshake returns 403 with invalid verify_token", async () => {
  const url = "https://pieenhgjulsrjlioozsy.supabase.co/functions/v1/meta-lead-webhook";
  const qs = new URLSearchParams({
    "hub.mode": "subscribe",
    "hub.verify_token": "___invalid_token_xyz___",
    "hub.challenge": "test_handshake_123",
  });
  const res = await fetch(`${url}?${qs}`);
  const body = await res.text();
  console.log(`status=${res.status} body=${body}`);
  assertEquals(res.status, 403);
});
