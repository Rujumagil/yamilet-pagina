import { assertEquals, assert } from "jsr:@std/assert@1.0.18";
import { handleEnrollmentSummary } from "../index.ts";

const token = "test_yamilet_super_secret_abcdefghijklmnopqrstuvwxyz";
const base = "https://example.invalid/summary";
const env = (name: string) => ({
  COMPAS_CONTROL_YAMILET_METRICS_TOKEN: token,
  SUPABASE_URL: "https://fake.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
} as Record<string, string>)[name]);

Deno.test("does not query the database when the caller has no token", async () => {
  const response = await handleEnrollmentSummary(new Request(base), env, (() => {
    throw new Error("must not instantiate a database client");
  }) as never);
  assertEquals(response.status, 401);
});

Deno.test("rejects browsers even when a token is present", async () => {
  const response = await handleEnrollmentSummary(new Request(base, {
    headers: { Authorization: `Bearer ${token}`, Origin: "https://example.com" },
  }), env);
  assertEquals(response.status, 403);
});

Deno.test("rejects an invalid token and non-GET methods", async () => {
  const wrong = await handleEnrollmentSummary(new Request(base, {
    headers: { Authorization: "Bearer wrong_token" },
  }), env);
  assertEquals(wrong.status, 401);
  const post = await handleEnrollmentSummary(new Request(base, {
    method: "POST", headers: { Authorization: `Bearer ${token}` },
  }), env);
  assertEquals(post.status, 405);
});

Deno.test("counts only enrollments whose courses belong to Yamilet", async () => {
  const requestedIds: string[][] = [];
  function fakeClient() {
    return {
      from(table: string) {
        let state = "";
        let courseIds: string[] = [];
        return {
          select() { return this; },
          eq(column: string, value: string) {
            if (column === "status") state = value;
            if (table === "workspaces") assertEquals(value, "yamilet-mes");
            if (table === "courses" && column === "workspace_id") assertEquals(value, "ws-yamilet");
            return this;
          },
          in(column: string, values: string[]) {
            assertEquals(column, "course_id");
            courseIds = values;
            requestedIds.push(values);
            return this;
          },
          order() { return this; },
          range() { return Promise.resolve({ data: [{ id: "course-yamilet" }], error: null }); },
          maybeSingle() { return Promise.resolve({ data: { id: "ws-yamilet" }, error: null }); },
          then(resolve: (value: { count: number; error: null }) => void) {
            assertEquals(table, "enrollments");
            assertEquals(courseIds, ["course-yamilet"]);
            const fixture: Record<string, number> = { active: 3, paused: 1, completed: 2, cancelled: 4 };
            resolve({ count: fixture[state], error: null });
          },
        };
      },
    };
  }
  const response = await handleEnrollmentSummary(new Request(base, {
    headers: { Authorization: `Bearer ${token}` },
  }), env, fakeClient as never);
  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.schema_version, 1);
  assertEquals(body.workspace_slug, "yamilet-mes");
  assertEquals(body.counts, { active: 3, paused: 1, completed: 2, revoked: 4 });
  assertEquals(requestedIds.length, 4);
  assert(response.headers.get("cache-control")?.includes("no-store"));
});

Deno.test("never returns partial metrics after an enrollment query fails", async () => {
  function fakeClient() {
    return {
      from(table: string) {
        return {
          select() { return this; },
          eq() { return this; },
          in() { return this; },
          order() { return this; },
          range() { return Promise.resolve({ data: [{ id: "course-yamilet" }], error: null }); },
          maybeSingle() { return Promise.resolve({ data: { id: "ws-yamilet" }, error: null }); },
          then(resolve: (value: { count: null; error: { message: string } }) => void) {
            assertEquals(table, "enrollments");
            resolve({ count: null, error: { message: "denied" } });
          },
        };
      },
    };
  }
  const response = await handleEnrollmentSummary(new Request(base, {
    headers: { Authorization: `Bearer ${token}` },
  }), env, fakeClient as never);
  assertEquals(response.status, 503);
  assertEquals((await response.json()).error, "enrollment_counts_unavailable");
});
