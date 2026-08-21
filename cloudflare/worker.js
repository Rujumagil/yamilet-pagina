const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...headers,
  },
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STREAM_UID_RE = /^[A-Za-z0-9_-]{16,128}$/;
const STAFF_ROLES = new Set(['owner', 'admin', 'instructor']);

function bearerToken(request) {
  const header = request.headers.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

async function supabaseFetch(env, path, token, init = {}) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) throw new Error('supabase_not_configured');
  return fetch(`${env.SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      authorization: `Bearer ${token}`,
      accept: 'application/json',
      ...(init.headers || {}),
    },
  });
}

async function getAuthenticatedUser(env, token) {
  const response = await supabaseFetch(env, '/auth/v1/user', token);
  if (!response.ok) return null;
  return response.json();
}

async function readSingle(env, table, select, filters, token) {
  const params = new URLSearchParams({ select, ...filters, limit: '1' });
  const response = await supabaseFetch(env, `/rest/v1/${table}?${params.toString()}`, token);
  if (!response.ok) return null;
  const rows = await response.json();
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function lessonContext(env, lessonId, token) {
  const lesson = await readSingle(
    env,
    'lessons',
    'id,module_id,stream_video_uid,stream_require_signed_urls,title',
    { id: `eq.${lessonId}` },
    token,
  );
  if (!lesson?.id) return null;

  const module = await readSingle(env, 'modules', 'id,course_id', { id: `eq.${lesson.module_id}` }, token);
  if (!module?.course_id) return null;

  const course = await readSingle(env, 'courses', 'id,workspace_id,title', { id: `eq.${module.course_id}` }, token);
  if (!course?.workspace_id) return null;

  const expectedWorkspaceId = String(env.ACADEMY_WORKSPACE_ID || '').trim();
  if (!UUID_RE.test(expectedWorkspaceId) || course.workspace_id !== expectedWorkspaceId) return null;

  return {
    lesson,
    module,
    course,
    workspace: {
      id: course.workspace_id,
      slug: String(env.ACADEMY_WORKSPACE_SLUG || 'yamilet-mes').trim(),
    },
  };
}

async function requireStaffForLesson(env, user, context, token) {
  const profile = await readSingle(env, 'profiles', 'id,role', { id: `eq.${user.id}` }, token);
  if (profile?.role === 'admin') return true;

  const member = await readSingle(
    env,
    'workspace_members',
    'role,status',
    {
      workspace_id: `eq.${context.course.workspace_id}`,
      user_id: `eq.${user.id}`,
      status: 'eq.active',
    },
    token,
  );

  return !!member && STAFF_ROLES.has(member.role);
}

async function streamToken(request, env) {
  if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405, { allow: 'GET' });

  const token = bearerToken(request);
  if (!token) return json({ error: 'authentication_required' }, 401);

  const url = new URL(request.url);
  const lessonId = String(url.searchParams.get('lesson_id') || '').trim();
  if (!UUID_RE.test(lessonId)) return json({ error: 'invalid_lesson_id' }, 400);

  const user = await getAuthenticatedUser(env, token);
  if (!user?.id) return json({ error: 'invalid_session' }, 401);

  const context = await lessonContext(env, lessonId, token);
  if (!context?.lesson?.stream_video_uid) return json({ error: 'video_not_available' }, 404);

  const enrollment = await readSingle(
    env,
    'enrollments',
    'id,status',
    {
      course_id: `eq.${context.course.id}`,
      user_id: `eq.${user.id}`,
      status: 'in.(active,completed)',
    },
    token,
  );

  if (!enrollment?.id) {
    const isStaff = await requireStaffForLesson(env, user, context, token);
    if (!isStaff) return json({ error: 'course_access_required' }, 403);
  }

  if (!env.STREAM) return json({ error: 'stream_not_configured' }, 503);
  const uid = String(context.lesson.stream_video_uid || '').trim();
  if (!STREAM_UID_RE.test(uid)) return json({ error: 'invalid_stream_uid' }, 400);

  const signedToken = await env.STREAM.video(uid).generateToken();
  if (!signedToken) return json({ error: 'token_generation_failed' }, 502);

  const customerCode = String(env.STREAM_CUSTOMER_CODE || '').trim();
  return json({
    lesson_id: context.lesson.id,
    token: signedToken,
    iframe_url: customerCode
      ? `https://customer-${customerCode}.cloudflarestream.com/${signedToken}/iframe`
      : null,
    expires_in: 3600,
  });
}

async function streamUpload(request, env) {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, { allow: 'POST' });

  const token = bearerToken(request);
  if (!token) return json({ error: 'authentication_required' }, 401);

  const user = await getAuthenticatedUser(env, token);
  if (!user?.id) return json({ error: 'invalid_session' }, 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const lessonId = String(body?.lesson_id || '').trim();
  if (!UUID_RE.test(lessonId)) return json({ error: 'invalid_lesson_id' }, 400);

  const context = await lessonContext(env, lessonId, token);
  if (!context) return json({ error: 'lesson_not_found_or_wrong_workspace' }, 404);

  if (!(await requireStaffForLesson(env, user, context, token))) {
    return json({ error: 'staff_access_required' }, 403);
  }

  if (!env.STREAM) return json({ error: 'stream_not_configured' }, 503);

  const requestedDuration = Number(body?.max_duration_seconds || 7200);
  const maxDurationSeconds = Math.max(60, Math.min(21600, Number.isFinite(requestedDuration) ? requestedDuration : 7200));
  const filename = String(body?.filename || 'video').trim().slice(0, 180);
  const courseTitle = String(context.course.title || '').trim().slice(0, 120);
  const lessonTitle = String(context.lesson.title || '').trim().slice(0, 160);

  const directUpload = await env.STREAM.createDirectUpload({
    maxDurationSeconds,
    creator: `yamilet:${user.id}`,
    requireSignedURLs: true,
    meta: {
      name: `YAMILET · ${courseTitle || 'Curso'} · ${lessonTitle || 'Lección'}`.slice(0, 240),
      project: 'yamilet',
      academy: 'yamilet',
      workspace_slug: context.workspace.slug,
      course_id: context.course.id,
      lesson_id: lessonId,
      course_title: courseTitle,
      lesson_title: lessonTitle,
      source_filename: filename,
    },
  });

  if (!directUpload?.uploadURL || !directUpload?.id) {
    return json({ error: 'direct_upload_failed' }, 502);
  }

  return json({
    lesson_id: lessonId,
    video_uid: directUpload.id,
    upload_url: directUpload.uploadURL,
    max_file_size_bytes: 200 * 1024 * 1024,
    require_signed_urls: true,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
      if (url.pathname === '/api/stream-token') return await streamToken(request, env);
      if (url.pathname === '/api/stream-upload') return await streamUpload(request, env);
      if (url.pathname === '/api/health') return json({ ok: true, service: 'academia-yamilet', version: 'v28' });
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error('Academia Yamilet Worker', error);
      return json({ error: 'internal_error' }, 500);
    }
  },
};
