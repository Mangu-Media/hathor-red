/**
 * AI Controller
 *
 * Handles all AI-powered endpoints for the Hathor Music Platform.
 * Uses the Colab Enterprise AI service for intelligent features.
 */

const colabAIService = require('../services/colabAIService');
const db = require('../config/database');
const { toPositiveInt, toNonNegInt } = require('../utils/streamToken');

const AI_DEFAULT_LIMIT = 20;
const AI_SIMILAR_DEFAULT_LIMIT = 10;
const AI_MAX_LIMIT = 50;
const AI_PLAYLIST_DEFAULT_COUNT = 10;
// dose-5.3: server-side length bars matching client (dose-5.1 / dose-5.2)
const AI_PROMPT_MAX = 500;
const AI_MOOD_INPUT_MAX = 500;
const AI_SEARCH_QUERY_MAX = 200;
const AI_CHAT_MESSAGE_MAX = 2000;

/**
 * Parse AI limit: finite positive integer when present, else default.
 * Rejects NaN / non-integer / <=0 / Infinity with null (caller returns 400).
 * Caps at AI_MAX_LIMIT.
 * dose-1.55: same bar as discovery search/similar and getSongs / privacy / social.
 */
function parseAiLimit(raw, defaultLimit = AI_DEFAULT_LIMIT) {
  if (raw == null || raw === '') return defaultLimit;
  const n = toPositiveInt(raw);
  if (n == null) return null;
  return Math.min(n, AI_MAX_LIMIT);
}

/**
 * Get AI service status
 */
const getStatus = async (req, res) => {
  try {
    const status = colabAIService.getStatus();
    res.json({ status });
  } catch (error) {
    console.error('AI status error:', error);
    res.status(500).json({ error: 'Failed to get AI status' });
  }
};

/**
 * Get personalized recommendations
 */
const getRecommendations = async (req, res) => {
  try {
    const { userId } = req.user;

    // dose-1.55: finite positive-int bar on query limit (default 20, ceiling 50)
    const limit = parseAiLimit(req.query.limit, AI_DEFAULT_LIMIT);
    if (limit == null) {
      return res.status(400).json({ error: 'Invalid limit' });
    }

    // Get user's listening history
    const historyResult = await db.query(
      `SELECT s.id, s.title, s.artist, s.genre, s.album,
              COUNT(*) as play_count,
              MAX(lh.listened_at) as last_played
       FROM listening_history lh
       JOIN songs s ON lh.song_id = s.id
       WHERE lh.user_id = $1
       GROUP BY s.id, s.title, s.artist, s.genre, s.album
       ORDER BY play_count DESC, last_played DESC
       LIMIT 50`,
      [userId]
    );

    // Get favorite artists and genres
    const favoriteArtists = [...new Set(historyResult.rows.map(r => r.artist))].slice(0, 10);
    const favoriteGenres = [...new Set(historyResult.rows.map(r => r.genre).filter(Boolean))];

    const userContext = {
      recentPlays: historyResult.rows.slice(0, 10),
      favoriteArtists,
      favoriteGenres
    };

    const options = {
      timeOfDay: new Date().getHours(),
      dayOfWeek: new Date().toLocaleDateString('en-US', { weekday: 'long' })
    };

    // Get AI recommendations
    const recommendations = await colabAIService.getRecommendations(userContext, options);

    // Fetch recommended songs based on AI analysis
    let query = 'SELECT * FROM songs WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (recommendations.genres && recommendations.genres.length > 0) {
      const genrePlaceholders = recommendations.genres.map(() => `$${paramIndex++}`).join(',');
      query += ` AND genre IN (${genrePlaceholders})`;
      params.push(...recommendations.genres);
    }

    // Exclude recently played songs
    const recentSongIds = historyResult.rows.slice(0, 20).map(r => r.id);
    if (recentSongIds.length > 0) {
      const excludePlaceholders = recentSongIds.map(() => `$${paramIndex++}`).join(',');
      query += ` AND id NOT IN (${excludePlaceholders})`;
      params.push(...recentSongIds);
    }

    query += ' ORDER BY RANDOM()';
    query += ` LIMIT $${paramIndex}`;
    params.push(limit);

    const songsResult = await db.query(query, params);

    // dose-1.66 / dose-1.84: play_count from COUNT(*) (pg bigint string) uses
    // shared toNonNegInt from streamToken (no commerce dependency).
    res.json({
      recommendations: {
        songs: songsResult.rows,
        mood: recommendations.mood,
        energyLevel: recommendations.energyLevel,
        reasons: recommendations.recommendations || []
      },
      userProfile: {
        favoriteGenres: favoriteGenres.slice(0, 5),
        favoriteArtists: favoriteArtists.slice(0, 5),
        totalPlays: historyResult.rows.reduce(
          (sum, r) => sum + (toNonNegInt(r.play_count) ?? 0),
          0
        )
      }
    });
  } catch (error) {
    console.error('Get recommendations error:', error);
    res.status(500).json({ error: 'Failed to get recommendations' });
  }
};

/**
 * Detect mood from user input
 */
const detectMood = async (req, res) => {
  try {
    const { input, context = {} } = req.body;

    // dose-5.3: required non-empty string, max AI_MOOD_INPUT_MAX
    if (input == null || typeof input !== 'string') {
      return res.status(400).json({ error: 'Input is required' });
    }
    const trimmedInput = input.trim();
    if (!trimmedInput || trimmedInput.length > AI_MOOD_INPUT_MAX) {
      return res.status(400).json({ error: `Input is required (max ${AI_MOOD_INPUT_MAX} chars)` });
    }

    const moodAnalysis = await colabAIService.detectMood(trimmedInput, context);

    // Get songs matching the detected mood
    const genreQuery = moodAnalysis.suggestedGenres && moodAnalysis.suggestedGenres.length > 0
      ? `genre IN (${moodAnalysis.suggestedGenres.map((_, i) => `$${i + 1}`).join(',')})`
      : '1=1';

    const songsResult = await db.query(
      `SELECT * FROM songs WHERE ${genreQuery} ORDER BY RANDOM() LIMIT 10`,
      moodAnalysis.suggestedGenres || []
    );

    res.json({
      mood: moodAnalysis,
      suggestedSongs: songsResult.rows
    });
  } catch (error) {
    console.error('Mood detection error:', error);
    res.status(500).json({ error: 'Failed to detect mood' });
  }
};

/**
 * Semantic search for music
 */
const semanticSearch = async (req, res) => {
  try {
    const { query: searchQuery } = req.query;

    // dose-5.3: required non-empty string, max AI_SEARCH_QUERY_MAX
    if (searchQuery == null || typeof searchQuery !== 'string') {
      return res.status(400).json({ error: 'Search query is required' });
    }
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery || trimmedQuery.length > AI_SEARCH_QUERY_MAX) {
      return res.status(400).json({ error: `Search query is required (max ${AI_SEARCH_QUERY_MAX} chars)` });
    }

    // dose-1.55: finite positive-int bar on query limit (default 20, ceiling 50)
    const limit = parseAiLimit(req.query.limit, AI_DEFAULT_LIMIT);
    if (limit == null) {
      return res.status(400).json({ error: 'Invalid limit' });
    }

    // Get AI-enhanced search parameters
    const searchParams = await colabAIService.semanticSearch(trimmedQuery);

    // Build database query
    let query = 'SELECT * FROM songs WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    // Search by terms
    if (searchParams.searchTerms && searchParams.searchTerms.length > 0) {
      const searchConditions = searchParams.searchTerms.map(() => {
        const idx = paramIndex++;
        return `(title ILIKE $${idx} OR artist ILIKE $${idx} OR album ILIKE $${idx})`;
      }).join(' OR ');
      query += ` AND (${searchConditions})`;
      params.push(...searchParams.searchTerms.map(t => `%${t}%`));
    }

    // Filter by genres
    if (searchParams.genres && searchParams.genres.length > 0) {
      const genrePlaceholders = searchParams.genres.map(() => `$${paramIndex++}`).join(',');
      query += ` AND genre IN (${genrePlaceholders})`;
      params.push(...searchParams.genres);
    }

    query += ' ORDER BY title';
    query += ` LIMIT $${paramIndex}`;
    params.push(limit);

    const songsResult = await db.query(query, params);

    res.json({
      results: songsResult.rows,
      searchParams,
      totalResults: songsResult.rows.length
    });
  } catch (error) {
    console.error('Semantic search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
};

/**
 * AI chat assistant
 */
const chat = async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;
    const { userId } = req.user;

    // dose-5.3: required non-empty string, max AI_CHAT_MESSAGE_MAX
    if (message == null || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }
    const trimmedMessage = message.trim();
    if (!trimmedMessage || trimmedMessage.length > AI_CHAT_MESSAGE_MAX) {
      return res.status(400).json({ error: `Message is required (max ${AI_CHAT_MESSAGE_MAX} chars)` });
    }

    // Get user context
    const historyResult = await db.query(
      `SELECT s.genre
       FROM listening_history lh
       JOIN songs s ON lh.song_id = s.id
       WHERE lh.user_id = $1
       GROUP BY s.genre
       ORDER BY COUNT(*) DESC
       LIMIT 5`,
      [userId]
    );

    const context = {
      favoriteGenres: historyResult.rows.map(r => r.genre).filter(Boolean),
      currentPage: req.body.currentPage || 'home'
    };

    const response = await colabAIService.chat(trimmedMessage, conversationHistory, context);

    // Process any actions
    let actionResults = null;
    if (response.actions && response.actions.length > 0) {
      actionResults = [];
      for (const action of response.actions) {
        if (action.type === 'search' && action.params?.query) {
          const searchResult = await db.query(
            `SELECT id, title, artist, album FROM songs
             WHERE title ILIKE $1 OR artist ILIKE $1
             ORDER BY title LIMIT 5`,
            [`%${action.params.query}%`]
          );
          actionResults.push({
            type: 'search',
            results: searchResult.rows
          });
        }
      }
    }

    res.json({
      response: response.message,
      actions: response.actions || [],
      actionResults
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Chat failed' });
  }
};

/**
 * Get song similarity suggestions
 * dose-1.48: apply shared toPositiveInt on path :songId (same bar as discovery/social/song controllers)
 * dose-1.55: finite positive-int bar on query limit (default 10, ceiling 50)
 */
const getSimilarSongs = async (req, res) => {
  try {
    const songId = toPositiveInt(req.params.songId);
    if (songId == null) {
      return res.status(400).json({ error: 'Invalid song ID' });
    }
    const limit = parseAiLimit(req.query.limit, AI_SIMILAR_DEFAULT_LIMIT);
    if (limit == null) {
      return res.status(400).json({ error: 'Invalid limit' });
    }

    // Get the reference song
    const songResult = await db.query(
      'SELECT * FROM songs WHERE id = $1',
      [songId]
    );

    if (songResult.rows.length === 0) {
      return res.status(404).json({ error: 'Song not found' });
    }

    const song = songResult.rows[0];

    // Find similar songs by genre and artist
    const similarResult = await db.query(
      `SELECT * FROM songs
       WHERE id != $1
       AND (genre = $2 OR artist = $3)
       ORDER BY
         CASE WHEN artist = $3 THEN 0 ELSE 1 END,
         RANDOM()
       LIMIT $4`,
      [songId, song.genre, song.artist, limit]
    );

    res.json({
      referenceSong: song,
      similarSongs: similarResult.rows
    });
  } catch (error) {
    console.error('Similar songs error:', error);
    res.status(500).json({ error: 'Failed to get similar songs' });
  }
};

/**
 * Generate daily mix playlist
 */
const getDailyMix = async (req, res) => {
  try {
    const { userId } = req.user;

    // Get user's listening patterns
    const historyResult = await db.query(
      `SELECT s.genre, s.artist, COUNT(*) as plays
       FROM listening_history lh
       JOIN songs s ON lh.song_id = s.id
       WHERE lh.user_id = $1
       AND lh.listened_at > NOW() - INTERVAL '30 days'
       GROUP BY s.genre, s.artist
       ORDER BY plays DESC`,
      [userId]
    );

    const topGenres = [...new Set(historyResult.rows.map(r => r.genre).filter(Boolean))].slice(0, 3);
    const topArtists = [...new Set(historyResult.rows.map(r => r.artist))].slice(0, 5);

    // Build a personalized mix
    let query = 'SELECT * FROM songs WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (topGenres.length > 0) {
      const genrePlaceholders = topGenres.map(() => `$${paramIndex++}`).join(',');
      query += ` AND genre IN (${genrePlaceholders})`;
      params.push(...topGenres);
    }

    query += ' ORDER BY RANDOM() LIMIT 25';

    const songsResult = await db.query(query, params);

    res.json({
      dailyMix: {
        name: `Your Daily Mix - ${new Date().toLocaleDateString()}`,
        songs: songsResult.rows,
        basedOn: {
          genres: topGenres,
          artists: topArtists.slice(0, 3)
        }
      }
    });
  } catch (error) {
    console.error('Daily mix error:', error);
    res.status(500).json({ error: 'Failed to generate daily mix' });
  }
};

module.exports = {
  getStatus,
  getRecommendations,
  detectMood,
  semanticSearch,
  chat,
  getSimilarSongs,
  getDailyMix
};
