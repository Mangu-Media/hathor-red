# Identified Bugs and Issues - Hathor Music Platform

## Critical Severity

### 1c. PlayerContext / music.js truncated by agent push (2026-09-15)
*   **Description**: `client/src/services/music.js` on main was reduced to a ~570-byte stub after a failed large-file push (dose-1.91 attempt). Full file lived at blob `68e83f343bb92ff181dbf090b1d8d7f49c242f3e` (~21KB).
*   **Impact**: Critical — all `musicService` methods missing; SPA import breaks playback, playlists, rooms, AI calls.
*   **Root Cause**: Agent `github___push_files` / `create_or_update_file` path with incomplete content string.
*   **Suggested Fix**: Restore full content from blob `68e83f34` (or local agent artifact with dose-1.91 guards), verify blob size > 20KB after push.
*   **Status**: **Closed in dose-1.92** — full music.js restored (~23.8KB) with `normalizeUploadFormData` (title/artist/duration/file bars) re-applied. Verify blob size after push.

### 1b. PlayerContext.js Placeholder on Main (dose-1.15)
*   **Status**: **Closed in dose-1.16** — full PlayerContext restored.

### 1. Playback Streaming Broken (Auth Mismatch)
*   **Status**: Mitigated via signed query-token stream URLs.

See prior entries for remaining medium/low items. Full history retained in git.
