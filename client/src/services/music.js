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

/**
 * dose-1.76 / dose-1.77: client-side positive integer id guard (same bar as
 * server toPositiveInt). Reject NaN/0/negative/non-integer before hitting
 * /songs/:id, stream-url, playlists, rooms, similar so we never mint a
 * request the server would 400/401.
 */
function toPositiveId(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;
  return n;
}

/**
 * dose-1.78: non-negative integer duration (seconds) matching server
 * recordListening bar (0..7200). Reject NaN/negative/non-integer/out-of-range
 * before POST so we never send junk the controller would 400.
 */
function toListeningDuration(value) {
  if (value == null || value === '') return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > 7200) return null;
  return n;
}

/**
 * dose-1.79: positive integer songCount for AI playlist (same bar as server
 * toPositiveInt / DEFAULT_AI_PLAYLIST_SIZE path). Reject NaN/0/negative/
 * non-integer before POST so we never send junk the controller would 400.
 * When omitted/null/empty, leave undefined so server applies its default.
 */
function toSongCount(value) {
  if (value == null || value === '') return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;
  return n;
}

/**
 * dose-1.80: normalize updatePlaybackState payload so currentSongId is either
 * null (clear) or a positive int (same bar as server toPositiveInt). Reject
 * NaN/0/negative/non-integer before POST. Other fields pass through; server
 * still defense-in-depths position/volume/speed/isPlaying.
 */
function normalizePlaybackState(state) {
  if (!state || typeof state !== 'object') return state;
  const out = { ...state };
  if (Object.prototype.hasOwnProperty.call(out, 'currentSongId')) {
    if (out.currentSongId == null) {
      out.currentSongId = null;
    } else {
      const sid = toPositiveId(out.currentSongId);
      if (sid == null) return null; // signal invalid
      out.currentSongId = sid;
    }
  }
  return out;
}

export const musicService = {
  getSongs: (params) => api.get('/songs', { params }).then(r => r.data),
  getMySongs: (params) => api.get('/songs/mine', { params }).then(r => r.data),
  // Controller returns { song }; unwrap so callers (hydrate, detail) get the row.
  getSong: (id) => {
    const sid = toPositiveId(id);
    if (sid == null) return Promise.reject(new Error('Invalid song id'));
    return api.get(`/songs/${sid}`).then((r) => {
      const data = r.data;
      if (data && data.song && typeof data.song === 'object') return data.song;
      return data;
    });
  },
  getGenres: () => api.get('/songs/genres').then(r => r.data),
  getStreamUrl: (id) => {
    const sid = toPositiveId(id);
    if (sid == null) return Promise.reject(new Error('Invalid song id'));
    return api.get(`/songs/${sid}/stream-url`).then((r) => {
      const data = r.data || {};
      return { ...data, url: resolveStreamUrl(data.url) };
    });
  },
  uploadSong: (formData) => api.post('/songs/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data),
  recordListening: (songId, duration) => {
    const sid = toPositiveId(songId);
    if (sid == null) return Promise.reject(new Error('Invalid song id'));
    const dur = toListeningDuration(duration);
    if (dur == null) return Promise.reject(new Error('Invalid duration'));
    return api.post('/songs/record-listening', { songId: sid, duration: dur }).then(r => r.data);
  },

  getPlaylists: () => api.get('/playlists').then(r => r.data),
  getPlaylist: (id) => {
    const pid = toPositiveId(id);
    if (pid == null) return Promise.reject(new Error('Invalid playlist id'));
    return api.get(`/playlists/${pid}`).then(r => r.data);
  },
  createPlaylist: (data) => api.post('/playlists', data).then(r => r.data),
  addToPlaylist: (playlistId, songId) => {
    const pid = toPositiveId(playlistId);
    const sid = toPositiveId(songId);
    if (pid == null) return Promise.reject(new Error('Invalid playlist id'));
    if (sid == null) return Promise.reject(new Error('Invalid song id'));
    return api.post('/playlists/add-song', { playlistId: pid, songId: sid }).then(r => r.data);
  },
  removeFromPlaylist: (playlistId, songId) => {
    const pid = toPositiveId(playlistId);
    const sid = toPositiveId(songId);
    if (pid == null) return Promise.reject(new Error('Invalid playlist id'));
    if (sid == null) return Promise.reject(new Error('Invalid song id'));
    return api.delete(`/playlists/${pid}/songs/${sid}`).then(r => r.data);
  },
  reorderPlaylist: (playlistId, songIds) => {
    const pid = toPositiveId(playlistId);
    if (pid == null) return Promise.reject(new Error('Invalid playlist id'));
    // dose-1.79: normalize songIds to positive ints client-side (same bar as
    // server reorderPlaylistSongs) so we never POST junk the controller 400s.
    if (!Array.isArray(songIds) || songIds.length === 0) {
      return Promise.reject(new Error('Invalid songIds'));
    }
    const normalized = songIds.map((x) => toPositiveId(x)).filter((n) => n != null);
    if (normalized.length !== songIds.length) {
      return Promise.reject(new Error('Invalid song id in songIds'));
    }
    return api.put(`/playlists/${pid}/reorder`, { songIds: normalized }).then((r) => r.data);
  },
  deletePlaylist: (id) => {
    const pid = toPositiveId(id);
    if (pid == null) return Promise.reject(new Error('Invalid playlist id'));
    return api.delete(`/playlists/${pid}`).then(r => r.data);
  },
  generateAIPlaylist: (prompt, name, songCount) => {
    // dose-1.79: positive-int bar on songCount before POST (server rejects
    // NaN/0/negative/non-integer with 400; omit when unset so default applies).
    const count = toSongCount(songCount);
    if (count === null) return Promise.reject(new Error('Invalid songCount'));
    const body = { prompt, name };
    if (count !== undefined) body.songCount = count;
    return api.post('/playlists/generate-ai', body).then(r => r.data);
  },

  // Controller returns { state: row | null }; unwrap so hydrate sees the row (or null).
  getPlaybackState: () =>
    api.get('/playback/state').then((r) => {
      const data = r.data;
      if (data && Object.prototype.hasOwnProperty.call(data, 'state')) return data.state;
      return data;
    }),
  updatePlaybackState: (state) => {
    // dose-1.80: normalize currentSongId to positive int or null before POST
    // (same bar as server updatePlaybackState / toPositiveInt).
    const normalized = normalizePlaybackState(state);
    if (normalized === null) return Promise.reject(new Error('Invalid currentSongId'));
    return api.post('/playback/state', normalized || {}).then(r => r.data);
  },

  getRooms: () => api.get('/rooms').then(r => r.data),
  getRoom: (id) => {
    const rid = toPositiveId(id);
    if (rid == null) return Promise.reject(new Error('Invalid room id'));
    return api.get(`/rooms/${rid}`).then(r => r.data);
  },
  createRoom: (data) => api.post('/rooms', data).then(r => r.data),
  joinRoom: (id) => {
    const rid = toPositiveId(id);
    if (rid == null) return Promise.reject(new Error('Invalid room id'));
    return api.post(`/rooms/${rid}/join`).then(r => r.data);
  },
  leaveRoom: (id) => {
    const rid = toPositiveId(id);
    if (rid == null) return Promise.reject(new Error('Invalid room id'));
    return api.post(`/rooms/${rid}/leave`).then(r => r.data);
  },
  deleteRoom: (id) => {
    const rid = toPositiveId(id);
    if (rid == null) return Promise.reject(new Error('Invalid room id'));
    return api.delete(`/rooms/${rid}`).then(r => r.data);
  },

  getAIStatus: () => api.get('/ai/status').then(r => r.data),
  getRecommendations: (params) => api.get('/ai/recommendations', { params }).then(r => r.data),
  getDailyMix: () => api.get('/ai/daily-mix').then(r => r.data),
  getSimilarSongs: (songId) => {
    const sid = toPositiveId(songId);
    if (sid == null) return Promise.reject(new Error('Invalid song id'));
    return api.get(`/ai/similar/${sid}`).then(r => r.data);
  },
  detectMood: (input) => api.post('/ai/mood/detect', { input }).then(r => r.data),
  search: (q) => api.get('/ai/search', { params: { q } }).then(r => r.data),
  chat: (message, history, context) => api.post('/ai/chat', { message, conversationHistory: history, context }).then(r => r.data),
};
