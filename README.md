# Adaptive Video Streaming Backend

Node.js + Express + MongoDB backend with MVC layering, JWT auth, role-based access control, local video storage via Multer, **FFmpeg multi-bitrate outputs (240p / 480p / 720p)**, **ffprobe + blackdetect-style sensitivity heuristics**, Socket.io progress updates, and **HTTP range streaming** per quality.

## Setup

1. Install dependencies:
   - `npm install`
2. Configure environment variables in `.env`:
   - `MONGO_URI=<mongodb-connection-string>`
   - `JWT_SECRET=<long-random-secret>`
   - `JWT_EXPIRES_IN=1d`
   - `PORT=5000`
3. Start development server:
   - `npm run dev`

Binaries: `ffmpeg-static` and `ffprobe-static` ship platform-specific executables via npm. No system FFmpeg install is required for normal use.

## Architecture

- Entry: `src/index.ts`
- App setup: `src/app.ts`
- Auth module: `src/modules/users/*`
- Video module: `src/modules/videos/*`
- FFmpeg helpers: `src/modules/videos/ffmpeg-runner.ts`
- Middleware: `src/middleware/*`
- Realtime: `src/realtime/socket.ts`

Dependency direction:

- Routes -> Controllers -> Services -> Repositories -> Models

## Video processing

1. Upload is stored under `storage/videos/<videoId>/original<ext>` (moved from the initial Multer temp name).
2. **ffprobe** validates streams and duration.
3. **Sensitivity** combines: dangerous filename keywords, missing video stream, very short duration, and high **blackdetect**-derived ratio from FFmpeg logs.
4. **Transcoding**: three MP4 files `240.mp4`, `480.mp4`, `720.mp4` (H.264 + AAC, `+faststart` for streaming).
5. Metadata (`variants`, `analysisSummary`) is stored on the `Video` document.
6. Video owner metadata includes both `ownerUserId` and `ownerEmail` for easier frontend display and audit context.

## API (v1)

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me` (Bearer token required)

### Videos

- `POST /api/videos/upload` (roles: `editor`, `admin`; form-data field `video`)
- `GET /api/videos` (roles: `viewer`, `editor`, `admin`; optional query `status`, `sensitivity`; returns **owned + shared-with-me** videos)
- `GET /api/videos/:videoId` (**owner** or **shared viewer**)
- `POST /api/videos/:videoId/shares` (roles: `editor`, `admin`; body accepts `sharedWith` as **userId or email**; legacy `sharedWithUserId` and `sharedWithEmail` are also accepted; target must be **viewer**; editor may share only their own videos)
- `GET /api/videos/:videoId/shares` (roles: `editor`, `admin`; list assignments for a video)
- `DELETE /api/videos/:videoId/shares/:shareId` (roles: `editor`, `admin`; revoke share)
- `GET /api/videos/:videoId/stream?quality=240|480|720` (owner or shared user; default `720`; **Range** / 206 partial responses; auth via `Authorization` Bearer or `access_token` query for `<video src>`)
- `PATCH /api/videos/:videoId/status` (role: `admin`)
- `DELETE /api/videos/:videoId` (roles: `editor`, `admin`; editor can delete only own videos; removes video document, related shares, and stored files)

## Realtime events (Socket.io)

Authenticate socket with JWT in handshake:

- `auth: { token: "<jwt>" }`

Server emits:

- `video:progress` -> `{ videoId, phase, progress, status }`
- `video:status` -> `{ videoId, status, sensitivity }`
- `video:error` -> `{ videoId, status }`

## Notes

- Processed files live under `storage/videos/<videoId>/`.
- Legacy documents without `variants` fall back to streaming the original upload path.
- Viewer role is blocked from streaming **flagged** videos.
- Share assignment always resolves to a viewer account, looked up by either userId or email.
- For production-grade moderation, replace heuristics with a dedicated model or human review; FFmpeg here provides signal + transcoding.

## Testing

- Run tests: `npm test`
- Current tests cover:
  - RBAC middleware behavior
  - Upload mime validation
  - Video service owner isolation and stream readiness guard
