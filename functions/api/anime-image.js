import { authorized } from './site.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });

export async function onRequest({ request, env }) {
  if (!env.GUESTBOOK_DB) return json({ error: '数据库尚未配置' }, 503);
  try {
    const db = env.GUESTBOOK_DB;
    await db.prepare('CREATE TABLE IF NOT EXISTS anime_images (id TEXT PRIMARY KEY, image TEXT NOT NULL)').run();
    if (request.method === 'GET') {
      const id = new URL(request.url).searchParams.get('id') || '';
      if (!/^[a-f0-9-]{36}$/.test(id)) return json({ error: '图片不存在' }, 404);
      const row = await db.prepare('SELECT image FROM anime_images WHERE id = ?').bind(id).first();
      if (!row) return json({ error: '图片不存在' }, 404);
      const bytes = Uint8Array.from(atob(row.image), c => c.charCodeAt(0));
      return new Response(bytes, { headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' } });
    }
    if (request.method !== 'POST') return json({ error: '不支持此操作' }, 405);
    const auth = await authorized(request, env);
    if (!auth.ok) return json({ error: auth.error }, auth.status);
    const bytes = await request.arrayBuffer();
    if (bytes.byteLength > 600000) return json({ error: '图片过大，请换一张图片' }, 413);
    let body; try { body = JSON.parse(new TextDecoder().decode(bytes)); } catch (_) { return json({ error: '图片格式不正确' }, 400); }
    const match = /^data:image\/webp;base64,([A-Za-z0-9+/]+={0,2})$/.exec(body?.image || '');
    if (!match) return json({ error: '图片格式不正确' }, 400);
    let raw; try { raw = atob(match[1]); } catch (_) { return json({ error: '图片格式不正确' }, 400); }
    if (raw.slice(0, 4) !== 'RIFF' || raw.slice(8, 12) !== 'WEBP') return json({ error: '图片格式不正确' }, 400);
    const id = crypto.randomUUID();
    await db.prepare('INSERT INTO anime_images (id, image) VALUES (?, ?)').bind(id, match[1]).run();
    return json({ url: '/api/anime-image?id=' + id });
  } catch (_) { return json({ error: '图片服务暂时不可用，请稍后重试' }, 503); }
}
