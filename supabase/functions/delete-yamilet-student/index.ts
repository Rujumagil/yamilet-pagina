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

const uuid = (value: unknown) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value ?? ""));

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

  const { data: callerData, error: callerError } = await caller.auth.getUser();
  if (callerError || !callerData.user) return json(401, { error: "invalid_token" }, origin);
  const actorId = callerData.user.id;

  let payload: Record<string, unknown>;
  try { payload = await req.json(); } catch { return json(400, { error: "invalid_json" }, origin); }
  const targetUserId = String(payload.user_id ?? "").trim();
  if (!uuid(targetUserId)) return json(422, { error: "invalid_user" }, origin);
  if (targetUserId === actorId) return json(409, { error: "protected_user" }, origin);

  const { data: workspace, error: workspaceError } = await admin
    .from("workspaces")
    .select("id,slug")
    .eq("slug", "yamilet-mes")
    .single();
  if (workspaceError || !workspace) return json(500, { error: "workspace_not_found" }, origin);

  const [{ data: actorProfile }, { data: actorMember }] = await Promise.all([
    admin.from("profiles").select("role").eq("id", actorId).maybeSingle(),
    admin.from("workspace_members").select("role,status").eq("workspace_id", workspace.id).eq("user_id", actorId).maybeSingle(),
  ]);
  const authorized = actorProfile?.role === "admin" || (actorMember?.status === "active" && ["owner", "admin"].includes(actorMember.role));
  if (!authorized) return json(403, { error: "forbidden" }, origin);

  const [{ data: targetProfile }, { data: targetMember }, authResult] = await Promise.all([
    admin.from("profiles").select("id,email,full_name,role,status").eq("id", targetUserId).maybeSingle(),
    admin.from("workspace_members").select("role,status").eq("workspace_id", workspace.id).eq("user_id", targetUserId).maybeSingle(),
    admin.auth.admin.getUserById(targetUserId),
  ]);

  if (authResult.error || !authResult.data.user || !targetProfile) return json(404, { error: "user_not_found" }, origin);
  if (targetProfile.role === "admin" || (targetMember?.status === "active" && ["owner", "admin", "instructor"].includes(targetMember.role))) {
    return json(409, { error: "protected_user" }, origin);
  }

  const metadata = authResult.data.user.user_metadata || {};
  const academyTag = String(metadata.academy || "");

  const { data: targetEnrollments } = await admin.from("enrollments").select("course_id").eq("user_id", targetUserId);
  const courseIds = [...new Set((targetEnrollments || []).map((row: { course_id: string }) => row.course_id))];
  let targetWorkspaceEnrollment = false;
  let otherWorkspaceEnrollment = false;
  if (courseIds.length) {
    const { data: enrollmentCourses } = await admin.from("courses").select("id,workspace_id").in("id", courseIds);
    for (const course of enrollmentCourses || []) {
      if (course.workspace_id === workspace.id) targetWorkspaceEnrollment = true;
      else otherWorkspaceEnrollment = true;
    }
  }

  const [{ data: removedMarker }, { data: otherMemberships }, { data: ownedWorkspace }] = await Promise.all([
    admin.from("academy_removed_students").select("user_id").eq("workspace_id", workspace.id).eq("user_id", targetUserId).maybeSingle(),
    admin.from("workspace_members").select("workspace_id,role,status").eq("user_id", targetUserId).neq("workspace_id", workspace.id).eq("status", "active").limit(1),
    admin.from("workspaces").select("id").eq("created_by", targetUserId).limit(1).maybeSingle(),
  ]);

  const belongsToYamilet = targetWorkspaceEnrollment || !!removedMarker || academyTag === "yamilet" || academyTag === "yamilet-mes";
  if (!belongsToYamilet) return json(409, { error: "not_yamilet_student" }, origin);

  if (otherWorkspaceEnrollment || (otherMemberships && otherMemberships.length > 0) || ownedWorkspace) {
    return json(409, { error: "shared_account", message: "La cuenta también se utiliza fuera de Academia Yamilet. Retira solo su acceso a Yamilet." }, origin);
  }

  // Conservar registros históricos/administrativos permitiendo que queden sin usuario asociado.
  await Promise.all([
    admin.from("access_history").update({ performed_by: null }).eq("performed_by", targetUserId),
    admin.from("orders").update({ user_id: null }).eq("user_id", targetUserId),
    admin.from("products").update({ created_by: null }).eq("created_by", targetUserId),
    admin.from("student_access").update({ granted_by: null }).eq("granted_by", targetUserId),
  ]);

  const { error: deleteError } = await admin.auth.admin.deleteUser(targetUserId);
  if (deleteError) {
    console.error("delete-yamilet-student", deleteError);
    return json(500, { error: "delete_failed", detail: deleteError.message }, origin);
  }

  return json(200, {
    ok: true,
    deleted_user_id: targetUserId,
    deleted_email: targetProfile.email,
  }, origin);
});
