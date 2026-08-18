import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://www.yamiletperez.com",
  "https://yamiletperez.com",
  "https://rujumagil.github.io",
]);

type IntegrationConfig = { endpoint_url: string; secret_key: string; enabled: boolean };

type AdminClient = ReturnType<typeof createClient>;

function cors(origin: string | null) {
  const allowed = origin && allowedOrigins.has(origin) ? origin : "https://www.yamiletperez.com";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function json(status: number, body: unknown, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json; charset=utf-8" },
  });
}

function short(value: unknown, max = 255) {
  return String(value ?? "").trim().slice(0, max) || null;
}

async function loadCompasConfig(admin: AdminClient): Promise<IntegrationConfig | null> {
  const { data, error } = await admin
    .from("academy_integration_settings")
    .select("endpoint_url,secret_key,enabled")
    .eq("provider", "compas_one")
    .maybeSingle();
  if (error || !data) return null;
  return data as IntegrationConfig;
}

async function syncToCompasOne(
  admin: AdminClient,
  config: IntegrationConfig | null,
  event: { id: string; aggregate_id: string | null; payload: Record<string, unknown> },
) {
  if (!config?.enabled || !config.endpoint_url || !config.secret_key) {
    await admin.from("academy_outbox_events").update({
      status: "queued",
      next_attempt_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      last_error: "compas_one_integration_not_configured",
    }).eq("id", event.id);
    return { ok: false };
  }

  try {
    const response = await fetch(config.endpoint_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-yamilet-integration-key": config.secret_key,
      },
      body: JSON.stringify({
        event_id: event.id,
        event_type: "free_class.requested",
        payload: event.payload,
      }),
      signal: AbortSignal.timeout(8000),
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body?.ok) {
      throw new Error(`compas_one_${response.status}:${String(body?.error || "sync_failed")}`);
    }

    const syncedAt = new Date().toISOString();
    await admin.from("academy_outbox_events").update({
      status: "processed",
      attempts: 1,
      next_attempt_at: null,
      last_error: null,
      processed_at: syncedAt,
      payload: {
        ...event.payload,
        compas_one_contact_id: body.contact_id ?? null,
        compas_one_follow_up_id: body.follow_up_id ?? null,
      },
    }).eq("id", event.id);

    if (event.aggregate_id) {
      await admin.from("free_class_bookings").update({
        compas_one_contact_id: body.contact_id ?? null,
        compas_one_follow_up_id: body.follow_up_id ?? null,
        compas_one_synced_at: syncedAt,
      }).eq("id", event.aggregate_id);
    }

    return { ok: true, contact_id: body.contact_id ?? null, follow_up_id: body.follow_up_id ?? null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const { data: current } = await admin
      .from("academy_outbox_events")
      .select("attempts")
      .eq("id", event.id)
      .maybeSingle();

    await admin.from("academy_outbox_events").update({
      status: "queued",
      attempts: Number(current?.attempts || 0) + 1,
      next_attempt_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      last_error: message.slice(0, 1000),
      processed_at: null,
    }).eq("id", event.id);

    return { ok: false };
  }
}

async function retryPendingEvents(admin: AdminClient, config: IntegrationConfig | null, excludeId?: string) {
  const now = new Date().toISOString();
  let query = admin.from("academy_outbox_events")
    .select("id,aggregate_id,payload")
    .eq("event_type", "free_class.requested")
    .eq("status", "queued")
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${now}`)
    .order("created_at", { ascending: true })
    .limit(3);
  if (excludeId) query = query.neq("id", excludeId);

  const { data } = await query;
  for (const row of data || []) {
    await syncToCompasOne(admin, config, {
      id: row.id,
      aggregate_id: row.aggregate_id,
      payload: (row.payload || {}) as Record<string, unknown>,
    });
  }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" }, origin);
  if (origin && !allowedOrigins.has(origin)) return json(403, { error: "origin_not_allowed" }, origin);

  let payload: Record<string, unknown>;
  try { payload = await req.json(); }
  catch { return json(400, { error: "invalid_json" }, origin); }

  if (String(payload.company ?? "").trim()) return json(200, { ok: true }, origin);

  const fullName = String(payload.full_name ?? payload.name ?? "").trim().replace(/\s+/g, " ");
  const email = String(payload.email ?? "").trim().toLowerCase();
  const bookingDate = String(payload.booking_date ?? payload.date ?? "").trim();
  const locale = String(payload.locale ?? "es").trim() === "it" ? "it" : "es";
  const pageUrl = short(payload.page_url, 1000);

  if (fullName.length < 2 || fullName.length > 120) return json(422, { error: "invalid_name" }, origin);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return json(422, { error: "invalid_email" }, origin);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bookingDate)) return json(422, { error: "invalid_date" }, origin);

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const requested = new Date(`${bookingDate}T00:00:00Z`);
  const max = new Date(today);
  max.setUTCDate(max.getUTCDate() + 90);
  if (Number.isNaN(requested.getTime()) || requested < today || requested > max) {
    return json(422, { error: "date_out_of_range" }, origin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json(500, { error: "server_not_configured" }, origin);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const [workspaceResult, config] = await Promise.all([
    admin.from("workspaces").select("id").eq("slug", "yamilet-mes").single(),
    loadCompasConfig(admin),
  ]);
  const workspace = workspaceResult.data;
  if (workspaceResult.error || !workspace) return json(500, { error: "workspace_not_found" }, origin);

  const { data: previousBooking } = await admin.from("free_class_bookings")
    .select("id,booking_date,status,compas_one_contact_id,compas_one_follow_up_id,compas_one_synced_at")
    .eq("workspace_id", workspace.id)
    .eq("booking_date", bookingDate)
    .ilike("email", email)
    .neq("status", "cancelled")
    .limit(1)
    .maybeSingle();

  if (previousBooking) {
    const { data: queuedEvent } = await admin.from("academy_outbox_events")
      .select("id,aggregate_id,payload,status")
      .eq("aggregate_id", previousBooking.id)
      .eq("event_type", "free_class.requested")
      .limit(1)
      .maybeSingle();

    let sync = previousBooking.compas_one_synced_at
      ? { ok: true }
      : { ok: false };
    if (queuedEvent && queuedEvent.status !== "processed") {
      sync = await syncToCompasOne(admin, config, {
        id: queuedEvent.id,
        aggregate_id: queuedEvent.aggregate_id,
        payload: (queuedEvent.payload || {}) as Record<string, unknown>,
      });
    }
    return json(200, { ok: true, duplicate: true, booking: previousBooking, compas_one_synced: !!sync.ok }, origin);
  }

  const source = short(payload.source, 120) ?? "yamilet-landing";
  const { data: booking, error: bookingError } = await admin.from("free_class_bookings")
    .insert({
      workspace_id: workspace.id,
      contact_id: null,
      booking_date: bookingDate,
      full_name: fullName,
      email,
      locale,
      status: "requested",
      source,
      page_url: pageUrl,
      utm_source: short(payload.utm_source),
      utm_medium: short(payload.utm_medium),
      utm_campaign: short(payload.utm_campaign),
      utm_content: short(payload.utm_content),
      utm_term: short(payload.utm_term),
    })
    .select("id,booking_date,status")
    .single();

  if (bookingError) {
    if (bookingError.code === "23505") return json(200, { ok: true, duplicate: true }, origin);
    return json(500, { error: "booking_failed" }, origin);
  }

  const eventPayload = {
    booking_id: booking.id,
    name: fullName,
    email,
    booking_date: bookingDate,
    locale,
    source,
    page_url: pageUrl,
    utm_source: short(payload.utm_source),
    utm_medium: short(payload.utm_medium),
    utm_campaign: short(payload.utm_campaign),
    utm_content: short(payload.utm_content),
    utm_term: short(payload.utm_term),
  };

  const { data: outboxEvent, error: outboxError } = await admin.from("academy_outbox_events")
    .insert({
      workspace_id: workspace.id,
      event_type: "free_class.requested",
      aggregate_type: "free_class_booking",
      aggregate_id: booking.id,
      dedupe_key: `free_class_booking:${booking.id}`,
      payload: eventPayload,
      status: "queued",
      attempts: 0,
    })
    .select("id,aggregate_id,payload")
    .single();

  let sync = { ok: false };
  if (!outboxError && outboxEvent) {
    sync = await syncToCompasOne(admin, config, {
      id: outboxEvent.id,
      aggregate_id: outboxEvent.aggregate_id,
      payload: (outboxEvent.payload || {}) as Record<string, unknown>,
    });
  }

  retryPendingEvents(admin, config, outboxEvent?.id).catch(console.error);
  return json(201, { ok: true, booking, compas_one_synced: !!sync.ok }, origin);
});
