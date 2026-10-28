import { onRequest as guestbook } from '../functions/api/guestbook.js';

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname === '/api/guestbook') {
      return guestbook({ request, env });
    }
    return env.ASSETS.fetch(request);
  },
};
