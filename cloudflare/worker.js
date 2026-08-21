const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...headers,
  },
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

async function streamToken(request, env) {
  if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405, { allow: 'GET' });

  const token = bearerToken(request);
  if (!token) return json({ error: 'authentication_required' }, 401);

  const url = new URL(request.url);
  const lessonId = String(url.searchParams.get('lesson_id') || '').trim();
  if (!UUID_RE.test(lessonId)) return json({ error: 'invalid_lesson_id' }, 400);

  const user = await getAuthenticatedUser(env, token);
  if (!user?.id) return json({ error: 'invalid_session' }, 401);

  const lesson = await readSingle(
    env,
    'lessons',
    'id,module_id,stream_video_uid,stream_require_signed_urls',
    { id: `eq.${lessonId}` },
    token,
  );
  if (!lesson?.id || !lesson.stream_video_uid) return json({ error: 'video_not_available' }, 404);

  const module = await readSingle(env, 'modules', 'id,course_id', { id: `eq.${lesson.module_id}` }, token);
  if (!module?.course_id) return json({ error: 'course_not_found' }, 404);

  const enrollment = await readSingle(
    env,
    'enrollments',
    'id,status',
    {
      course_id: `eq.${module.course_id}`,
      user_id: `eq.${user.id}`,
      status: 'in.(active,completed)',
    },
    token,
  );

  if (!enrollment?.id) return json({ error: 'course_access_required' }, 403);

  if (!env.STREAM) return json({ error: 'stream_not_configured' }, 503);
  const signedToken = await env.STREAM.video(lesson.stream_video_uid).generateToken();
  if (!signedToken) return json({ error: 'token_generation_failed' }, 502);

  const customerCode = String(env.STREAM_CUSTOMER_CODE || '').trim();
  return json({
    lesson_id: lesson.id,
    token: signedToken,
    iframe_url: customerCode
      ? `https://customer-${customerCode}.cloudflarestream.com/${signedToken}/iframe`
      : null,
    expires_in: 3600,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
      if (url.pathname === '/api/stream-token') return await streamToken(request, env);
      if (url.pathname === '/api/health') return json({ ok: true, service: 'academia-yamilet', version: 'v28' });
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error('Academia Yamilet Worker', error);
      return json({ error: 'internal_error' }, 500);
    }
  },
};
