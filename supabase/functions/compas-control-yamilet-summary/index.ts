import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.2";

const WORKSPACE_SLUG = "yamilet-mes";
const MAX_COURSES = 500;
const COURSE_PAGE_SIZE = 100;
const ENROLLMENT_STATES = ["active", "paused", "completed", "cancelled"] as const;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function secretMatches(value: string, expected: string): Promise<boolean> {
  if (value.length < 32 || expected.length < 32) return false;
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(value)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const actual = new Uint8Array(a);
  const target = new Uint8Array(b);
  let difference = 0;
  for (let i = 0; i < actual.length; i++) difference |= actual[i] ^ target[i];
  return difference === 0;
}

export async function handleEnrollmentSummary(
  req: Request,
  env: (name: string) => string | undefined = (name) => Deno.env.get(name),
  makeClient: typeof createClient = createClient,
): Promise<Response> {
  if (req.method !== "GET") return json(405, { error: "method_not_allowed" });
  // Deliberately no browser/CORS integration. Only a private server caller.
  if (req.headers.get("Origin")) return json(403, { error: "browser_not_allowed" });

  const secret = env("COMPAS_CONTROL_YAMILET_METRICS_TOKEN") ?? "";
  const auth = req.headers.get("Authorization") ?? "";
  const match = /^Bearer ([A-Za-z0-9._~+\/-]+={0,2})$/.exec(auth);
  if (!secret || !match || !(await secretMatches(match[1], secret))) {
    return json(401, { error: "unauthorized" });
  }
  const url = env("SUPABASE_URL");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json(503, { error: "server_not_configured" });

  const db = makeClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    const { data: workspace, error: workspaceError } = await db
      .from("workspaces")
      .select("id")
      .eq("slug", WORKSPACE_SLUG)
      .maybeSingle();
    if (workspaceError || !workspace) return json(503, { error: "workspace_unavailable" });

    const courseIds: string[] = [];
    for (let from = 0; from <= MAX_COURSES; from += COURSE_PAGE_SIZE) {
      const { data: courses, error: coursesError } = await db
        .from("courses")
        .select("id")
        .eq("workspace_id", workspace.id)
        .order("id", { ascending: true })
        .range(from, from + COURSE_PAGE_SIZE - 1);
      if (coursesError || !courses) return json(503, { error: "courses_unavailable" });
      if (from + courses.length > MAX_COURSES) {
        return json(503, { error: "course_limit_exceeded" });
      }
      courseIds.push(...courses.map((course) => String(course.id)));
      if (courses.length < COURSE_PAGE_SIZE) break;
    }

    const counts: Record<(typeof ENROLLMENT_STATES)[number], number> = {
      active: 0, paused: 0, completed: 0, cancelled: 0,
    };
    // Enrollment workspace is derived through courses; do not count unscoped enrollments.
    for (let start = 0; start < courseIds.length; start += COURSE_PAGE_SIZE) {
      const batch = courseIds.slice(start, start + COURSE_PAGE_SIZE);
      const results = await Promise.all(ENROLLMENT_STATES.map((status) =>
        db.from("enrollments")
          .select("id", { count: "exact", head: true })
          .in("course_id", batch)
          .eq("status", status)
      ));
      if (results.some((result) => result.error || result.count === null)) {
        return json(503, { error: "enrollment_counts_unavailable" });
      }
      ENROLLMENT_STATES.forEach((status, index) => {
        counts[status] += results[index].count ?? 0;
      });
    }

    return json(200, {
      schema_version: 1,
      workspace_slug: WORKSPACE_SLUG,
      checked_at: new Date().toISOString(),
      counts: {
        active: counts.active,
        paused: counts.paused,
        completed: counts.completed,
        revoked: counts.cancelled,
      },
    });
  } catch {
    return json(503, { error: "academy_unavailable" });
  }
}

if (import.meta.main) {
  Deno.serve((req) => handleEnrollmentSummary(req));
}
