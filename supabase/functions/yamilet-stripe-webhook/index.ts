import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const WORKSPACE_SLUG = "yamilet-mes";
const ALLOWED_EVENT_TYPES = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
  "charge.refunded"
]);

const encoder = new TextEncoder();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacHex(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function verifyStripeSignature(rawBody: string, header: string, secrets: string[]) {
  const parts = header.split(",").map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2) || "";
  const signatures = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  const ts = Number(timestamp);

  if (!Number.isFinite(ts) || !signatures.length || !secrets.length) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - ts) > 300) return false;

  const signedPayload = `${timestamp}.${rawBody}`;
  for (const secret of secrets) {
    const expected = await hmacHex(secret, signedPayload);
    if (signatures.some((signature) => timingSafeEqual(signature, expected))) return true;
  }
  return false;
}

function cleanEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase().slice(0, 320) : "";
}

function validUuid(value: unknown) {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "server_config_missing" }, 500);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const signatureHeader = request.headers.get("stripe-signature") || "";
  const rawBody = await request.text();

  const { data: secretRows, error: secretError } = await admin.rpc("get_yamilet_stripe_webhook_secrets");
  if (secretError) return json({ error: "webhook_config_unavailable" }, 500);

  const secrets = (Array.isArray(secretRows) ? secretRows : [])
    .map((row: any) => String(row.signing_secret || ""))
    .filter(Boolean);

  if (!(await verifyStripeSignature(rawBody, signatureHeader, secrets))) {
    return json({ error: "invalid_signature" }, 400);
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const eventId = String(event?.id || "");
  const eventType = String(event?.type || "");
  if (!eventId || !eventType) return json({ error: "invalid_event" }, 400);

  const { data: existingEvent } = await admin
    .from("academy_stripe_events")
    .select("event_id,status")
    .eq("event_id", eventId)
    .maybeSingle();

  if (existingEvent?.status === "processed" || existingEvent?.status === "ignored") {
    return json({ ok: true, duplicate: true });
  }

  await admin.from("academy_stripe_events").upsert({
    event_id: eventId,
    event_type: eventType,
    livemode: Boolean(event?.livemode),
    status: "processing",
    error_message: null,
    processed_at: null
  }, { onConflict: "event_id" });

  const markEvent = async (status: "processed" | "ignored" | "failed", errorMessage: string | null = null) => {
    await admin.from("academy_stripe_events").update({
      status,
      error_message: errorMessage,
      processed_at: new Date().toISOString()
    }).eq("event_id", eventId);
  };

  try {
    if (!ALLOWED_EVENT_TYPES.has(eventType)) {
      await markEvent("ignored");
      return json({ ok: true, ignored: true });
    }

    if (eventType === "checkout.session.expired") {
      await markEvent("ignored");
      return json({ ok: true, ignored: true });
    }

    if (eventType === "charge.refunded") {
      const charge = event?.data?.object || {};
      const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : "";
      if (paymentIntentId) {
        await admin.from("academy_purchases").update({
          payment_status: "refunded",
          fulfillment_status: "refunded",
          refunded_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }).eq("stripe_payment_intent_id", paymentIntentId);
      }
      await markEvent("processed");
      return json({ ok: true, refund_recorded: Boolean(paymentIntentId) });
    }

    const session = event?.data?.object || {};
    const sessionId = String(session.id || "");
    const metadata = session.metadata || {};
    const courseId = String(metadata.course_id || "");
    const buyerEmail = cleanEmail(session?.customer_details?.email || session?.customer_email);
    const clientReferenceId = String(session.client_reference_id || "");
    const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : "";
    const paymentLinkId = typeof session.payment_link === "string" ? session.payment_link : "";

    if (!sessionId || !validUuid(courseId) || !buyerEmail) {
      await markEvent("failed", "missing_session_course_or_email");
      return json({ error: "missing_session_course_or_email" }, 422);
    }

    const { data: workspace, error: workspaceError } = await admin
      .from("workspaces")
      .select("id,slug")
      .eq("slug", WORKSPACE_SLUG)
      .maybeSingle();

    if (workspaceError || !workspace?.id) throw workspaceError || new Error("workspace_not_found");

    const { data: course, error: courseError } = await admin
      .from("courses")
      .select("id,workspace_id,title")
      .eq("id", courseId)
      .eq("workspace_id", workspace.id)
      .maybeSingle();

    if (courseError || !course?.id) {
      await markEvent("failed", "course_not_found");
      return json({ error: "course_not_found" }, 422);
    }

    let matchedProfile: any = null;

    if (validUuid(clientReferenceId)) {
      const { data } = await admin
        .from("profiles")
        .select("id,email,status")
        .eq("id", clientReferenceId)
        .maybeSingle();

      if (data && cleanEmail(data.email) === buyerEmail) matchedProfile = data;
    }

    if (!matchedProfile) {
      const { data } = await admin
        .from("profiles")
        .select("id,email,status")
        .ilike("email", buyerEmail)
        .limit(1)
        .maybeSingle();
      matchedProfile = data || null;
    }

    const paymentSucceeded =
      eventType === "checkout.session.async_payment_succeeded" ||
      session.payment_status === "paid" ||
      session.payment_status === "no_payment_required";

    const paymentFailed = eventType === "checkout.session.async_payment_failed";

    let fulfillmentStatus = "pending";
    let fulfillmentError: string | null = null;

    if (paymentFailed) {
      fulfillmentStatus = "failed";
      fulfillmentError = "stripe_async_payment_failed";
    } else if (!paymentSucceeded) {
      fulfillmentStatus = matchedProfile ? "pending" : "needs_account";
      fulfillmentError = matchedProfile ? null : "profile_not_found";
    } else if (!matchedProfile || matchedProfile.status === "inactive") {
      fulfillmentStatus = "needs_account";
      fulfillmentError = "active_profile_not_found";
    } else {
      const { data: enrollment, error: enrollmentReadError } = await admin
        .from("enrollments")
        .select("id,status")
        .eq("user_id", matchedProfile.id)
        .eq("course_id", courseId)
        .maybeSingle();

      if (enrollmentReadError) throw enrollmentReadError;

      if (!enrollment) {
        const { error: enrollmentInsertError } = await admin.from("enrollments").insert({
          user_id: matchedProfile.id,
          course_id: courseId,
          status: "active",
          enrolled_at: new Date().toISOString(),
          completed_at: null
        });
        if (enrollmentInsertError) throw enrollmentInsertError;
      } else if (enrollment.status !== "completed" && enrollment.status !== "active") {
        const { error: enrollmentUpdateError } = await admin.from("enrollments").update({
          status: "active",
          completed_at: null
        }).eq("id", enrollment.id);
        if (enrollmentUpdateError) throw enrollmentUpdateError;
      }

      fulfillmentStatus = "granted";
    }

    const purchasePayload = {
      workspace_id: workspace.id,
      course_id: courseId,
      user_id: matchedProfile?.id || null,
      buyer_email: buyerEmail,
      stripe_account_id: typeof event.account === "string" ? event.account : null,
      stripe_event_id: eventId,
      stripe_checkout_session_id: sessionId,
      stripe_payment_intent_id: paymentIntentId || null,
      stripe_payment_link_id: paymentLinkId || null,
      client_reference_id: clientReferenceId || null,
      amount_total: Number.isFinite(Number(session.amount_total)) ? Number(session.amount_total) : null,
      currency: typeof session.currency === "string" ? session.currency : null,
      payment_status: paymentFailed
        ? "failed"
        : paymentSucceeded
          ? (session.payment_status === "no_payment_required" ? "no_payment_required" : "paid")
          : "unpaid",
      fulfillment_status: fulfillmentStatus,
      fulfillment_error: fulfillmentError,
      fulfilled_at: fulfillmentStatus === "granted" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    };

    const { error: purchaseError } = await admin.from("academy_purchases")
      .upsert(purchasePayload, { onConflict: "stripe_checkout_session_id" });

    if (purchaseError) throw purchaseError;

    await markEvent("processed");

    return json({
      ok: true,
      fulfilled: fulfillmentStatus === "granted",
      fulfillment_status: fulfillmentStatus
    });
  } catch (error: any) {
    const message = String(error?.message || "webhook_processing_failed").slice(0, 500);
    await markEvent("failed", message);
    console.error("yamilet-stripe-webhook", eventId, eventType, message);
    return json({ error: "webhook_processing_failed" }, 500);
  }
});
