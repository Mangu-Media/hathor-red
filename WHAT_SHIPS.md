# WHAT_SHIPS — Hathor Red live capability snapshot

Last updated: 2026-09-15 (dose-1.93: harden getStreamUrl empty-url reject).

## Ships today

- **Auth**: email/password + JWT. No OAuth routes mounted.
- **Playback (Dose 1 core)**: signed stream URLs; streamAuth + streamToken; client/server positive-int and bounded bars through dose-1.90.
- **dose-1.91 / dose-1.92**: `musicService.uploadSong` uses `normalizeUploadFormData` (required non-empty trimmed title+artist, duration 1..7200 int, File present; rewrites trimmed fields) before POST. Full `client/src/services/music.js` restored.
- **dose-1.93**: `getStreamUrl` rejects empty/non-string URL after `resolveStreamUrl` so PlayerContext never assigns a blank `<audio src>`.
- **Player**: full PlayerContext (queue, shuffle, seek guards, hydrate, logout clear, stream error one-shot retry).
- **Queue UI / Playlists / Home genre / Rooms / Olympus flags / Podcasts (soon)** as prior.
- **Pitch/stems**: not implemented; UI hidden.

## Does not ship

- HLS in the live player, OAuth, WebRTC rooms, stem/pitch, cross-device live queue list, podcast catalog.

## Dose status

| Dose | Status |
|------|--------|
| 0 Truth | Done |
| 1 Playback | Core through dose-1.93; getStreamUrl empty-url bar |
| 2 Account | Soft logout + profile path present |
| 3–5 | Routes/flags/rooms as prior |

## Next item

Dose 2 account basics verification (profile save path + soft logout end-to-end); then Dose 3 home/playlists filters.

See also: [README.md](README.md), [BUGS.md](BUGS.md), [API.md](API.md).
