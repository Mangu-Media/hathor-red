# WHAT_SHIPS — Hathor Red live capability snapshot

Last updated: 2026-09-15 (dose-4.2: HTTP leaveRoom emits host-changed).

## Ships today

- **Auth**: email/password + JWT. No OAuth routes mounted.
- **Playback (Dose 1 core)**: signed stream URLs; streamAuth + streamToken; client/server positive-int and bounded bars through dose-1.90.
- **dose-1.91 / dose-1.92**: `musicService.uploadSong` uses `normalizeUploadFormData` (required non-empty trimmed title+artist, duration 1..7200 int, File present; rewrites trimmed fields) before POST. Full `client/src/services/music.js` restored.
- **dose-1.93**: `getStreamUrl` rejects empty/non-string URL after `resolveStreamUrl` so PlayerContext never assigns a blank `<audio src>`.
- **Player**: full PlayerContext (queue, shuffle, seek guards, hydrate, logout clear, stream error one-shot retry).
- **Queue UI / Playlists / Home genre / Rooms / Olympus flags / Podcasts (soon)** as prior.
- **Pitch/stems**: not implemented; UI hidden.
- **dose-2.96**: `authService.updateProfile` normalizes client-side (required non-empty trimmed displayName ≤100 when present; avatarUrl empty-to-clear or valid http(s) URL) before PUT so Settings never posts junk the server would 400.
- **dose-3.1**: `musicService.getSongs` normalizes `genre` against the same ALLOWED_GENRES list as the server (case-insensitive resolve to canonical name; reject unknown) inside `normalizeListParams` so Home genre filter never sends an invalid query the API would 400.
- **dose-3.2**: `normalizeListParams` also bars `search` (trim; empty clears; reject non-string or length > 200) so catalog list queries never send unbounded or junk search strings to the ILIKE path.
- **dose-4.1**: `leaveRoom` (HTTP) hands off host to earliest remaining participant when the leaver was host (matches socket disconnect handoff path).
- **dose-4.2**: HTTP host handoff also emits `host-changed` to `room-{id}` sockets and updates in-memory `roomHosts` via `notifyHttpHostHandoff` (parity with socket-path handleHostHandoff).

## Does not ship

- HLS in the live player, OAuth, WebRTC rooms, stem/pitch, cross-device live queue list, podcast catalog.

## Dose status

| Dose | Status |
|------|--------|
| 0 Truth | Done |
| 1 Playback | Core through dose-1.93; getStreamUrl empty-url bar |
| 2 Account | Soft logout + profile path + client normalize (dose-2.96) |
| 3 Home/playlists | Genre + search client bars (dose-3.1 / 3.2); routes/list/detail present |
| 4 Rooms | Core + dose-4.1 HTTP leave host handoff + dose-4.2 host-changed emit on HTTP handoff |
| 5 | Olympus flags as prior |

## Next item

Dose 5 Olympus: fallbacks when OpenAI/worker missing; remove dead nav items.

See also: [README.md](README.md), [BUGS.md](BUGS.md), [API.md](API.md).
