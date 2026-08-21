# PartyKit Integration

This document describes the PartyKit integration for real-time collaborative editing.

## Overview

PartyKit replaces the previous y-webrtc peer-to-peer sync with a server-mediated WebSocket architecture. This provides:

- **Reliable sync**: No more WebRTC connection failures through firewalls
- **Single persistence point**: Only the PartyKit server writes to the database (no more duplicate saves from multiple clients)
- **Better scalability**: Server handles coordination instead of mesh connections between clients
- **RLS respected**: User authentication is verified on every connection

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
              │   - Verifies JWT       │
              │   - Manages Y.Doc      │
              └───────────┬────────────┘
                          │ HTTP + JWT
                          ▼
              ┌────────────────────────┐
              │   Next.js API Routes   │
              │   /api/partykit/*      │
              └───────────┬────────────┘
                          │ RLS enforced
                          ▼
              ┌────────────────────────┐
              │       Supabase         │
              └────────────────────────┘
```

## Security Model

1. **Client authenticates with Supabase** and receives a JWT
2. **Client connects to PartyKit** with JWT in query params
3. **PartyKit verifies** the JWT is not expired
4. **PartyKit calls API routes** with the user's JWT
5. **API routes create Supabase client** using that JWT
6. **RLS automatically enforced** - users can only access documents they have permission to

No service role key is used. The user's own credentials flow through the entire system.

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

## Files

| File | Purpose |
|------|---------|
| `partykit.json` | PartyKit configuration |
| `party/document.ts` | PartyKit server (Yjs room handler, JWT verification) |
| `src/hooks/use-collaborative-doc-partykit.ts` | Client-side hook (gets session, passes JWT) |
| `src/app/api/partykit/load/route.ts` | API to load document state (uses user's JWT) |
| `src/app/api/partykit/save/route.ts` | API to save document state (uses user's JWT) |
| `src/utils/supabase/from-token.ts` | Creates Supabase client from JWT |

## How It Works

### Client Connection

1. Client gets Supabase session (includes access_token)
2. `useCollaborativeDocPartykit` hook creates a Y.Doc and YPartyKitProvider
3. Provider connects to PartyKit server with JWT in query params
4. Provider syncs document state and awareness (cursors)

### Server Lifecycle

1. First client connects with JWT → PartyKit verifies JWT not expired
2. Room calls `/api/partykit/load` with user's JWT
3. API route creates Supabase client with that JWT → RLS enforced
4. If user has access, document loads; otherwise, connection rejected
5. As clients make edits, Y.Doc updates are broadcast to all connected clients
6. Room debounces saves (1 second) and calls `/api/partykit/save` with JWT
7. Last client disconnects → room shuts down (but save completes first)

### Permission Enforcement

- **Load**: If user can't read the document, the Supabase query returns nothing/error
- **Save**: If user can't write to the document, the Supabase upsert fails
- **Connect**: If load fails due to permissions, the connection is closed with code 4003

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

The database schema is unchanged, so rollback is seamless.
