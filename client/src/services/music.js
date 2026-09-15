import api from './api';

/**
 * stream-url returns a path like `/api/songs/:id/stream?t=…`.
 * When REACT_APP_API_URL is an absolute origin (dev without proxy),
 * resolve against that host so <audio src> hits the Express server.
 */
function resolveStreamUrl(url) {
  if (!url || typeof url !== 'string') return url;
  if (!url.startsWith('/')) return url;
  const base = process.env.REACT_APP_API_URL || '';
  if (!base.startsWith('http')) return url;
  try {
    const origin = new URL(base).origin;
    return `${origin}${url}`;
  } catch {
    return url;
  }
}
