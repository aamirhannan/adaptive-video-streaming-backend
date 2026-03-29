# Adaptive Video Streaming Backend

Node.js + Express + MongoDB backend with MVC layering, JWT auth, role-based access control, local video storage via Multer, simulated sensitivity processing, Socket.io progress updates, and HTTP range streaming.

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

## Architecture

- Entry: `src/index.ts`
- App setup: `src/app.ts`
- Auth module: `src/modules/users/*`
- Video module: `src/modules/videos/*`
- Middleware: `src/middleware/*`
- Realtime: `src/realtime/socket.ts`

Dependency direction:

- Routes -> Controllers -> Services -> Repositories -> Models

## API (v1)

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me` (Bearer token required)

### Videos

- `POST /api/videos/upload` (roles: `editor`, `admin`; form-data field `video`)
- `GET /api/videos` (roles: `viewer`, `editor`, `admin`; optional query `status`, `sensitivity`)
- `GET /api/videos/:videoId` (owner-only)
- `GET /api/videos/:videoId/stream` (owner-only; supports range requests)
- `PATCH /api/videos/:videoId/status` (role: `admin`)

## Realtime events (Socket.io)

Authenticate socket with JWT in handshake:

- `auth: { token: "<jwt>" }`

Server emits:

- `video:progress` -> `{ videoId, phase, progress, status }`
- `video:status` -> `{ videoId, status, sensitivity }`
- `video:error` -> `{ videoId, status }`

## Notes

- Files are stored locally in `storage/videos`.
- The initial sensitivity classifier is deterministic filename-based logic and can be replaced by a real processing pipeline.
- Viewer role is blocked from streaming flagged videos.

## Testing

- Run tests: `npm test`
- Current tests cover:
  - RBAC middleware behavior
  - Upload mime validation
  - Video service owner isolation and stream readiness guard
