import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import webpush from "npm:web-push@3.6.7";

const PUBLIC_VAPID_KEY = "BMpalGhIpd9AipWKCNaHn8mMQjz1bdW-PF8q_NVUaRknw70fCid9yliJ5t4dFe6t8epibGWM6_tJkPn5M73Tw_o";
const WORKSPACE_SLUG = "yamilet-mes";
const allowedOrigins = new Set([
  "https://www.yamiletperez.com",
  "https://yamiletperez.com",
  "https://rujumagil.github.io"
]);

function cors(origin: string | null) {
  const value = origin && allowedOrigins.has(origin) ? origin : "https://www.yamiletperez.com";
  return {
    "Access-Control-Allow-Origin": value,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-yamilet-push-token",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(data: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json" }
  });
}

function safeText(value: unknown, fallback: string, max = 300) {
  const text = typeof value === "string" ? value.trim() : "";
  return (text || fallback).slice(0, max);
}

function sameSecret(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, origin);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return json({ error: "server_config_missing" }, 500, origin);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const [{ data: workspace, error: workspaceError }, { data: pushConfig, error: pushConfigError }] =
    await Promise.all([
      admin.from("workspaces").select("id,name,slug").eq("slug", WORKSPACE_SLUG).maybeSingle(),
      admin.rpc("get_yamilet_push_server_config")
    ]);

  if (workspaceError || !workspace) return json({ error: "workspace_not_found" }, 500, origin);
  if (pushConfigError) return json({ error: "push_config_unavailable" }, 500, origin);

  const cfg = Array.isArray(pushConfig) ? pushConfig[0] : pushConfig;
  const privateKey = cfg?.vapid_private_key || "";
  const internalSecret = cfg?.internal_token || "";
  if (!privateKey || !internalSecret) return json({ error: "push_not_configured" }, 500, origin);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400, origin); }

  let authorized = false;
  let authorizedUserId: string | null = null;

  const internalHeader = req.headers.get("x-yamilet-push-token") || "";
  if (sameSecret(internalHeader, internalSecret)) {
    authorized = true;
  } else {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (token) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false }
      });
      const { data: userData, error: userError } = await userClient.auth.getUser(token);
      const currentUser = userError ? null : userData.user;

      if (currentUser) {
        const [{ data: profile }, { data: membership }] = await Promise.all([
          admin.from("profiles").select("role,platform_role,status").eq("id", currentUser.id).maybeSingle(),
          admin.from("workspace_members").select("role,status").eq("workspace_id", workspace.id).eq("user_id", currentUser.id).maybeSingle()
        ]);

        const platformAdmin =
          profile?.status !== "inactive" &&
          (["admin","super_admin"].includes(profile?.role) || ["admin","super_admin"].includes(profile?.platform_role));

        const workspaceAdmin =
          membership?.status === "active" && ["owner","admin"].includes(membership?.role);

        authorized = Boolean(platformAdmin || workspaceAdmin);
        if (authorized) authorizedUserId = currentUser.id;
      }
    }
  }

  if (!authorized) return json({ error: "not_authorized" }, 401, origin);

  const requestedUserId = typeof body.user_id === "string" ? body.user_id : null;
  const targetUserId = authorizedUserId ? authorizedUserId : requestedUserId;

  let query = admin
    .from("yamilet_push_subscriptions")
    .select("id,user_id,endpoint,p256dh,auth")
    .eq("workspace_id", workspace.id)
    .eq("enabled", true);

  if (targetUserId) query = query.eq("user_id", targetUserId);

  const { data: subscriptions, error: subscriptionError } = await query;
  if (subscriptionError) return json({ error: "subscriptions_unavailable" }, 500, origin);

  const title = safeText(body.title, "Yamilet Admin", 120);
  const message = safeText(body.body, "Tienes una nueva actualización.", 300);
  const url = safeText(body.url, "/admin/#dashboard", 500);
  const tag = safeText(body.tag, "yamilet-admin", 120);

  if (!subscriptions?.length) {
    return json({ ok: true, sent: 0, failed: 0, total: 0 }, 200, origin);
  }

  webpush.setVapidDetails(
    "mailto:academia@yamiletperez.com",
    PUBLIC_VAPID_KEY,
    privateKey
  );

  const payload = JSON.stringify({
    title,
    body: message,
    url,
    tag,
    timestamp: new Date().toISOString()
  });

  let sent = 0;
  let failed = 0;

  await Promise.all(subscriptions.map(async (sub: any) => {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth }
        },
        payload,
        { TTL: 3600, urgency: "high" }
      );
      sent++;
      await admin.from("yamilet_push_subscriptions").update({
        last_sent_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString()
      }).eq("id", sub.id);
    } catch (error: any) {
      failed++;
      const statusCode = Number(error?.statusCode || error?.status || 0);
      const gone = statusCode === 404 || statusCode === 410;
      await admin.from("yamilet_push_subscriptions").update({
        enabled: gone ? false : true,
        last_error: String(error?.message || "push_failed").slice(0, 500),
        updated_at: new Date().toISOString()
      }).eq("id", sub.id);
    }
  }));

  return json({ ok: true, sent, failed, total: subscriptions.length }, 200, origin);
});
