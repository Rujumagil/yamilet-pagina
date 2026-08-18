import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://www.yamiletperez.com",
  "https://yamiletperez.com",
  "https://rujumagil.github.io",
]);

function cors(origin: string | null) {
  const allowed = origin && allowedOrigins.has(origin)
    ? origin
    : "https://www.yamiletperez.com";

  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(status: number, body: unknown, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors(origin),
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function short(value: unknown, max = 255) {
  return String(value ?? "").trim().slice(0, max) || null;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors(origin) });
  }

  if (req.method !== "POST") {
    return json(405, { error: "method_not_allowed" }, origin);
  }

  if (origin && !allowedOrigins.has(origin)) {
    return json(403, { error: "origin_not_allowed" }, origin);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: "invalid_json" }, origin);
  }

  // Honeypot: responde correctamente sin procesar bots evidentes.
  if (String(payload.company ?? "").trim()) {
    return json(200, { ok: true }, origin);
  }

  const fullName = String(payload.full_name ?? payload.name ?? "")
    .trim()
    .replace(/\s+/g, " ");
  const email = String(payload.email ?? "").trim().toLowerCase();
  const bookingDate = String(payload.booking_date ?? payload.date ?? "").trim();
  const locale = String(payload.locale ?? "es").trim() === "it" ? "it" : "es";
  const pageUrl = short(payload.page_url, 1000);

  if (fullName.length < 2 || fullName.length > 120) {
    return json(422, { error: "invalid_name" }, origin);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return json(422, { error: "invalid_email" }, origin);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(bookingDate)) {
    return json(422, { error: "invalid_date" }, origin);
  }

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

  if (!supabaseUrl || !serviceKey) {
    return json(500, { error: "server_not_configured" }, origin);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const { data: workspace, error: workspaceError } = await admin
    .from("workspaces")
    .select("id")
    .eq("slug", "yamilet-mes")
    .single();

  if (workspaceError || !workspace) {
    return json(500, { error: "workspace_not_found" }, origin);
  }

  const { data: previousBooking } = await admin
    .from("free_class_bookings")
    .select("id, booking_date, status")
    .eq("workspace_id", workspace.id)
    .eq("booking_date", bookingDate)
    .ilike("email", email)
    .neq("status", "cancelled")
    .limit(1)
    .maybeSingle();

  if (previousBooking) {
    return json(200, {
      ok: true,
      duplicate: true,
      booking: previousBooking,
    }, origin);
  }

  const source = short(payload.source, 120) ?? "yamilet-landing";
  const bookingPayload = {
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
  };

  const { data: booking, error: bookingError } = await admin
    .from("free_class_bookings")
    .insert(bookingPayload)
    .select("id, booking_date, status")
    .single();

  if (bookingError) {
    if (bookingError.code === "23505") {
      return json(200, { ok: true, duplicate: true }, origin);
    }

    console.error("book-free-class booking", bookingError);
    return json(500, { error: "booking_failed" }, origin);
  }

  // Outbox desacoplado: una integración externa puede consumir este evento
  // posteriormente. Un fallo en la cola NO bloquea la reservación académica.
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

  const { error: outboxError } = await admin
    .from("academy_outbox_events")
    .insert({
      workspace_id: workspace.id,
      event_type: "free_class.requested",
      aggregate_type: "free_class_booking",
      aggregate_id: booking.id,
      dedupe_key: `free_class_booking:${booking.id}`,
      payload: eventPayload,
      status: "queued",
    });

  if (outboxError) {
    console.error("book-free-class outbox", outboxError);
  }

  return json(201, { ok: true, booking }, origin);
});
