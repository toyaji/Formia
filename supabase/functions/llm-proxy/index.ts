// llm-proxy — provider-aware key-injecting gateway for the client-side agent.
//
// The agent loop runs in the Flutter client (dartantic_ai); only the raw LLM
// call is routed here so the API key never reaches the browser (07 §2, §6).
// This is NOT a dumb passthrough: it assumes a hostile client and enforces a
// model allowlist + per-caller quota before forwarding. Gemini uses its NATIVE
// endpoint (the OpenAI-compat shim has streaming+tool-call bugs — 07 §2).
//
// Guest BYOK keys do NOT come here (clients call the provider directly, 03 §1);
// this handles logged-in users (Vault key) and the server default key.
import { createClient } from "jsr:@supabase/supabase-js@2";

const GEMINI_BASE = "https://generativelanguage.googleapis.com";
const ALLOWED_MODELS = ["gemini-2.5-flash", "gemini-flash-latest"];
const QUOTA_MAX = 60; // calls
const QUOTA_WINDOW_SECS = 60; // per caller per minute

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const err = (code: string, status: number) =>
  new Response(JSON.stringify({ error: code }), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return err("method_not_allowed", 405);

  // Sub-path after the function name = the Gemini native path, e.g.
  //   /v1beta/models/gemini-2.5-flash:streamGenerateContent
  const url = new URL(req.url);
  const marker = "/llm-proxy";
  const i = url.pathname.indexOf(marker);
  let path = i >= 0 ? url.pathname.slice(i + marker.length) : url.pathname;
  if (!path.startsWith("/")) path = "/" + path;

  // Model allowlist (block arbitrary/expensive models — anti-abuse).
  if (!ALLOWED_MODELS.some((m) => path.includes(m))) {
    return err("model_not_allowed", 403);
  }

  // Caller identity: logged-in user (JWT) → Vault key (TODO); else server key.
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const authHeader = req.headers.get("Authorization") ?? "";
  let callerId = "anon";
  if (authHeader.startsWith("Bearer ")) {
    const { data } = await admin.auth.getUser(authHeader.slice(7));
    if (data.user) callerId = data.user.id;
  }

  // Per-caller quota.
  const { data: allowed, error: qErr } = await admin.rpc("hit_rate_limit", {
    p_bucket: `llm:${callerId}`,
    p_max: QUOTA_MAX,
    p_window_secs: QUOTA_WINDOW_SECS,
  });
  if (qErr) return err("quota_error", 500);
  if (allowed === false) return err("quota_exceeded", 429);

  // Resolve the key. Logged-in → Vault (TODO: decrypt user_secrets/vault);
  // fall back to the server default key. Never logged, never returned.
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) return err("no_api_key", 401);

  // Forward to Gemini's NATIVE endpoint with the key injected.
  const target = `${GEMINI_BASE}${path}${url.search ? url.search + "&" : "?"}key=${key}`;
  const upstream = await fetch(target, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: await req.text(),
  });

  // Relay status + (streaming) body. Do not log the body/key.
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      ...cors,
      "content-type": upstream.headers.get("content-type") ?? "application/json",
    },
  });
});
