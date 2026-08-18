import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://www.yamiletperez.com",
  "https://yamiletperez.com",
  "https://rujumagil.github.io",
]);

function cors(origin: string | null) {
  const allowed = origin && allowedOrigins.has(origin) ? origin : "https://www.yamiletperez.com";
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
    headers: { ...cors(origin), "Content-Type": "application/json; charset=utf-8" },
  });
}

function academyRedirect(origin: string | null) {
  if (origin === "https://rujumagil.github.io") return "https://rujumagil.github.io/yamilet-pagina/academia/";
  if (origin === "https://yamiletperez.com") return "https://yamiletperez.com/academia/";
  return "https://www.yamiletperez.com/academia/";
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" }, origin);
  if (origin && !allowedOrigins.has(origin)) return json(403, { error: "origin_not_allowed" }, origin);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) return json(500, { error: "server_not_configured" }, origin);

  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return json(401, { error: "missing_token" }, origin);

  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) return json(401, { error: "invalid_token" }, origin);
  const actorId = userData.user.id;

  let payload: Record<string, unknown>;
  try { payload = await req.json(); } catch { return json(400, { error: "invalid_json" }, origin); }

  const email = String(payload.email ?? "").trim().toLowerCase();
  const fullName = String(payload.full_name ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
  const courseId = String(payload.course_id ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return json(422, { error: "invalid_email" }, origin);
  if (fullName.length < 2) return json(422, { error: "invalid_name" }, origin);
  if (!/^[0-9a-f-]{36}$/i.test(courseId)) return json(422, { error: "invalid_course" }, origin);

  const { data: workspace, error: wsError } = await admin.from("workspaces").select("id,slug").eq("slug", "yamilet-mes").single();
  if (wsError || !workspace) return json(500, { error: "workspace_not_found" }, origin);

  const [{ data: actorProfile }, { data: member }] = await Promise.all([
    admin.from("profiles").select("role").eq("id", actorId).maybeSingle(),
    admin.from("workspace_members").select("role,status").eq("workspace_id", workspace.id).eq("user_id", actorId).maybeSingle(),
  ]);
  const authorized = actorProfile?.role === "admin" || (member?.status === "active" && ["owner", "admin"].includes(member.role));
  if (!authorized) return json(403, { error: "forbidden" }, origin);

  const { data: course, error: courseError } = await admin.from("courses").select("id,title,workspace_id").eq("id", courseId).eq("workspace_id", workspace.id).maybeSingle();
  if (courseError || !course) return json(404, { error: "course_not_found" }, origin);

  let targetUserId: string | null = null;
  let newInvitation = false;

  const { data: existingProfile } = await admin.from("profiles").select("id,email,full_name").ilike("email", email).limit(1).maybeSingle();
  if (existingProfile?.id) {
    targetUserId = existingProfile.id;
    if (!existingProfile.full_name && fullName) await admin.from("profiles").update({ full_name: fullName }).eq("id", targetUserId);
  } else {
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName, academy: "yamilet-mes" },
      redirectTo: academyRedirect(origin),
    });
    if (inviteError || !invited.user) {
      console.error("invite-yamilet-student invite", inviteError);
      return json(409, { error: "invite_failed", detail: inviteError?.message || null }, origin);
    }
    targetUserId = invited.user.id;
    newInvitation = true;
    await admin.from("profiles").upsert({ id: targetUserId, email, full_name: fullName, role: "student", status: "active" }, { onConflict: "id" });
  }

  if (!targetUserId) return json(500, { error: "user_not_resolved" }, origin);

  const { data: enrollment, error: enrollmentError } = await admin.from("enrollments").upsert({
    user_id: targetUserId,
    course_id: courseId,
    status: "active",
    completed_at: null,
  }, { onConflict: "user_id,course_id" }).select("id,user_id,course_id,status,enrolled_at").single();
  if (enrollmentError || !enrollment) {
    console.error("invite-yamilet-student enrollment", enrollmentError);
    return json(500, { error: "enrollment_failed" }, origin);
  }

  const now = new Date().toISOString();
  const { data: previousInvite } = await admin.from("academy_student_invites")
    .select("id,status")
    .eq("workspace_id", workspace.id)
    .eq("course_id", courseId)
    .ilike("email", email)
    .neq("status", "cancelled")
    .limit(1)
    .maybeSingle();

  const inviteRecord = {
    workspace_id: workspace.id,
    course_id: courseId,
    email,
    full_name: fullName,
    user_id: targetUserId,
    status: newInvitation ? "sent" : "linked",
    invited_by: actorId,
    invited_at: now,
    last_sent_at: newInvitation ? now : null,
    accepted_at: newInvitation ? null : now,
    error_message: null,
  };

  if (previousInvite?.id) {
    await admin.from("academy_student_invites").update(inviteRecord).eq("id", previousInvite.id);
  } else {
    await admin.from("academy_student_invites").insert(inviteRecord);
  }

  return json(200, {
    ok: true,
    student: { user_id: targetUserId, email, full_name: fullName },
    course: { id: course.id, title: course.title },
    enrollment,
    invitation_sent: newInvitation,
    existing_account: !newInvitation,
  }, origin);
});
