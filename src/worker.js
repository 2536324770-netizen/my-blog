import { onRequest as guestbook } from '../functions/api/guestbook.js';
import { onRequest as site } from '../functions/api/site.js';

export default {
  async fetch(request, env) {
    const pathname = new URL(request.url).pathname;
    if (pathname === '/api/guestbook') {
      return guestbook({ request, env });
    }
    if (pathname === '/api/site-content' || pathname === '/api/site-auth') return site({ request, env });
    return env.ASSETS.fetch(request);
  },
};
