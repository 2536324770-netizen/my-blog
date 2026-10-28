import { adminAuthorized, clientKey } from './guestbook.js';

const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers });

async function authorized(request, env) {
  if (!env.GUESTBOOK_ADMIN_PASSWORD) return { ok: false, status: 503, error: '站长密码尚未设置' };
  const origin = request.headers.get('Origin');
  try { if (!origin || new URL(origin).origin !== new URL(request.url).origin) return { ok: false, status: 403, error: '请求来源不允许' }; }
  catch (_) { return { ok: false, status: 403, error: '请求来源不允许' }; }
  const key = await clientKey(request, 'site-admin-v1');
  if (key) {
    const now = Math.floor(Date.now() / 1000);
    const attempt = await env.GUESTBOOK_DB.prepare('INSERT INTO guestbook_admin_attempts (client_key, window_start, attempts) VALUES (?, ?, 1) ON CONFLICT(client_key) DO UPDATE SET window_start = CASE WHEN excluded.window_start - window_start >= 600 THEN excluded.window_start ELSE window_start END, attempts = CASE WHEN excluded.window_start - window_start >= 600 THEN 1 ELSE attempts + 1 END WHERE excluded.window_start - window_start >= 600 OR attempts < 10').bind(key, now).run();
    if (!attempt.meta?.changes) return { ok: false, status: 429, error: '验证次数过多，请 10 分钟后重试' };
  }
  const ok = await adminAuthorized(request, env);
  if (ok && key) await env.GUESTBOOK_DB.prepare('DELETE FROM guestbook_admin_attempts WHERE client_key = ?').bind(key).run();
  return ok ? { ok: true } : { ok: false, status: 401, error: '站长密码不正确' };
}

async function ensureTable(db) {
  await db.prepare('CREATE TABLE IF NOT EXISTS site_content (id INTEGER PRIMARY KEY CHECK (id = 1), revision INTEGER NOT NULL, content TEXT NOT NULL, updated_at TEXT NOT NULL)').run();
}

export async function onRequest({ request, env }) {
  if (!env.GUESTBOOK_DB) return reply({ error: '数据库尚未配置' }, 503);
  try {
    const url = new URL(request.url);
    if (url.pathname === '/api/site-auth') {
      if (request.method !== 'POST') return reply({ error: '不支持此操作' }, 405);
      const auth = await authorized(request, env);
      return auth.ok ? reply({ ok: true }) : reply({ error: auth.error }, auth.status);
    }
    if (url.pathname !== '/api/site-content') return reply({ error: '未找到接口' }, 404);
    await ensureTable(env.GUESTBOOK_DB);
    if (request.method === 'GET') {
      const row = await env.GUESTBOOK_DB.prepare('SELECT revision, content, updated_at FROM site_content WHERE id = 1').first();
      return row ? reply({ initialized: true, revision: row.revision, data: JSON.parse(row.content), updatedAt: row.updated_at }) : reply({ initialized: false, revision: 0 });
    }
    if (request.method !== 'PUT') return reply({ error: '不支持此操作' }, 405);
    const auth = await authorized(request, env);
    if (!auth.ok) return reply({ error: auth.error }, auth.status);
    const bytes = await request.arrayBuffer();
    if (bytes.byteLength > 900000) return reply({ error: '内容过大，请缩小后再保存' }, 413);
    let body; try { body = JSON.parse(new TextDecoder().decode(bytes)); } catch (_) { return reply({ error: '请求格式错误' }, 400); }
    const data = body?.data;
    if (!Number.isSafeInteger(body?.revision) || body.revision < 0 || !data || !Array.isArray(data.posts) || !Array.isArray(data.friendLinks) || !Array.isArray(data.projects) || !Array.isArray(data.socialLinks) || !data.siteSettings || typeof data.siteSettings !== 'object' || Array.isArray(data.siteSettings)) return reply({ error: '网站数据格式错误' }, 400);
    const content = JSON.stringify({ posts: data.posts, friendLinks: data.friendLinks, projects: data.projects, socialLinks: data.socialLinks, siteSettings: data.siteSettings });
    const now = new Date().toISOString();
    let result;
    if (body.revision === 0) {
      result = await env.GUESTBOOK_DB.prepare('INSERT OR IGNORE INTO site_content (id, revision, content, updated_at) VALUES (1, 1, ?, ?)').bind(content, now).run();
    } else {
      result = await env.GUESTBOOK_DB.prepare('UPDATE site_content SET revision = revision + 1, content = ?, updated_at = ? WHERE id = 1 AND revision = ?').bind(content, now, body.revision).run();
    }
    if (!result.meta?.changes) return reply({ error: '网站内容已在其他地方更新，请先备份本地修改并刷新' }, 409);
    return reply({ ok: true, revision: body.revision + 1, updatedAt: now });
  } catch (_) { return reply({ error: '云端服务暂时不可用，请稍后重试' }, 503); }
}
