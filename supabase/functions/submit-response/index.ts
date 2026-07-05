// submit-response — public endpoint for anonymous form submissions.
//
// RLS intentionally does NOT grant anon INSERT on `responses` (03 §2). All
// public submissions flow through here so we can enforce abuse protections
// that RLS cannot: payload size cap, per-IP rate limiting, and a published
// check — before inserting with the service role.
import { createClient } from "jsr:@supabase/supabase-js@2";

const MAX_BODY_BYTES = 256 * 1024; // 256KB
const RATE_MAX = 10; // submissions
const RATE_WINDOW_SECS = 60; // per IP per minute

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: "payload_too_large" }, 413);

  let payload: { shortId?: string; answers?: unknown; metadata?: unknown };
  try {
    payload = JSON.parse(raw);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const { shortId, answers, metadata } = payload;
  if (typeof shortId !== "string" || typeof answers !== "object" || answers === null) {
    return json({ error: "missing_fields" }, 400);
  }

  const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 1) Rate limit per IP.
  const { data: allowed, error: rlErr } = await admin.rpc("hit_rate_limit", {
    p_bucket: `resp:${ip}`,
    p_max: RATE_MAX,
    p_window_secs: RATE_WINDOW_SECS,
  });
  if (rlErr) return json({ error: "rate_limit_error" }, 500);
  if (allowed === false) return json({ error: "rate_limited" }, 429);

  // 2) Resolve a *published* deployment only.
  const { data: dep } = await admin
    .from("deployments")
    .select("form_id")
    .eq("short_id", shortId)
    .eq("status", "published")
    .maybeSingle();
  if (!dep) return json({ error: "form_not_found_or_unpublished" }, 404);

  // 3) Insert (service role bypasses RLS).
  const { error: insErr } = await admin.from("responses").insert({
    form_id: dep.form_id,
    data: answers,
    metadata: { ...(typeof metadata === "object" && metadata ? metadata : {}), ip },
  });
  if (insErr) return json({ error: "insert_failed", detail: insErr.message }, 500);

  return json({ ok: true });
});
