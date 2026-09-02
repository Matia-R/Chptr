# PartyKit Integration

This document describes the PartyKit integration for real-time collaborative editing.

## Overview

PartyKit replaces the previous y-webrtc peer-to-peer sync with a server-mediated WebSocket architecture. This provides:

- **Reliable sync**: No more WebRTC connection failures through firewalls
- **Single persistence point**: Only the PartyKit server writes to the database (no more duplicate saves from multiple clients)
- **Better scalability**: Server handles coordination instead of mesh connections between clients
- **Authorization on every connection**: Each WebSocket is checked against `document_permissions` before it can join the room

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Client A   │     │  Client B   │     │  Client C   │
│  (w/ JWT)   │     │  (w/ JWT)   │     │  (w/ JWT)   │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │ WebSocket + JWT
                           ▼
              ┌────────────────────────┐
              │   PartyKit Server      │
              │   - Authorize each     │
              │     connection         │
              │   - Manage Y.Doc       │
              └───────────┬────────────┘
                          │ HTTP + JWT + PARTYKIT_SECRET
                          ▼
              ┌────────────────────────┐
              │   Next.js API Routes   │
              │   /api/partykit/       │
              │   authorize | load |   │
              │   save                 │
              └───────────┬────────────┘
                          │ User JWT → auth.uid() + RLS
                          ▼
              ┌────────────────────────┐
              │       Supabase         │
              └────────────────────────┘
```

## Security Model

Authorization is a **per-connection** decision. Persistence is a **room** decision (Y.Doc bytes stay in memory after the first authorized load).

1. **Client authenticates with Supabase** and receives a JWT
2. **Client connects to PartyKit** with that JWT in query params
3. **PartyKit calls `/api/partykit/authorize` on every connect** (secret + JWT + document id + `isNew`)
4. **Authorize validates the JWT** with Supabase Auth (`getUser`), then checks `document_permissions` for `(document_id, user_id)`
5. **403 vs 404** uses the `document_exists` RPC (SECURITY DEFINER). A normal SELECT cannot tell these apart because RLS hides unauthorized rows as "not found"
6. **`isNew` only creates** when the document truly does not exist. If it exists and the user has no permission row, the socket is closed with 4003
7. **Only then** does PartyKit attach the socket to the Y.Doc. Later connections are authorized again; they do not skip the gate just because the room is already loaded
8. **Load/save** re-validate the JWT and permission, then run as that user so RLS still applies
9. **Saves** use a token from a currently connected authorized client (prefer one that is not expired), not a single room-level JWT

The JWT is not cryptographically verified inside PartyKit. Supabase Auth is the verifier. PartyKit will not join a connection until authorize returns 200.

### Error Codes

| HTTP (authorize/load/save) | WebSocket close | UI |
|----------------------------|-----------------|----|
| 401 | 4001 | Login required |
| 403 | 4003 | Restricted access |
| 404 | 4004 | Doc not found |
| 400 | 4000 | Bad URL |
| 500 | 4005 | Unable to load doc |

The document page maps `DocumentAccessError.code` onto those alerts. Auth close codes disable y-partykit reconnect so a 403 does not spin.

## Setup

### 1. Install PartyKit CLI

```bash
npm install -g partykit
```

### 2. Login to PartyKit

```bash
npx partykit login
```

### 3. Configure Environment Variables

Add to your `.env` file:

```env
# PartyKit host (for client-side)
NEXT_PUBLIC_PARTYKIT_HOST=localhost:1999  # dev
# NEXT_PUBLIC_PARTYKIT_HOST=chptr-collab.partykit.dev  # prod

# Shared secret for server-to-server auth
PARTYKIT_SECRET=your-secret-here  # Generate with: openssl rand -base64 32

# App URL for PartyKit server callbacks
APP_URL=http://localhost:3000  # dev
# APP_URL=https://your-app.vercel.app  # prod
```

### 4. Local Development

Run both the Next.js dev server and PartyKit dev server:

```bash
# Terminal 1: Next.js
npm run dev

# Terminal 2: PartyKit (use npm script, not npx!)
npm run dev:partykit
```

**Important:** Use `npm run dev:partykit` instead of `npx partykit dev`. The npx version downloads a fresh PartyKit that can't see your project's dependencies.

PartyKit dev server runs on `localhost:1999` by default.

### 5. Deploy PartyKit

```bash
npm run deploy:partykit
```

This deploys to PartyKit's free tier at `chptr-collab.partykit.dev`.

### 6. Configure PartyKit Environment Variables

After deploying, set the environment variables for the PartyKit server:

```bash
npx partykit env add APP_URL
# Enter: https://your-app.vercel.app

npx partykit env add PARTYKIT_SECRET
# Enter: your-secret-here (same as in your Next.js .env)
```

Note: For `env` commands, `npx partykit` is fine since it doesn't need to bundle code.

## Database Schema

The PartyKit integration uses a simplified single-table schema:

```sql
CREATE TABLE document_state (
    document_id UUID PRIMARY KEY REFERENCES documents(id),
    state_data BYTEA NOT NULL,    -- Full Y.Doc state
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**To set up:** Run the migrations in `migrations/partykit_document_state.sql` and `migrations/document_exists_rpc.sql`.

This replaces the old `document_changes` + `document_snapshots` tables with a single table. No more compaction needed since we always store the full state.

`document_exists(uuid)` is a `SECURITY DEFINER` RPC used only by authorize to distinguish missing documents from documents the caller cannot access.

## Files

| File | Purpose |
|------|---------|
| `partykit.json` | PartyKit configuration |
| `party/document.ts` | PartyKit server (per-connection authorize, Y.Doc, save token pool) |
| `src/hooks/use-collaborative-doc-partykit.ts` | Client hook (JWT, close codes, token refresh) |
| `src/lib/document-access-error.ts` | Typed document access errors for the editor page |
| `src/app/api/partykit/authorize/route.ts` | Validate JWT + permission; create-on-new only after a real miss |
| `src/app/api/partykit/load/route.ts` | Load Y.Doc state after permission check |
| `src/app/api/partykit/save/route.ts` | Save Y.Doc state after permission check |
| `src/server/partykit/auth.ts` | Shared secret/JWT/permission helpers |
| `src/utils/supabase/from-token.ts` | User-scoped Supabase client from a JWT |
| `migrations/partykit_document_state.sql` | `document_state` table + RLS |
| `migrations/document_exists_rpc.sql` | Privileged existence check |

## How It Works

### Client Connection

1. Client gets Supabase session (`access_token`)
2. `useCollaborativeDocPartykit` creates a Y.Doc and `YPartyKitProvider`
3. Provider connects to PartyKit with JWT + `isNew` in query params
4. On `TOKEN_REFRESHED`, the hook replaces the provider (same Y.Doc) so PartyKit stores a fresh token for saves
5. On 4001/4003/4004/4000/4005, reconnect is disabled and the document page shows the matching alert

### Server Lifecycle

1. Every client connect → `POST /api/partykit/authorize`
2. Unauthorized / forbidden / missing document → close the socket; do not call `y-partykit`
3. First *authorized* connection → `POST /api/partykit/load` and cache the Y.Doc in the room
4. Later authorized connections reuse the in-memory Y.Doc (they still authorized)
5. Edits broadcast to authorized clients in the room
6. Debounced save (1s / 5s max) uses a live authorized client's JWT
7. `onClose` drops that connection's token from the save pool

### Permission Enforcement

- **Authorize**: `getUser(jwt)` then `document_permissions` for this user. Create only if `isNew` and `document_exists` is false
- **Load**: Permission first. Missing `document_state` means empty doc, not access denied
- **Save**: Permission first, then upsert. RLS remains defense in depth
- **Connect**: Failed authorize never joins the CRDT room

## Costs

PartyKit runs on Cloudflare Workers. Estimated costs:

| Users | Monthly Cost |
|-------|--------------|
| 0-50 | $0 (free tier) |
| 50-500 | ~$5 |
| 500-2000 | ~$10-25 |
| 2000+ | ~$25-100 |

## Rollback

To revert to y-webrtc:

1. In `src/app/documents/[documentId]/page.tsx`:
   - Change import back to `use-collaborative-doc-crdt`
   - Change hook call back to `useCollaborativeDocCrdt`

2. In `src/app/_components/editor/editor.tsx`:
   - Change provider type back to `WebrtcProvider`

**Note:** The PartyKit integration uses a new `document_state` table. The old `document_changes` and `document_snapshots` tables are still present but not used. If you have existing documents that were created with the old system, you may need to migrate the data or keep both systems available.
