const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

function respond(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}

function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return request.headers.get('Sec-Fetch-Site') !== 'cross-site';
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}

export async function adminAuthorized(request, env) {
  const expected = env.GUESTBOOK_ADMIN_PASSWORD;
  const supplied = request.headers.get('X-Guestbook-Password');
  if (!expected || !supplied || supplied.length > 256) return false;
  const encoder = new TextEncoder();
  const left = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(expected)));
  const right = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(supplied)));
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
  return difference === 0;
}

export async function clientKey(request, purpose) {
  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip) return null;
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(purpose + ':' + ip)));
  return Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function readBody(request) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 8192) throw new Error('too large');
  const text = await request.text();
  if (new TextEncoder().encode(text).length > 8192) throw new Error('too large');
  return JSON.parse(text);
}

export async function onRequest(context) {
  const { request, env } = context;
  if (!env.GUESTBOOK_DB) return respond({ error: '留言板数据库尚未配置' }, 503);
  if (request.method !== 'GET' && !sameOrigin(request)) return respond({ error: '请求来源不允许' }, 403);
  try {
    if (request.method === 'GET') {
      const rows = await env.GUESTBOOK_DB.prepare('SELECT id, author, content, created_at FROM guestbook ORDER BY created_at DESC LIMIT 200').all();
      return respond({ messages: rows.results || [] });
    }
    if (request.method === 'POST') {
      const data = await readBody(request);
      const author = typeof data.author === 'string' ? data.author.trim() : '';
      const content = typeof data.content === 'string' ? data.content.trim() : '';
      if (author.length > 40 || !content || content.length > 1000) return respond({ error: '昵称最多 40 字，留言需为 1–1000 字' }, 400);
      const key = await clientKey(request, 'guestbook-rate-v1');
      if (key) {
        const now = Math.floor(Date.now() / 1000);
        const limit = await env.GUESTBOOK_DB.prepare('INSERT INTO guestbook_rate_limits (client_key, last_post) VALUES (?, ?) ON CONFLICT(client_key) DO UPDATE SET last_post = excluded.last_post WHERE excluded.last_post - guestbook_rate_limits.last_post >= 15').bind(key, now).run();
        if (!limit.meta?.changes) return respond({ error: '发送太快，请稍等 15 秒后再试' }, 429);
      }
      const id = crypto.randomUUID();
      await env.GUESTBOOK_DB.prepare('INSERT INTO guestbook (id, author, content, created_at) VALUES (?, ?, ?, ?)').bind(id, author || '匿名访客', content, new Date().toISOString()).run();
      return respond({ ok: true }, 201);
    }
    if (request.method === 'PATCH' || request.method === 'DELETE') {
      if (!env.GUESTBOOK_ADMIN_PASSWORD) return respond({ error: '站长密码尚未配置' }, 503);
      const key = await clientKey(request, 'guestbook-admin-v1');
      if (key) {
        const now = Math.floor(Date.now() / 1000);
        const attempt = await env.GUESTBOOK_DB.prepare('INSERT INTO guestbook_admin_attempts (client_key, window_start, attempts) VALUES (?, ?, 1) ON CONFLICT(client_key) DO UPDATE SET window_start = CASE WHEN excluded.window_start - window_start >= 600 THEN excluded.window_start ELSE window_start END, attempts = CASE WHEN excluded.window_start - window_start >= 600 THEN 1 ELSE attempts + 1 END WHERE excluded.window_start - window_start >= 600 OR attempts < 10').bind(key, now).run();
        if (!attempt.meta?.changes) return respond({ error: '验证次数过多，请 10 分钟后重试' }, 429);
      }
      if (!await adminAuthorized(request, env)) return respond({ error: '站长密码不正确' }, 401);
      const data = await readBody(request);
      const id = typeof data.id === 'string' ? data.id : '';
      if (!/^[a-f0-9-]{36}$/i.test(id)) return respond({ error: '留言编号无效' }, 400);
      let result;
      if (request.method === 'DELETE') {
        result = await env.GUESTBOOK_DB.prepare('DELETE FROM guestbook WHERE id = ?').bind(id).run();
      } else {
        const content = typeof data.content === 'string' ? data.content.trim() : '';
        if (!content || content.length > 1000) return respond({ error: '留言需为 1–1000 字' }, 400);
        result = await env.GUESTBOOK_DB.prepare('UPDATE guestbook SET content = ? WHERE id = ?').bind(content, id).run();
      }
      return result.meta?.changes ? respond({ ok: true }) : respond({ error: '留言不存在' }, 404);
    }
    return respond({ error: '不支持此操作' }, 405);
  } catch (error) {
    if (error instanceof SyntaxError || error.message === 'too large') return respond({ error: '请求格式不正确' }, 400);
    return respond({ error: '留言服务暂时不可用，请稍后重试' }, 503);
  }
}
