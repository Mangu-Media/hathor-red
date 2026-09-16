# WHAT_SHIPS — Hathor Red live capability snapshot

Last updated: 2026-09-16 (dose-5.10: bar createPlaylist name and description in controller body).

## Ships today

- **Auth**: email/password + JWT. No OAuth routes mounted.
- **Playback (Dose 1 core)**: signed stream URLs; streamAuth + streamToken; client/server positive-int and bounded bars through dose-1.90.
- **dose-1.91 / dose-1.92**: `musicService.uploadSong` uses `normalizeUploadFormData` (required non-empty trimmed title+artist, duration 1..7200 int, File present; rewrites trimmed fields) before POST. Full `client/src/services/music.js` restored.
- **dose-1.93**: `getStreamUrl` rejects empty/non-string URL after `resolveStreamUrl` so PlayerContext never assigns a blank `<audio src>`.
- **dose-1.94**: `musicService.recordListening` rejects invalid `songId` with `Invalid song id` (was mislabeled `Invalid duration`); duration bar unchanged.
- **Player**: full PlayerContext (queue, shuffle, seek guards, hydrate, logout clear, stream error one-shot retry).
- **Queue UI / Playlists / Home genre / Rooms / Olympus flags / Podcasts (soon)** as prior.
- **Pitch/stems**: not implemented; UI hidden.
- **dose-2.96**: `authService.updateProfile` normalizes client-side (required non-empty trimmed displayName ≤100 when present; avatarUrl empty-to-clear or valid http(s) URL) before PUT so Settings never posts junk the server would 400.
- **dose-3.1**: `musicService.getSongs` normalizes `genre` against the same ALLOWED_GENRES list as the server (case-insensitive resolve to canonical name; reject unknown) inside `normalizeListParams` so Home genre filter never sends an invalid query the API would 400.
- **dose-3.2**: `normalizeListParams` also bars `search` (trim; empty clears; reject non-string or length > 200) so catalog list queries never send unbounded or junk search strings to the ILIKE path.
- **dose-4.1**: `leaveRoom` (HTTP) hands off host to earliest remaining participant when the leaver was host (matches socket disconnect handoff path).
- **dose-4.2**: HTTP host handoff also emits `host-changed` to `room-{id}` sockets and updates in-memory `roomHosts` via `notifyHttpHostHandoff` (parity with socket-path handleHostHandoff).
- **dose-5.1**: AI client inputs barred before POST/GET in `musicService` — `search` query trim + length ≤ 200; `detectMood` input ≤ 500; `chat` message ≤ 2000; `generateAIPlaylist` prompt ≤ 500.
- **dose-5.2**: Same length/type bars applied to `client/src/services/ai.js` (used by AIChat, AIRecommendations, AIPlaylistGenerator paths that import ai.js) so unbounded strings never reach `/ai/*` from either service module.
- **dose-5.3**: Server `aiController` bars match client: `detectMood` input ≤ 500; `semanticSearch` query ≤ 200; `chat` message ≤ 2000 (trim + type check; 400 on oversize/empty). (Legacy `generatePlaylist` removed in dose-5.7.)
- **dose-5.4**: `musicService.generateAIPlaylist` POSTs to `/playlists/generate-ai` (matches `server/routes/playlists.js`); was `/playlists/ai-generate` (404). Also aligned `addToPlaylist` to `/playlists/add-song` with `{ playlistId, songId }` body.
- **dose-5.5**: `client/src/services/ai.js` `generateAIPlaylist` POSTs to `/playlists/generate-ai` (same as musicService + playlists router); was `/ai/playlist/generate`. Remaining client playlist mutations already matched server routes.
- **dose-5.6**: Server `POST /ai/playlist/generate` is now a legacy alias of `playlistController.generateAIPlaylist` (same validation + stronger mood fallback as `/playlists/generate-ai`). Preferred client path remains `/playlists/generate-ai`; dual handlers no longer diverge.
- **dose-5.7**: Removed dead `aiController.generatePlaylist` (no longer routed after dose-5.6; preferred path is `playlistController.generateAIPlaylist` via `/playlists/generate-ai` and the `/ai/playlist/generate` alias). Export list cleaned.
- **dose-5.8**: `playlistController.generateAIPlaylist` body now type-checks + trims + bars prompt length ≤ 500 (defense-in-depth; middleware `aiPlaylistValidation` already enforces). Non-string / empty / oversize → 400 before AI or moodMap path.
- **dose-5.9**: `playlistController.generateAIPlaylist` body now type-checks + trims + bars optional `name` ≤ 100 (parity with middleware + client `normalizeGenerateAIPlaylist` + createPlaylist). Non-string / oversize → 400; empty after trim treated as absent.
- **dose-5.10**: `playlistController.createPlaylist` body now type-checks + trims + bars required `name` ≤ 100 and optional `description` ≤ 500 (defense-in-depth; middleware `playlistValidation` already enforces). Non-string / empty / oversize → 400 before INSERT.

## Does not ship

- HLS in the live player, OAuth, WebRTC rooms, stem/pitch, cross-device live queue list, podcast catalog.

## Dose status

| Dose | Status |
|------|--------|
| 0 Truth | Done |
| 1 Playback | Core through dose-1.94; recordListening songId error label |
| 2 Account | Soft logout + profile path + client normalize (dose-2.96) |
| 3 Home/playlists | Genre + search client bars (dose-3.1 / 3.2); routes/list/detail present |
| 4 Rooms | Core + dose-4.1 HTTP leave host handoff + dose-4.2 host-changed emit on HTTP handoff |
| 5 | Olympus flags + dose-5.1–5.10 (client/server AI bars, path align, shared generateAIPlaylist, dead code retired, controller prompt + name bars, createPlaylist name/description bars) |

## Next item

Dose 5 Olympus polish complete for current bars. No further thin controller bars identified. No Dose 6+.

See also: [README.md](README.md), [BUGS.md](BUGS.md), [API.md](API.md).
