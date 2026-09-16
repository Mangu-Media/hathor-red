/**
 * AI Service
 *
 * Frontend service for interacting with the Colab Enterprise AI features.
 * dose-5.2: client-side length/type bars matching musicService (dose-5.1)
 * so AIChat / AIRecommendations never POST/GET unbounded strings when
 * callers use this module instead of musicService.
 * dose-5.5: generateAIPlaylist path aligned to server/routes/playlists.js
 * POST /generate-ai (same as musicService); was /ai/playlist/generate.
 */

import api from './api';

function toPositiveId(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;
  return n;
}

function toBoundedLimit(value, max = 50) {
  if (value == null || value === '') return undefined;
  const n = toPositiveId(value);
  if (n == null) return null;
  return Math.min(n, max);
}

/**
 * Get the AI service status
 * @returns {Promise<Object>} AI service status
 */
export const getAIStatus = async () => {
  const response = await api.get('/ai/status');
  return response.data;
};

/**
 * Generate an AI-powered playlist
 * @param {string} prompt - Natural language description
 * @param {string} name - Optional playlist name
 * @param {number} songCount - Number of songs (default: 10)
 * @returns {Promise<Object>} Generated playlist with songs
 */
export const generateAIPlaylist = async (prompt, name = null, songCount = 10) => {
  if (prompt == null || typeof prompt !== 'string') {
    return Promise.reject(new Error('Invalid generateAIPlaylist prompt'));
  }
  const trimmedPrompt = prompt.trim();
  // dose-5.2: same 500-char bar as musicService.normalizeGenerateAIPlaylist
  if (!trimmedPrompt || trimmedPrompt.length > 500) {
    return Promise.reject(new Error('Invalid generateAIPlaylist prompt'));
  }
  const body = { prompt: trimmedPrompt };
  if (name != null && typeof name === 'string') {
    const trimmedName = name.trim();
    if (trimmedName) body.name = trimmedName.slice(0, 100);
  }
  if (songCount != null && songCount !== '') {
    const n = toPositiveId(songCount);
    if (n == null) return Promise.reject(new Error('Invalid songCount'));
    body.songCount = Math.min(n, 50);
  }
  // dose-5.5: match musicService + server/routes/playlists.js POST /generate-ai
  const response = await api.post('/playlists/generate-ai', body);
  return response.data;
};

/**
 * Get personalized music recommendations
 * @param {number} limit - Maximum number of recommendations
 * @returns {Promise<Object>} Recommendations with user profile
 */
export const getRecommendations = async (limit = 20) => {
  const capped = toBoundedLimit(limit, 50);
  if (capped === null) return Promise.reject(new Error('Invalid limit'));
  const params = capped !== undefined ? { limit: capped } : {};
  const response = await api.get('/ai/recommendations', { params });
  return response.data;
};

/**
 * Get the daily mix playlist
 * @returns {Promise<Object>} Daily mix with songs
 */
export const getDailyMix = async () => {
  const response = await api.get('/ai/daily-mix');
  return response.data;
};

/**
 * Get songs similar to a specific song
 * @param {string|number} songId - The song ID
 * @param {number} limit - Maximum number of similar songs
 * @returns {Promise<Object>} Similar songs
 */
export const getSimilarSongs = async (songId, limit = 10) => {
  const sid = toPositiveId(songId);
  if (sid == null) return Promise.reject(new Error('Invalid song id'));
  const capped = toBoundedLimit(limit, 50);
  if (capped === null) return Promise.reject(new Error('Invalid limit'));
  const params = capped !== undefined ? { limit: capped } : {};
  const response = await api.get(`/ai/similar/${sid}`, { params });
  return response.data;
};

/**
 * Detect mood from user input
 * @param {string} input - User's text input
 * @param {Object} context - Additional context
 * @returns {Promise<Object>} Mood analysis with suggested songs
 */
export const detectMood = async (input, context = {}) => {
  if (input == null || typeof input !== 'string') {
    return Promise.reject(new Error('Invalid detectMood input'));
  }
  const trimmed = input.trim();
  // dose-5.2: length bar so mood path never receives unbounded strings
  if (!trimmed || trimmed.length > 500) {
    return Promise.reject(new Error('Invalid detectMood input'));
  }
  const body = { input: trimmed };
  if (context != null && typeof context === 'object') body.context = context;
  const response = await api.post('/ai/mood/detect', body);
  return response.data;
};

/**
 * Perform semantic search for music
 * @param {string} query - Natural language search query
 * @param {number} limit - Maximum results
 * @returns {Promise<Object>} Search results with parameters
 */
export const semanticSearch = async (query, limit = 20) => {
  if (query == null || typeof query !== 'string') {
    return Promise.reject(new Error('Invalid search query'));
  }
  const trimmed = query.trim();
  // dose-5.2: same 200-char bar as catalog / musicService.search
  if (!trimmed || trimmed.length > 200) {
    return Promise.reject(new Error('Invalid search query'));
  }
  const capped = toBoundedLimit(limit, 50);
  if (capped === null) return Promise.reject(new Error('Invalid limit'));
  const params = { query: trimmed };
  if (capped !== undefined) params.limit = capped;
  const response = await api.get('/ai/search', { params });
  return response.data;
};

/**
 * Chat with the AI music assistant
 * @param {string} message - User's message
 * @param {Array} conversationHistory - Previous messages
 * @param {string} currentPage - Current page context
 * @returns {Promise<Object>} AI response with actions
 */
export const chatWithAI = async (message, conversationHistory = [], currentPage = 'home') => {
  if (message == null || typeof message !== 'string') {
    return Promise.reject(new Error('Invalid chat message'));
  }
  const trimmed = message.trim();
  // dose-5.2: length bar so chat path never receives unbounded strings
  if (!trimmed || trimmed.length > 2000) {
    return Promise.reject(new Error('Invalid chat message'));
  }
  const body = {
    message: trimmed,
    conversationHistory: Array.isArray(conversationHistory) ? conversationHistory : [],
  };
  if (currentPage != null && typeof currentPage === 'string') {
    body.currentPage = currentPage.slice(0, 64);
  }
  const response = await api.post('/ai/chat', body);
  return response.data;
};

export default {
  getAIStatus,
  generateAIPlaylist,
  getRecommendations,
  getDailyMix,
  getSimilarSongs,
  detectMood,
  semanticSearch,
  chatWithAI
};
