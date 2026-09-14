# WHAT_SHIPS — Hathor Red live capability snapshot

Last updated: 2026-09-14 (dose-1.86 client createPlaylist name + isPublic guards).

## Ships today

- **Auth**: email/password + JWT. No OAuth routes mounted. `authMiddleware` normalizes `req.user` to `{ userId, username }` (same shape as `streamAuth`) and rejects stream-typed tokens on the Bearer path. **dose-1.64**: `getListeningStats` uses shared `toNonNegInt` for totalPlays and totalListeningTimeSeconds.
- **Playback (Dose 1 core)**: signed stream URLs; streamAuth + streamToken; positive-int / bounded bars through dose-1.63. **dose-1.65**: syncService `current_position` / `elapsed_ms` use shared `toNonNegInt`. **dose-1.66**: `getRecommendations` userProfile.totalPlays uses shared `toNonNegInt` on COUNT(*) play_count (reject NaN from raw parseInt). **dose-1.67**: radarService co-listen weight uses shared `toNonNegInt` (reject NaN from raw parseInt). **dose-1.68**: REDIS_PORT, PORT, and JOB_POLL_INTERVAL_MS use shared `toPositiveInt` (reject NaN/0/negative/junk; fall back to 6379 / 5000 / 15000) instead of raw parseInt. **dose-1.69**: COLAB_TIMEOUT / COLAB_MAX_RETRIES / COLAB_RATE_LIMIT / COLAB_TOKEN_LIMIT and MAX_FILE_SIZE use shared `toPositiveInt` (fall back to 30000 / 3 / 60 / 100000 / 50MB). **dose-1.70**: streamSong Range header start/end use shared `toNonNegInt` (reject NaN/negative/non-integer instead of raw parseInt). **dose-1.71**: embeddingService bpmBucket + year era tokens and searchService parseIntent bpm use shared `toPositiveInt` / `toNonNegInt` (reject NaN/0/negative/non-integer instead of raw parseInt). **dose-1.72**: transcodeService `processTranscodeJob` assetId uses shared `toPositiveInt`; paymentProvider mock decline check uses `Number()` + integer equality (no raw parseInt left on live server paths outside `_reference`). **dose-1.73**: ListeningRoom client roomId from route param uses positive-int guard (reject NaN/0/negative; no raw parseInt on socket join/leave/control/chat). **dose-1.74**: Rooms maxListeners, AIPlaylistGenerator songCount, and MusicPlayer queue touch index use Number + isInteger guards (no remaining raw parseInt on client interactive paths). **dose-1.75**: `toNonNegInt` lives in `server/utils/streamToken.js` (shared with toPositiveInt); songController Range/offset and syncService no longer import commerceService for int guards. **dose-1.76**: `musicService.getSong` / `getStreamUrl` reject non-positive ids client-side (same bar as server `toPositiveInt`) before API/stream-url calls. **dose-1.77**: `musicService` playlist/room/similar/recordListening paths use the same `toPositiveId` guard (reject NaN/0/negative/non-integer before API calls). **dose-1.78**: `musicService.recordListening` duration uses client `toListeningDuration` (non-neg int 0..7200, same bar as server recordListening) before POST. **dose-1.79**: `musicService.generateAIPlaylist` songCount uses client `toSongCount` (positive int; omit when unset so server default applies); `reorderPlaylist` normalizes songIds to positive ints before PUT (same bar as server reorderPlaylistSongs). **dose-1.80**: `musicService.updatePlaybackState` normalizes `currentSongId` to positive int or null client-side (same bar as server `toPositiveInt`) before POST so junk never reaches the controller. **dose-1.81**: `musicService.updatePlaybackState` also normalizes `position` (0..7200), `volume` (0..1), `playbackSpeed` (0.25..4), and `isPlaying` (strict boolean) client-side before POST — same bars as server `toBoundedNumber` / `toStrictBoolean`. **dose-1.82**: `musicService.updatePlaybackState` also normalizes `pitchShift` (-24..24 or explicit null) and `stemsConfig` (plain object or explicit null) client-side before POST — same bars as server `toPitchShift` / `toStemsConfig` (UI still hidden; defense-in-depth only). **dose-1.83**: `musicService.getSongs` / `getMySongs` normalize `limit` (positive int, cap 100) and `offset` (non-neg int) client-side before GET — same bars as server `parsePageLimit` / `parsePageOffset` (reject NaN/0/negative/non-integer so junk never hits the controller). **dose-1.84**: `musicService.getRecommendations` / `getSimilarSongs` / `search` normalize `limit` (positive int, cap 50) client-side before GET — same bar as server `parseAiLimit`; `aiController` imports `toNonNegInt` from `streamToken` (no commerce dependency for AI totalPlays). **dose-1.85**: `musicService.createRoom` normalizes `maxListeners` (positive int, cap 100) and `isPublic` (boolean) client-side before POST — same bars as server `roomController` createRoom (`toPositiveInt` + `isPublic !== false`). **dose-1.86**: `musicService.createPlaylist` normalizes `name` (required non-empty trimmed string) and `isPublic` (boolean when present) client-side before POST — same bars as server `playlistController` createPlaylist (`!name` 400 + `isPublic !== false`).
- **Player**: full PlayerContext (queue, shuffle, seek guards, hydrate, logout clear).
- **Queue UI / Playlists / Home genre / Rooms / Olympus flags / Podcasts (soon)** as prior.
- **Pitch/stems**: not implemented; UI hidden.

## Does not ship

- HLS in the live player, OAuth, WebRTC rooms, stem/pitch, cross-device live queue list, podcast catalog.

## Dose status

| Dose | Status |
|------|--------|
| 0 Truth | Done |
| 1 Playback | Core done through dose-1.86 (client createPlaylist name + isPublic guards) |
| 2 Account | Soft logout + profile path present |
| 3–5 | Routes/flags/rooms as prior |

## Next item

Optional multi-device live queue list (not claimed); Dose 2 polish if playback regressions appear.

See also: [README.md](README.md), [BUGS.md](BUGS.md), [API.md](API.md).
