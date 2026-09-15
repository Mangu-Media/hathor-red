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

function toBoundedNumber(value, min, max) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < min || n > max) return null;
  return n;
}

function toStrictBoolean(value) {
  if (typeof value === 'boolean') return value;
  return null;
}

function toPitchShift(value) {
  if (value === null) return null;
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < -24 || n > 24) return null;
  return n;
}

function toStemsConfig(value) {
  if (value === null) return null;
  if (value == null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) return null;
  return value;
}

function normalizePlaybackState(state) {
  if (state == null || typeof state !== 'object') return null;
  const out = {};
  if (Object.prototype.hasOwnProperty.call(state, 'currentSongId')) {
    const id = state.currentSongId;
    if (id === null) out.currentSongId = null;
    else {
      const sid = toPositiveId(id);
      if (sid == null) return null;
      out.currentSongId = sid;
    }
  }
  if (Object.prototype.hasOwnProperty.call(state, 'position')) {
    const p = toBoundedNumber(state.position, 0, 7200);
    if (p == null) return null;
    out.position = p;
  }
  if (Object.prototype.hasOwnProperty.call(state, 'volume')) {
    const v = toBoundedNumber(state.volume, 0, 1);
    if (v == null) return null;
    out.volume = v;
  }
  if (Object.prototype.hasOwnProperty.call(state, 'playbackSpeed')) {
    const s = toBoundedNumber(state.playbackSpeed, 0.25, 4);
    if (s == null) return null;
    out.playbackSpeed = s;
  }
  if (Object.prototype.hasOwnProperty.call(state, 'isPlaying')) {
    const b = toStrictBoolean(state.isPlaying);
    if (b == null) return null;
    out.isPlaying = b;
  }
  if (Object.prototype.hasOwnProperty.call(state, 'pitchShift')) {
    const ps = toPitchShift(state.pitchShift);
    if (ps === undefined) return null;
    out.pitchShift = ps;
  }
  if (Object.prototype.hasOwnProperty.call(state, 'stemsConfig')) {
    const sc = toStemsConfig(state.stemsConfig);
    if (sc === undefined) return null;
    out.stemsConfig = sc;
  }
  return out;
}

/** Same list as server/config/constants.js ALLOWED_GENRES (dose-3.1). */
const ALLOWED_GENRES = [
  'Rock', 'Pop', 'Jazz', 'Classical', 'Hip Hop', 'Electronic',
  'R&B', 'Country', 'Metal', 'Indie', 'Blues', 'Folk', 'Ambient',
  'Reggae', 'Latin', 'Afrobeats', 'K-Pop', 'J-Pop', 'World',
  'Soul', 'Funk', 'Disco', 'Punk', 'House', 'Techno', 'Trance',
  'Dubstep', 'Trap', 'Drum and Bass', 'Gospel', 'Opera',
  'Soundtrack', 'New Age', 'Lo-Fi', 'Progressive Rock',
  'Alternative', 'Grunge', 'Ska', 'Bluegrass', 'Swing',
];

/** Resolve client genre string to canonical ALLOWED_GENRES entry (case-insensitive). */
function resolveAllowedGenre(raw) {
  if (raw == null || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  const match = ALLOWED_GENRES.find((g) => g.toLowerCase() === lower);
  return match || null;
}

function normalizeListParams(params) {
  if (params == null) return {};
  if (typeof params !== 'object') return null;
  const out = { ...params };
  if (Object.prototype.hasOwnProperty.call(out, 'limit')) {
    const n = toPositiveId(out.limit);
    if (n == null) return null;
    out.limit = Math.min(n, 100);
  }
  if (Object.prototype.hasOwnProperty.call(out, 'offset')) {
    const n = Number(out.offset);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return null;
    out.offset = n;
  }
  // dose-3.1: genre bar matching server resolveAllowedGenre — rewrite to
  // canonical casing or reject so Home filter never 400s the API.
  if (Object.prototype.hasOwnProperty.call(out, 'genre')) {
    if (out.genre == null || out.genre === '') {
      delete out.genre;
    } else {
      const resolved = resolveAllowedGenre(out.genre);
      if (resolved == null) return null;
      out.genre = resolved;
    }
  }
  // dose-3.2: search param bar for getSongs (server ILIKE title/artist/album).
  // Trim; empty clears; reject non-string or length > 200 so we never send
  // junk the controller would treat as a broad or expensive pattern.
  if (Object.prototype.hasOwnProperty.call(out, 'search')) {
    if (out.search == null || out.search === '') {
      delete out.search;
    } else if (typeof out.search !== 'string') {
      return null;
    } else {
      const trimmed = out.search.trim();
      if (!trimmed || trimmed.length > 200) return null;
      out.search = trimmed;
    }
  }
  return out;
}

function normalizeAiListParams(params) {
  if (params == null) return {};
  if (typeof params !== 'object') return null;
  const out = { ...params };
  if (Object.prototype.hasOwnProperty.call(out, 'limit')) {
    const n = toPositiveId(out.limit);
    if (n == null) return null;
    out.limit = Math.min(n, 50);
  }
  return out;
}

function normalizeCreateRoom(data) {
  if (data == null || typeof data !== 'object') return null;
  if (data.name == null || typeof data.name !== 'string') return null;
  const name = data.name.trim();
  if (!name) return null;
  const out = { name };
  if (Object.prototype.hasOwnProperty.call(data, 'maxListeners')) {
    const n = toPositiveId(data.maxListeners);
    if (n == null) return null;
    out.maxListeners = Math.min(n, 100);
  }
  if (Object.prototype.hasOwnProperty.call(data, 'isPublic')) {
    out.isPublic = data.isPublic !== false;
  }
  return out;
}

function normalizeCreatePlaylist(data) {
  if (data == null || typeof data !== 'object') return null;
  if (data.name == null || typeof data.name !== 'string') return null;
  const name = data.name.trim();
  if (!name) return null;
  const out = { name };
  if (Object.prototype.hasOwnProperty.call(data, 'isPublic')) {
    out.isPublic = data.isPublic !== false;
  }
  if (data.description != null && typeof data.description === 'string') {
    out.description = data.description.trim().slice(0, 500);
  }
  return out;
}

function normalizeGenerateAIPlaylist(prompt, name, songCount) {
  if (prompt == null || typeof prompt !== 'string') return null;
  const trimmedPrompt = prompt.trim();
  if (!trimmedPrompt) return null;
  const count = toSongCount(songCount);
  if (count === null) return null;
  const body = { prompt: trimmedPrompt };
  if (name != null && typeof name === 'string') {
    const trimmedName = name.trim();
    if (trimmedName) body.name = trimmedName;
  }
  if (count !== undefined) body.songCount = count;
  return body;
}

/**
 * dose-1.91: client-side FormData bars for song upload (same spirit as server
 * songUploadValidation). Require non-empty trimmed title + artist, duration
 * as positive int 1..7200 when present, and at least one File entry under
 * common keys (audio/file/song). Reject early so blank/junk never hits multer.
 * Returns the same FormData instance when valid; null when invalid.
 */
function normalizeUploadFormData(formData) {
  if (formData == null || typeof formData.get !== 'function') return null;
  const titleRaw = formData.get('title');
  if (titleRaw == null || typeof titleRaw !== 'string') return null;
  const title = titleRaw.trim();
  if (!title || title.length > 255) return null;
  const artistRaw = formData.get('artist');
  if (artistRaw == null || typeof artistRaw !== 'string') return null;
  const artist = artistRaw.trim();
  if (!artist || artist.length > 255) return null;
  const durRaw = formData.get('duration');
  if (durRaw == null || durRaw === '') return null;
  const dur = Number(durRaw);
  if (!Number.isFinite(dur) || !Number.isInteger(dur) || dur < 1 || dur > 7200) return null;
  const fileKeys = ['audio', 'file', 'song', 'track'];
  let hasFile = false;
  for (const key of fileKeys) {
    const entry = formData.get(key);
    if (entry && typeof entry === 'object' && typeof entry.size === 'number' && entry.size > 0) {
      hasFile = true;
      break;
    }
  }
  if (!hasFile && typeof formData.entries === 'function') {
    for (const [, v] of formData.entries()) {
      if (v && typeof v === 'object' && typeof v.size === 'number' && v.size > 0 && (v.type || '').startsWith('audio')) {
        hasFile = true;
        break;
      }
    }
  }
  if (!hasFile) return null;
  formData.set('title', title);
  formData.set('artist', artist);
  formData.set('duration', String(dur));
  const albumRaw = formData.get('album');
  if (albumRaw != null && typeof albumRaw === 'string') {
    const album = albumRaw.trim();
    if (album) formData.set('album', album.slice(0, 255));
    else formData.delete('album');
  }
  return formData;
}

export const musicService = {
  getSongs: (params) => {
    const normalized = normalizeListParams(params);
    if (normalized === null) return Promise.reject(new Error('Invalid limit, offset, genre, or search'));
    return api.get('/songs', { params: normalized }).then(r => r.data);
  },
  getMySongs: (params) => {
    const normalized = normalizeListParams(params);
    if (normalized === null) return Promise.reject(new Error('Invalid limit or offset'));
    return api.get('/songs/mine', { params: normalized }).then(r => r.data);
  },
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
  /**
   * dose-1.93: after resolveStreamUrl, reject empty/non-string url so
   * PlayerContext loadSong never assigns a blank <audio src> (same contract
   * as the existing "No stream URL" throw path).
   */
  getStreamUrl: (id) => {
    const sid = toPositiveId(id);
    if (sid == null) return Promise.reject(new Error('Invalid song id'));
    return api.get(`/songs/${sid}/stream-url`).then((r) => {
      const data = r.data || {};
      const url = resolveStreamUrl(data.url);
      if (!url || typeof url !== 'string') {
        return Promise.reject(new Error('No stream URL'));
      }
      return { ...data, url };
    });
  },
  uploadSong: (formData) => {
    const normalized = normalizeUploadFormData(formData);
    if (normalized === null) return Promise.reject(new Error('Invalid upload payload'));
    return api.post('/songs/upload', normalized, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
  },
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
  createPlaylist: (data) => {
    const normalized = normalizeCreatePlaylist(data);
    if (normalized === null) return Promise.reject(new Error('Invalid createPlaylist payload'));
    return api.post('/playlists', normalized || {}).then(r => r.data);
  },
  addToPlaylist: (playlistId, songId) => {
    const pid = toPositiveId(playlistId);
    const sid = toPositiveId(songId);
    if (pid == null || sid == null) return Promise.reject(new Error('Invalid playlist or song id'));
    return api.post(`/playlists/${pid}/songs`, { songId: sid }).then(r => r.data);
  },
  removeFromPlaylist: (playlistId, songId) => {
    const pid = toPositiveId(playlistId);
    const sid = toPositiveId(songId);
    if (pid == null || sid == null) return Promise.reject(new Error('Invalid playlist or song id'));
    return api.delete(`/playlists/${pid}/songs/${sid}`).then(r => r.data);
  },
  reorderPlaylist: (playlistId, songIds) => {
    const pid = toPositiveId(playlistId);
    if (pid == null) return Promise.reject(new Error('Invalid playlist id'));
    if (!Array.isArray(songIds)) return Promise.reject(new Error('Invalid songIds'));
    const normalized = songIds.map((x) => toPositiveId(x)).filter((n) => n != null);
    return api.put(`/playlists/${pid}/reorder`, { songIds: normalized }).then(r => r.data);
  },
  deletePlaylist: (id) => {
    const pid = toPositiveId(id);
    if (pid == null) return Promise.reject(new Error('Invalid playlist id'));
    return api.delete(`/playlists/${pid}`).then(r => r.data);
  },
  generateAIPlaylist: (prompt, name, songCount) => {
    const normalized = normalizeGenerateAIPlaylist(prompt, name, songCount);
    if (normalized === null) return Promise.reject(new Error('Invalid generateAIPlaylist payload'));
    return api.post('/playlists/ai-generate', normalized).then(r => r.data);
  },
  getPlaybackState: () =>
    api.get('/playback/state').then((r) => {
      const data = r.data;
      if (data && Object.prototype.hasOwnProperty.call(data, 'state')) return data.state;
      return data;
    }),
  updatePlaybackState: (state) => {
    const normalized = normalizePlaybackState(state);
    if (normalized === null) return Promise.reject(new Error('Invalid playback state payload'));
    return api.post('/playback/state', normalized || {}).then(r => r.data);
  },
  getRooms: () => api.get('/rooms').then(r => r.data),
  getRoom: (id) => {
    const rid = toPositiveId(id);
    if (rid == null) return Promise.reject(new Error('Invalid room id'));
    return api.get(`/rooms/${rid}`).then(r => r.data);
  },
  createRoom: (data) => {
    const normalized = normalizeCreateRoom(data);
    if (normalized === null) return Promise.reject(new Error('Invalid createRoom payload'));
    return api.post('/rooms', normalized || {}).then(r => r.data);
  },
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
  getRecommendations: (params) => {
    const normalized = normalizeAiListParams(params);
    if (normalized === null) return Promise.reject(new Error('Invalid limit'));
    return api.get('/ai/recommendations', { params: normalized }).then(r => r.data);
  },
  getDailyMix: () => api.get('/ai/daily-mix').then(r => r.data),
  getSimilarSongs: (songId, params) => {
    const sid = toPositiveId(songId);
    if (sid == null) return Promise.reject(new Error('Invalid song id'));
    const normalized = normalizeAiListParams(params);
    if (normalized === null) return Promise.reject(new Error('Invalid limit'));
    return api.get(`/ai/similar/${sid}`, { params: normalized }).then(r => r.data);
  },
  detectMood: (input) => {
    if (input == null || typeof input !== 'string') {
      return Promise.reject(new Error('Invalid detectMood input'));
    }
    const trimmed = input.trim();
    if (!trimmed) return Promise.reject(new Error('Invalid detectMood input'));
    return api.post('/ai/mood/detect', { input: trimmed }).then(r => r.data);
  },
  search: (q, params) => {
    if (q == null || typeof q !== 'string') {
      return Promise.reject(new Error('Invalid search query'));
    }
    const trimmed = q.trim();
    if (!trimmed) return Promise.reject(new Error('Invalid search query'));
    const base = { query: trimmed, ...(params && typeof params === 'object' ? params : {}) };
    if (Object.prototype.hasOwnProperty.call(base, 'q')) delete base.q;
    const normalized = normalizeAiListParams(base);
    if (normalized === null) return Promise.reject(new Error('Invalid limit'));
    return api.get('/ai/search', { params: normalized }).then(r => r.data);
  },
  chat: (message, history, context) => {
    if (message == null || typeof message !== 'string') {
      return Promise.reject(new Error('Invalid chat message'));
    }
    const trimmed = message.trim();
    if (!trimmed) return Promise.reject(new Error('Invalid chat message'));
    const body = { message: trimmed, conversationHistory: history };
    if (context != null) body.context = context;
    return api.post('/ai/chat', body).then(r => r.data);
  },
};
