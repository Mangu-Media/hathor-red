# WHAT_SHIPS — Hathor Red live capability snapshot

Last updated: 2026-09-15 (dose-3.1: client genre bar for getSongs).

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

## Does not ship

- HLS in the live player, OAuth, WebRTC rooms, stem/pitch, cross-device live queue list, podcast catalog.

## Dose status

| Dose | Status |
|------|--------|
| 0 Truth | Done |
| 1 Playback | Core through dose-1.93; getStreamUrl empty-url bar |
| 2 Account | Soft logout + profile path + client normalize (dose-2.96) |
| 3 Home/playlists | Genre client bar (dose-3.1); routes/list/detail present |
| 4–5 | Rooms/flags as prior |

## Next item

Dose 3: further home/playlists honesty if any (search param bar, empty genre clear path); then Dose 4 rooms disconnect/participants.

See also: [README.md](README.md), [BUGS.md](BUGS.md), [API.md](API.md).
