import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const jsonHeaders = { "Content-Type": "application/json" };

function corsHeaders(origin: string | null) {
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  const accepted = origin && allowed.includes(origin) ? origin : allowed[0] || "";
  return {
    "Access-Control-Allow-Origin": accepted,
    "Access-Control-Allow-Headers": "content-type, x-turnstile-token",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

async function verifyTurnstile(token: string | null, ip: string | null) {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) return true;
  if (!token) return false;

  const form = new FormData();
  form.set("secret", secret);
  form.set("response", token);
  if (ip) form.set("remoteip", ip);

  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
  });
  const data = await res.json();
  return data?.success === true;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...jsonHeaders, ...cors },
    });
  }

  try {
    const antiBotOk = await verifyTurnstile(
      req.headers.get("x-turnstile-token"),
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    );
    if (!antiBotOk) {
      return new Response(JSON.stringify({ error: "verification_failed" }), {
        status: 403,
        headers: { ...jsonHeaders, ...cors },
      });
    }

    const body = await req.json();
    const email = String(body?.email || "").trim().toLowerCase();
    const displayName = String(body?.display_name || "").trim().slice(0, 160);
    const phone = String(body?.phone || "").trim().slice(0, 40) || null;
    const locale = body?.locale === "it" ? "it" : "es";
    const consent = body?.consent === true;

    if (!email || email.length > 254 || !email.includes("@") || !consent) {
      return new Response(JSON.stringify({ error: "invalid_payload" }), {
        status: 400,
        headers: { ...jsonHeaders, ...cors },
      });
    }

    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const workspaceId = Deno.env.get("YAMILET_WORKSPACE_ID");
    if (!url || !serviceKey || !workspaceId) throw new Error("server_not_configured");

    const supabase = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: existing, error: findError } = await supabase
      .from("contacts")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("email", email)
      .maybeSingle();
    if (findError) throw findError;

    let contactId = existing?.id as string | undefined;
    const source = String(body?.source || "yamilet-landing").slice(0, 80);
    const metadata = {
      locale,
      form_type: String(body?.form_type || "newsletter").slice(0, 80),
      page_url: String(body?.page_url || "").slice(0, 500),
      utm_source: String(body?.utm_source || "").slice(0, 120),
      utm_medium: String(body?.utm_medium || "").slice(0, 120),
      utm_campaign: String(body?.utm_campaign || "").slice(0, 160),
      utm_content: String(body?.utm_content || "").slice(0, 160),
      utm_term: String(body?.utm_term || "").slice(0, 160),
      consent: true,
    };

    if (contactId) {
      const { error } = await supabase
        .from("contacts")
        .update({
          display_name: displayName || email,
          phone,
          source,
          notes: JSON.stringify(metadata),
          last_contact_at: new Date().toISOString(),
        })
        .eq("id", contactId)
        .eq("workspace_id", workspaceId);
      if (error) throw error;
    } else {
      const { data, error } = await supabase
        .from("contacts")
        .insert({
          workspace_id: workspaceId,
          display_name: displayName || email,
          email,
          phone,
          source,
          status: "active",
          notes: JSON.stringify(metadata),
        })
        .select("id")
        .single();
      if (error) throw error;
      contactId = data.id;
    }

    const eventId = crypto.randomUUID();
    await supabase.from("academy_integration_events").insert({
      provider_event_id: eventId,
      workspace_id: workspaceId,
      contact_id: contactId,
      event_type: "landing.lead.captured",
      source: "yamilet-landing",
      status: "processed",
      payload: metadata,
      attempts: 1,
      processed_at: new Date().toISOString(),
    });

    const compasEndpoint = Deno.env.get("COMPAS_ONE_LEAD_ENDPOINT");
    const compasKey = Deno.env.get("COMPAS_ONE_API_KEY");
    if (compasEndpoint && compasKey) {
      await fetch(compasEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${compasKey}` },
        body: JSON.stringify({
          source: "yamilet-landing",
          contact_id: contactId,
          email,
          display_name: displayName,
          phone,
          locale,
          ...metadata,
        }),
      }).catch(() => null);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...jsonHeaders, ...cors },
    });
  } catch (error) {
    console.error("capture-yamilet-lead", error);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { ...jsonHeaders, ...cors },
    });
  }
});
