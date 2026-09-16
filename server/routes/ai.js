/**
 * AI Routes
 *
 * API endpoints for AI-powered features in the Hathor Music Platform.
 * dose-5.6: POST /playlist/generate is a legacy alias of
 * POST /playlists/generate-ai (playlistController.generateAIPlaylist).
 * Clients use the playlists path; this route remains for older callers.
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const aiController = require('../controllers/aiController');
const playlistController = require('../controllers/playlistController');
const { aiPlaylistValidation, validate } = require('../middleware/validation');

// Public endpoint - check AI service status
router.get('/status', aiController.getStatus);

// Protected endpoints - require authentication
router.use(authMiddleware);

// Playlist generation — legacy alias (dose-5.6); preferred path is /playlists/generate-ai
router.post('/playlist/generate', aiPlaylistValidation, validate, playlistController.generateAIPlaylist);

// Recommendations
router.get('/recommendations', aiController.getRecommendations);
router.get('/daily-mix', aiController.getDailyMix);
router.get('/similar/:songId', aiController.getSimilarSongs);

// Mood detection
router.post('/mood/detect', aiController.detectMood);

// Semantic search
router.get('/search', aiController.semanticSearch);

// Chat assistant
router.post('/chat', aiController.chat);

module.exports = router;
