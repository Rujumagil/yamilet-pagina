import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FEED_URL = "https://qwxydjotwhniahaovrff.supabase.co/functions/v1/yamilet-fly-feed";
const WORKSPACE_SLUG = "yamilet-mes";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function clean(value: unknown, max = 1000) {
  return String(value ?? "").trim().slice(0, max);
}

function normalizeEmail(value: unknown) {
  const email = clean(value, 254).toLowerCase().replace(/\s+/g, "");
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function normalizePhone(value: unknown) {
  const raw = clean(value, 80);
  if (!raw) return null;
  const plus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  return plus ? `+${digits}` : digits;
}

function asWhatsapp(value: string | null) {
  return value && /^\+[1-9][0-9]{6,14}$/.test(value) ? value : null;
}

function maxDate(a: unknown, b: unknown) {
  const values = [a, b]
    .map((v) => clean(v, 64))
    .filter((v) => v && !Number.isNaN(Date.parse(v)))
    .sort((x, y) => Date.parse(y) - Date.parse(x));
  return values[0] || null;
}

function localStatus(remoteStatus: unknown, remoteStage: unknown) {
  const status = clean(remoteStatus, 40);
  const stage = clean(remoteStage, 40);
  if (stage === "student") return "student";
  if (stage === "customer" || status === "customer") return "customer";
  if (status === "inactive" || status === "archived") return "inactive";
  if (status === "lead") return "lead";
  return "prospect";
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json(401, { error: "missing_token" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json(500, { error: "server_not_configured" });

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await admin.auth.getUser(token);
  const user = authData?.user;
  if (authError || !user) return json(401, { error: "invalid_token" });

  const { data: workspace, error: workspaceError } = await admin
    .from("workspaces")
    .select("id")
    .eq("slug", WORKSPACE_SLUG)
    .single();
  if (workspaceError || !workspace) return json(500, { error: "workspace_not_found" });

  const { data: membership } = await admin
    .from("workspace_members")
    .select("role,status")
    .eq("workspace_id", workspace.id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!membership || !["owner", "admin", "manager"].includes(String(membership.role || ""))) {
    return json(403, { error: "forbidden" });
  }

  const { data: integration, error: integrationError } = await admin
    .from("academy_integration_settings")
    .select("secret_key,enabled")
    .eq("provider", "compas_one")
    .maybeSingle();

  if (integrationError || !integration?.enabled || !integration.secret_key) {
    return json(503, { error: "compas_integration_not_configured" });
  }

  let feed: any;
  try {
    const response = await fetch(FEED_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-yamilet-integration-key": integration.secret_key,
      },
      body: JSON.stringify({ limit: 500 }),
      signal: AbortSignal.timeout(12000),
    });
    feed = await response.json().catch(() => null);
    if (!response.ok || !feed?.ok) {
      throw new Error(`feed_${response.status}:${String(feed?.error || "sync_failed")}`);
    }
  } catch (error) {
    console.error("YAMILET_FLY_FEED_ERROR", error);
    return json(502, { error: "compas_feed_unavailable" });
  }

  let created = 0;
  let updated = 0;
  let channels = 0;
  const now = new Date().toISOString();

  for (const remote of Array.isArray(feed.contacts) ? feed.contacts : []) {
    const externalId = clean(remote.id, 64);
    if (!/^[0-9a-f-]{36}$/i.test(externalId)) continue;

    const email = normalizeEmail(remote.email);
    const phone = normalizePhone(remote.phone);
    const whatsapp = asWhatsapp(phone);
    const displayName = clean(remote.display_name, 160) || email || phone || "Contacto Fly";
    const conversation = remote.conversation && typeof remote.conversation === "object"
      ? remote.conversation
      : null;
    const followUp = remote.follow_up && typeof remote.follow_up === "object"
      ? remote.follow_up
      : null;

    let existing: any = null;

    const byExternal = await admin
      .from("contacts")
      .select("id,source,status,last_contact_at,email,phone,whatsapp_e164")
      .eq("workspace_id", workspace.id)
      .eq("compas_one_contact_id", externalId)
      .limit(1)
      .maybeSingle();
    existing = byExternal.data || null;

    if (!existing && email) {
      const byEmail = await admin
        .from("contacts")
        .select("id,source,status,last_contact_at,email,phone,whatsapp_e164")
        .eq("workspace_id", workspace.id)
        .ilike("email", email)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      existing = byEmail.data || null;
    }

    if (!existing && phone) {
      const byPhone = await admin
        .from("contacts")
        .select("id,source,status,last_contact_at,email,phone,whatsapp_e164")
        .eq("workspace_id", workspace.id)
        .eq("phone", phone)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      existing = byPhone.data || null;
    }

    const remoteLast = maxDate(
      remote.last_contact_at || remote.updated_at,
      conversation?.last_message_at || conversation?.updated_at,
    );

    const values: Record<string, unknown> = {
      display_name: displayName,
      email: email || existing?.email || null,
      phone: phone || existing?.phone || null,
      whatsapp_e164: whatsapp || existing?.whatsapp_e164 || null,
      status: existing?.status === "student" ? "student" : localStatus(remote.status, remote.stage),
      source: existing?.source || (remote.source === "web_chat" ? "fly-web-chat" : clean(remote.source, 80) || "compas-fly"),
      last_contact_at: maxDate(existing?.last_contact_at, remoteLast),
      compas_one_contact_id: externalId,
      fly_stage: clean(remote.ai_agent_stage || remote.stage, 80) || null,
      fly_lead_score: Number.isFinite(Number(remote.ai_lead_score)) ? Math.max(0, Math.min(100, Number(remote.ai_lead_score))) : null,
      fly_lead_temperature: ["cold", "warm", "hot"].includes(clean(remote.ai_lead_temperature, 20))
        ? clean(remote.ai_lead_temperature, 20)
        : null,
      fly_last_intent: clean(remote.ai_last_intent, 160) || null,
      fly_service_interest: clean(remote.ai_service_interest, 500) || null,
      fly_need: clean(remote.ai_need, 1000) || null,
      fly_next_action: clean(remote.ai_next_action, 1000) || null,
      fly_summary: clean(remote.ai_summary, 3000) || null,
      fly_last_analyzed_at: clean(remote.ai_last_analyzed_at, 64) || null,
      fly_conversation_id: conversation?.id || null,
      fly_last_conversation_at: conversation?.last_message_at || conversation?.updated_at || null,
      fly_last_message_preview: clean(conversation?.last_message_preview, 500) || null,
      fly_follow_up_id: followUp?.id || null,
      fly_follow_up_title: clean(followUp?.title, 300) || null,
      fly_follow_up_status: clean(followUp?.status, 80) || null,
      fly_follow_up_at: followUp?.scheduled_at || null,
      fly_synced_at: now,
      updated_at: now,
    };

    let contactId: string;
    if (existing?.id) {
      const { error } = await admin
        .from("contacts")
        .update(values)
        .eq("id", existing.id)
        .eq("workspace_id", workspace.id);
      if (error) {
        console.error("YAMILET_FLY_CONTACT_UPDATE", { id: existing.id, message: error.message });
        continue;
      }
      contactId = existing.id;
      updated += 1;
    } else {
      const { data: inserted, error } = await admin
        .from("contacts")
        .insert({
          workspace_id: workspace.id,
          ...values,
          created_at: remote.created_at || now,
        })
        .select("id")
        .single();
      if (error || !inserted) {
        console.error("YAMILET_FLY_CONTACT_INSERT", { externalId, message: error?.message });
        continue;
      }
      contactId = inserted.id;
      created += 1;
    }

    if (email) {
      const { error } = await admin
        .from("contact_channels")
        .upsert({
          workspace_id: workspace.id,
          contact_id: contactId,
          channel: "email",
          value: email,
          external_id: externalId,
          is_primary: true,
          updated_at: now,
        }, { onConflict: "workspace_id,channel,value" });
      if (!error) channels += 1;
    }

    if (whatsapp) {
      const { error } = await admin
        .from("contact_channels")
        .upsert({
          workspace_id: workspace.id,
          contact_id: contactId,
          channel: "whatsapp",
          value: whatsapp,
          external_id: externalId,
          is_primary: true,
          updated_at: now,
        }, { onConflict: "workspace_id,channel,value" });
      if (!error) channels += 1;
    }
  }

  return json(200, {
    ok: true,
    created,
    updated,
    channels,
    received: Array.isArray(feed.contacts) ? feed.contacts.length : 0,
    synced_at: now,
  });
});