# PartyKit Integration

This document describes the PartyKit integration for real-time collaborative editing.

## Overview

PartyKit replaces the previous y-webrtc peer-to-peer sync with a server-mediated WebSocket architecture. This provides:

- **Reliable sync**: No more WebRTC connection failures through firewalls
- **Single persistence point**: Only the PartyKit server writes to the database (no more duplicate saves from multiple clients)
- **Better scalability**: Server handles coordination instead of mesh connections between clients

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Client A   │     │  Client B   │     │  Client C   │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │ WebSocket
                           ▼
              ┌────────────────────────┐
              │   PartyKit Server      │
              │   (per-document room)  │
              └───────────┬────────────┘
                          │ HTTP
                          ▼
              ┌────────────────────────┐
              │   Next.js API Routes   │
              │   /api/partykit/*      │
              └───────────┬────────────┘
                          │
                          ▼
              ┌────────────────────────┐
              │       Supabase         │
              └────────────────────────┘
```

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

# Supabase service role key (for PartyKit API routes)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# App URL for PartyKit server callbacks
APP_URL=http://localhost:3000  # dev
# APP_URL=https://your-app.vercel.app  # prod
```

### 4. Local Development

Run both the Next.js dev server and PartyKit dev server:

```bash
# Terminal 1: Next.js
npm run dev

# Terminal 2: PartyKit
npx partykit dev
```

PartyKit dev server runs on `localhost:1999` by default.

### 5. Deploy PartyKit

```bash
npx partykit deploy
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

## Files

| File | Purpose |
|------|---------|
| `partykit.json` | PartyKit configuration |
| `party/document.ts` | PartyKit server (Yjs room handler) |
| `src/hooks/use-collaborative-doc-partykit.ts` | Client-side hook |
| `src/app/api/partykit/load/route.ts` | API to load document state |
| `src/app/api/partykit/save/route.ts` | API to save document state |
| `src/utils/supabase/service-role.ts` | Supabase client with service role |

## How It Works

### Client Connection

1. Client opens document page
2. `useCollaborativeDocPartykit` hook creates a Y.Doc and YPartyKitProvider
3. Provider connects to PartyKit server via WebSocket
4. Provider syncs document state and awareness (cursors)

### Server Lifecycle

1. First client connects → PartyKit spins up room for that document ID
2. Room calls `/api/partykit/load` to fetch document state from Supabase
3. Room applies state to its Y.Doc
4. As clients make edits, Y.Doc updates are broadcast to all connected clients
5. Room debounces saves (1 second) and calls `/api/partykit/save`
6. Last client disconnects → room shuts down (but save completes first)

### Persistence

The PartyKit server saves the full Y.Doc state as a snapshot. This:

- Replaces the previous append-only change log approach
- Clears old changes from `document_changes` table after each save
- Eliminates the need for client-side compaction

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
