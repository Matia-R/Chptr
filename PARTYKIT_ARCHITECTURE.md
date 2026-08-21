# PartyKit Architecture

This document provides a comprehensive overview of the PartyKit-based real-time collaboration architecture, including user flows, edge cases, and future considerations.

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Data Flow](#data-flow)
- [Database Schema](#database-schema)
- [Security Model](#security-model)
- [User Flows](#user-flows)
- [Edge Cases](#edge-cases)
- [UX Optimizations](#ux-optimizations)
- [Caveats and Limitations](#caveats-and-limitations)
- [Future Considerations: Multi-User Collaboration](#future-considerations-multi-user-collaboration)
- [Data Migration](#data-migration)

---

## Overview

### Why PartyKit?

The previous architecture used `y-webrtc` for peer-to-peer sync between clients. This had several limitations:

| Problem | Impact |
|---------|--------|
| **Mesh topology** | N clients = N×(N-1)/2 connections. 5 users × 3 tabs = 105 WebRTC connections |
| **Firewall failures** | WebRTC P2P fails through corporate/strict firewalls with no fallback |
| **Redundant persistence** | Every client independently saves to database (N clients = N save streams) |
| **Complex compaction** | Append-only log + snapshots + background compaction logic |
| **Public signaling** | Relied on public STUN/TURN servers for connection establishment |

### PartyKit Solution

PartyKit provides a **server-mediated WebSocket architecture** running on Cloudflare's edge network:

| Benefit | Description |
|---------|-------------|
| **Star topology** | N clients = N connections (to central server) |
| **Universal connectivity** | WebSocket works through all firewalls |
| **Single writer** | Only PartyKit server persists to database |
| **Simple schema** | One table, full state, no compaction |
| **Free tier** | Cloudflare Workers free tier covers small-medium usage |

---

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                               │
├─────────────┬─────────────┬─────────────┬─────────────┬─────────────────┤
│  Browser A  │  Browser B  │  Mobile C   │  Browser D  │      ...        │
│  (Tab 1)    │  (Tab 2)    │  (App)      │  (User 2)   │                 │
│             │             │             │             │                 │
│ ┌─────────┐ │ ┌─────────┐ │ ┌─────────┐ │ ┌─────────┐ │                 │
│ │ Y.Doc   │ │ │ Y.Doc   │ │ │ Y.Doc   │ │ │ Y.Doc   │ │  Local Yjs      │
│ │ (local) │ │ │ (local) │ │ │ (local) │ │ │ (local) │ │  documents      │
│ └────┬────┘ │ └────┬────┘ │ └────┬────┘ │ └────┬────┘ │                 │
│      │ JWT  │      │ JWT  │      │ JWT  │      │ JWT  │                 │
└──────┼──────┴──────┼──────┴──────┼──────┴──────┼──────┴─────────────────┘
       │             │             │             │
       └─────────────┴──────┬──────┴─────────────┘
                            │
                    WebSocket + JWT
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         PARTYKIT SERVER LAYER                           │
│                      (Cloudflare Workers Edge)                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                    PartyKit Room (per document)                 │   │
│   │                                                                 │   │
│   │  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐  │   │
│   │  │   Y.Doc      │  │  Awareness   │  │   Connection Pool     │  │   │
│   │  │  (source of  │  │  (cursors,   │  │   (all connected      │  │   │
│   │  │   truth)     │  │   presence)  │  │    clients)           │  │   │
│   │  └──────────────┘  └──────────────┘  └───────────────────────┘  │   │
│   │                                                                 │   │
│   │  ┌──────────────────────────────────────────────────────────┐   │   │
│   │  │  Debounced Save Timer (1 second)                         │   │   │
│   │  │  - Batches rapid edits into single DB write              │   │   │
│   │  └──────────────────────────────────────────────────────────┘   │   │
│   │                                                                 │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                              HTTP + JWT
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          NEXT.JS API LAYER                              │
│                         (Vercel Serverless)                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────────────────┐    ┌─────────────────────────┐            │
│   │  /api/partykit/load     │    │  /api/partykit/save     │            │
│   │                         │    │                         │            │
│   │  - Receives JWT         │    │  - Receives JWT         │            │
│   │  - Creates Supabase     │    │  - Creates Supabase     │            │
│   │    client with JWT      │    │    client with JWT      │            │
│   │  - Queries document     │    │  - Upserts document     │            │
│   │  - RLS enforced         │    │  - RLS enforced         │            │
│   └────────────┬────────────┘    └────────────┬────────────┘            │
│                │                              │                         │
└────────────────┼──────────────────────────────┼─────────────────────────┘
                 │                              │
                 └──────────────┬───────────────┘
                                │
                         SQL + RLS
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          DATABASE LAYER                                 │
│                           (Supabase)                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │  documents                                                      │   │
│   │  - id, title, created_at, updated_at                            │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│                              │ FK                                       │
│                              ▼                                          │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │  document_state                                                 │   │
│   │  - document_id (PK, FK)                                         │   │
│   │  - state_data (BYTEA) ← Full Y.Doc encoded state                │   │
│   │  - updated_at                                                   │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │  document_permissions                                           │   │
│   │  - document_id, user_id, permission_level                       │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│   Row Level Security (RLS) enforced on all tables                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility |
|-----------|----------------|
| **Client (Browser)** | Local Y.Doc, UI rendering, user input, JWT management |
| **YPartyKitProvider** | WebSocket connection, Yjs sync protocol, awareness |
| **PartyKit Room** | Central Y.Doc, broadcast updates, debounced persistence |
| **Next.js API** | JWT→Supabase client, RLS-enforced DB operations |
| **Supabase** | Document storage, permissions, RLS enforcement |

---

## Data Flow

### Connection & Initial Load

```
┌──────────┐          ┌──────────┐          ┌──────────┐          ┌──────────┐
│  Client  │          │ PartyKit │          │ Next.js  │          │ Supabase │
└────┬─────┘          └────┬─────┘          └────┬─────┘          └────┬─────┘
     │                     │                     │                     │
     │ 1. Get Supabase Session                   │                     │
     │────────────────────────────────────────────────────────────────►│
     │◄────────────────────────────────────────────────────────────────│
     │     { access_token (JWT) }                │                     │
     │                     │                     │                     │
     │ 2. WebSocket Connect                      │                     │
     │    ?token=JWT&isNew=false                 │                     │
     │────────────────────►│                     │                     │
     │                     │                     │                     │
     │                     │ 3. Verify JWT       │                     │
     │                     │    (not expired)    │                     │
     │                     │                     │                     │
     │                     │ 4. POST /api/partykit/load               │
     │                     │    Authorization: Bearer JWT              │
     │                     │    { documentId }   │                     │
     │                     │────────────────────►│                     │
     │                     │                     │                     │
     │                     │                     │ 5. Query with JWT   │
     │                     │                     │────────────────────►│
     │                     │                     │◄────────────────────│
     │                     │                     │   { state_data }    │
     │                     │◄────────────────────│                     │
     │                     │   { state }         │                     │
     │                     │                     │                     │
     │ 6. Yjs Sync         │                     │                     │
     │◄───────────────────►│                     │                     │
     │   (document state)  │                     │                     │
     │                     │                     │                     │
```

### Edit & Save Flow

```
┌──────────┐          ┌──────────┐          ┌──────────┐          ┌──────────┐
│  Client  │          │ PartyKit │          │ Next.js  │          │ Supabase │
└────┬─────┘          └────┬─────┘          └────┬─────┘          └────┬─────┘
     │                     │                     │                     │
     │ 1. User types       │                     │                     │
     │    (local Y.Doc     │                     │                     │
     │     updates)        │                     │                     │
     │                     │                     │                     │
     │ 2. Yjs Update       │                     │                     │
     │────────────────────►│                     │                     │
     │                     │                     │                     │
     │                     │ 3. Apply to         │                     │
     │                     │    server Y.Doc     │                     │
     │                     │                     │                     │
     │                     │ 4. Broadcast to     │                     │
     │◄────────────────────│    other clients    │                     │
     │                     │────────────────────►│ (other clients)     │
     │                     │                     │                     │
     │                     │ 5. Start/reset      │                     │
     │                     │    debounce timer   │                     │
     │                     │    (1 second)       │                     │
     │                     │                     │                     │
     │                     │      ... 1s ...     │                     │
     │                     │                     │                     │
     │                     │ 6. POST /api/partykit/save               │
     │                     │    Authorization: Bearer JWT              │
     │                     │    { documentId, state }                  │
     │                     │────────────────────►│                     │
     │                     │                     │                     │
     │                     │                     │ 7. Upsert with JWT  │
     │                     │                     │────────────────────►│
     │                     │                     │◄────────────────────│
     │                     │◄────────────────────│   { success }       │
     │                     │                     │                     │
```

---

## Database Schema

### New Schema (PartyKit)

```sql
-- Single table for full document state
CREATE TABLE document_state (
    document_id UUID PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
    state_data BYTEA NOT NULL,      -- Full Y.Doc encoded state
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
CREATE POLICY "Users can read document_state if they have document permission"
    ON document_state FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM document_permissions
            WHERE document_permissions.document_id = document_state.document_id
            AND document_permissions.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can write document_state if they have write permission"
    ON document_state FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM document_permissions
            WHERE document_permissions.document_id = document_state.document_id
            AND document_permissions.user_id = auth.uid()
            AND document_permissions.permission_level IN ('owner', 'editor')
        )
    );
```

### Schema Comparison

| Aspect | Old (y-webrtc) | New (PartyKit) |
|--------|----------------|----------------|
| **Tables** | `document_changes` + `document_snapshots` | `document_state` |
| **Rows per doc** | Many (1 per change) + 1 snapshot | 1 |
| **Compaction** | Required (when changes > 100) | Not needed |
| **Storage** | Incremental updates | Full state |
| **Complexity** | High (compaction logic) | Low |

---

## Security Model

### JWT Flow Through the System

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          SECURITY FLOW                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. USER AUTHENTICATES                                                  │
│     ┌──────────┐     ┌──────────┐                                       │
│     │  User    │────►│ Supabase │  User logs in with email/password    │
│     │          │◄────│  Auth    │  Receives JWT (access_token)          │
│     └──────────┘     └──────────┘                                       │
│           │                                                             │
│           │ JWT contains: { sub: user_id, exp: expiry, ... }            │
│           ▼                                                             │
│  2. CLIENT CONNECTS TO PARTYKIT                                         │
│     ┌──────────┐     ┌──────────┐                                       │
│     │  Client  │────►│ PartyKit │  WebSocket: ?token=JWT&isNew=...      │
│     │          │     │  Server  │                                       │
│     └──────────┘     └──────────┘                                       │
│                            │                                            │
│                            │ Decodes JWT, checks exp > now              │
│                            │ (Does NOT verify signature - trusts        │
│                            │  that Supabase will reject invalid JWTs)   │
│                            ▼                                            │
│  3. PARTYKIT CALLS API WITH USER'S JWT                                  │
│     ┌──────────┐     ┌──────────┐                                       │
│     │ PartyKit │────►│ Next.js  │  Authorization: Bearer <user's JWT>   │
│     │  Server  │     │   API    │                                       │
│     └──────────┘     └──────────┘                                       │
│                            │                                            │
│                            │ Creates Supabase client WITH user's JWT    │
│                            │ (not service role key)                     │
│                            ▼                                            │
│  4. SUPABASE ENFORCES RLS                                               │
│     ┌──────────┐     ┌──────────┐                                       │
│     │ Next.js  │────►│ Supabase │  Query runs as the user               │
│     │   API    │◄────│    DB    │  RLS policies check auth.uid()        │
│     └──────────┘     └──────────┘                                       │
│                                                                         │
│  ═══════════════════════════════════════════════════════════════════    │
│  RESULT: User can only access documents they have permission to.        │
│          No service role key. No elevated privileges.                   │
│  ═══════════════════════════════════════════════════════════════════    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Error Codes

| WebSocket Close Code | Meaning | Client Behavior |
|---------------------|---------|-----------------|
| `4001` | Token missing | Redirect to login |
| `4002` | Token expired | Refresh token, reconnect |
| `4003` | Permission denied (can't load) | Show "Access denied" error |
| `4004` | Document not found | Show "Document not found" error |

---

## User Flows

### Flow 1: Creating a New Document

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     NEW DOCUMENT CREATION FLOW                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. User clicks "New Document"                                          │
│     ┌──────────┐                                                        │
│     │  Client  │  - Generate UUID for new document                      │
│     │          │  - Set isNew=true flag in memory                       │
│     │          │  - Navigate to /documents/{new-uuid}                   │
│     └──────────┘                                                        │
│           │                                                             │
│           │ Instant navigation (no API call yet)                        │
│           ▼                                                             │
│  2. DocumentPage renders                                                │
│     ┌──────────┐                                                        │
│     │  Client  │  - Hook detects isNew=true                             │
│     │          │  - Renders blank screen (no skeleton)                  │
│     │          │  - Connects to PartyKit with isNew=true                │
│     └──────────┘                                                        │
│           │                                                             │
│           ▼                                                             │
│  3. PartyKit receives connection                                        │
│     ┌──────────┐                                                        │
│     │ PartyKit │  - Verifies JWT                                        │
│     │  Server  │  - Calls /api/partykit/load with isNew=true            │
│     └──────────┘                                                        │
│           │                                                             │
│           ▼                                                             │
│  4. Load API handles new document                                       │
│     ┌──────────┐                                                        │
│     │ Next.js  │  - Checks if document exists → NO                      │
│     │   API    │  - Since isNew=true:                                   │
│     │          │    - Calls create_document_with_owner RPC              │
│     │          │    - Creates document + owner permission atomically    │
│     │          │  - Returns { state: null } (empty doc)                 │
│     └──────────┘                                                        │
│           │                                                             │
│           ▼                                                             │
│  5. Editor ready                                                        │
│     ┌──────────┐                                                        │
│     │  Client  │  - Y.Doc initialized (empty)                           │
│     │          │  - Editor renders                                      │
│     │          │  - User can start typing immediately                   │
│     └──────────┘                                                        │
│           │                                                             │
│           ▼                                                             │
│  6. First edit triggers save                                            │
│     ┌──────────┐                                                        │
│     │ PartyKit │  - Debounce timer starts                               │
│     │  Server  │  - After 1s, calls /api/partykit/save                  │
│     │          │  - document_state row created                          │
│     └──────────┘                                                        │
│                                                                         │
│  ═══════════════════════════════════════════════════════════════════    │
│  RESULT: User sees empty editor instantly. Document created on first    │
│          connection. State persisted on first edit.                     │
│  ═══════════════════════════════════════════════════════════════════    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Flow 2: Opening an Existing Document

```
┌─────────────────────────────────────────────────────────────────────────┐
│                   EXISTING DOCUMENT OPEN FLOW                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. User navigates to /documents/{existing-uuid}                        │
│     ┌──────────┐                                                        │
│     │  Client  │  - isNew=false (not from "New Document" flow)          │
│     │          │  - Renders nothing initially (< 250ms)                 │
│     │          │  - If > 250ms: show loading skeleton                   │
│     └──────────┘                                                        │
│           │                                                             │
│           ▼                                                             │
│  2. Connect to PartyKit                                                 │
│     ┌──────────┐     ┌──────────┐                                       │
│     │  Client  │────►│ PartyKit │  WebSocket with JWT, isNew=false      │
│     └──────────┘     └──────────┘                                       │
│                            │                                            │
│                            ▼                                            │
│  3. Load document state                                                 │
│     ┌──────────┐     ┌──────────┐     ┌──────────┐                      │
│     │ PartyKit │────►│ Next.js  │────►│ Supabase │                      │
│     │          │◄────│   API    │◄────│          │                      │
│     └──────────┘     └──────────┘     └──────────┘                      │
│           │                                                             │
│           │ Apply state to Y.Doc, sync to client                        │
│           ▼                                                             │
│  4. Editor renders with content                                         │
│     ┌──────────┐                                                        │
│     │  Client  │  - Y.Doc populated with existing content               │
│     │          │  - Editor renders                                      │
│     │          │  - User can continue editing                           │
│     └──────────┘                                                        │
│                                                                         │
│  ═══════════════════════════════════════════════════════════════════    │
│  TYPICAL LOAD TIME: < 100ms (fast network)                              │
│  SKELETON APPEARS: Only if load takes > 250ms                           │
│  ═══════════════════════════════════════════════════════════════════    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Flow 3: Multi-Tab / Multi-Device (Same User)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    MULTI-TAB SYNCHRONIZATION                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│     ┌──────────┐          ┌──────────┐          ┌──────────┐            │
│     │  Tab 1   │          │  Tab 2   │          │  Mobile  │            │
│     │ (laptop) │          │ (laptop) │          │  (phone) │            │
│     └────┬─────┘          └────┬─────┘          └────┬─────┘            │
│          │                     │                     │                  │
│          │    All same user, all same document       │                  │
│          │                     │                     │                  │
│          └─────────────────────┼─────────────────────┘                  │
│                                │                                        │
│                         ┌──────┴──────┐                                 │
│                         │  PartyKit   │                                 │
│                         │    Room     │                                 │
│                         │             │                                 │
│                         │  Y.Doc (1)  │  Single source of truth         │
│                         └──────┬──────┘                                 │
│                                │                                        │
│   User types in Tab 1:         │                                        │
│   ─────────────────────────────┼────────────────────────────────        │
│   Tab 1 → PartyKit → Tab 2     │                                        │
│                    → Mobile    │                                        │
│                                │                                        │
│   Changes sync in ~10-50ms (WebSocket latency)                          │
│                                │                                        │
│   Only ONE save to database    │                                        │
│   (from PartyKit, not clients) │                                        │
│                                │                                        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Edge Cases

### Edge Case 1: New Document, No Edits, Duplicate Tab

**Scenario:** User creates a new document, doesn't type anything, then duplicates the tab or opens the same URL in another tab.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  Timeline:                                                              │
│  ─────────────────────────────────────────────────────────────────      │
│                                                                         │
│  T0: User clicks "New Document"                                         │
│      → Tab 1 opens /documents/{uuid}                                    │
│      → isNew=true flag set                                              │
│      → Connects to PartyKit                                             │
│      → Load API creates document (via RPC)                              │
│      → Empty editor shown                                               │
│                                                                         │
│  T1: User duplicates tab (Cmd+D) without typing                         │
│      → Tab 2 opens same URL                                             │
│      → isNew=false (flag only in Tab 1's memory)                        │
│      → Connects to PartyKit                                             │
│      → Load API finds document exists → returns state (empty)           │
│      → Empty editor shown                                               │
│                                                                         │
│  T2: User types in Tab 1                                                │
│      → Update syncs to Tab 2 via PartyKit                               │
│      → Both tabs show same content                                      │
│                                                                         │
│  RESULT: Works correctly. Document exists after first connection.       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Edge Case 2: Token Expiration During Edit Session

**Scenario:** User's JWT expires while they are actively editing.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  Current Behavior:                                                      │
│  ─────────────────────────────────────────────────────────────────      │
│                                                                         │
│  1. User editing for extended period                                    │
│  2. JWT expires (typically 1 hour)                                      │
│  3. Next save attempt fails (API rejects expired JWT)                   │
│  4. PartyKit logs error but keeps Y.Doc in memory                       │
│  5. Client still has local Y.Doc with all changes                       │
│                                                                         │
│  Mitigation:                                                            │
│  ─────────────────────────────────────────────────────────────────      │
│                                                                         │
│  - Supabase client auto-refreshes tokens in background                  │
│  - Client hook could detect token refresh and reconnect                 │
│  - PartyKit could close connection on save failure, prompting           │
│    client to reconnect with fresh token                                 │
│                                                                         │
│  Current Risk: Low (most edit sessions < 1 hour)                        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Edge Case 3: Network Disconnection

**Scenario:** User loses internet connection while editing.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  Behavior:                                                              │
│  ─────────────────────────────────────────────────────────────────      │
│                                                                         │
│  1. Network drops                                                       │
│  2. WebSocket disconnects                                               │
│  3. YPartyKitProvider attempts reconnection (exponential backoff)       │
│  4. User can continue typing (local Y.Doc still works)                  │
│  5. Edits queue locally                                                 │
│  6. Network returns                                                     │
│  7. WebSocket reconnects                                                │
│  8. Y.Doc syncs accumulated changes                                     │
│  9. PartyKit debounces and saves                                        │
│                                                                         │
│  Data Safety:                                                           │
│  ─────────────────────────────────────────────────────────────────      │
│                                                                         │
│  - Local edits preserved in Y.Doc (memory)                              │
│  - NOT persisted to disk during offline                                 │
│  - If user closes browser while offline, changes lost                   │
│                                                                         │
│  Note: True offline support would require IndexedDB persistence         │
│        (see Future Considerations)                                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Edge Case 4: Large Document Load Time

**Scenario:** Document has extensive content, resulting in large Y.Doc state.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  Factors Affecting Load Time:                                           │
│  ─────────────────────────────────────────────────────────────────      │
│                                                                         │
│  1. state_data size (BYTEA column)                                      │
│  2. Network latency (user ↔ Supabase region)                            │
│  3. Y.Doc deserialization time                                          │
│                                                                         │
│  Estimated Load Times:                                                  │
│  ─────────────────────────────────────────────────────────────────      │
│                                                                         │
│  | Document Size  | State Size | Fast Network | Slow Network |          │
│  |----------------|------------|--------------|--------------|          │
│  | Small (1 page) | ~5 KB      | < 50ms       | < 200ms      |          │
│  | Medium (10 pg) | ~50 KB     | < 100ms      | < 500ms      |          │
│  | Large (100 pg) | ~500 KB    | < 300ms      | 1-2s         |          │
│  | Huge (1000 pg) | ~5 MB      | 1-2s         | 5-10s        |          │
│                                                                         │
│  Mitigation (Current):                                                  │
│  ─────────────────────────────────────────────────────────────────      │
│                                                                         │
│  - Delayed loading skeleton (shows after 250ms)                         │
│  - Fast loads: no flicker                                               │
│  - Slow loads: skeleton provides feedback                               │
│                                                                         │
│  Mitigation (Future):                                                   │
│  ─────────────────────────────────────────────────────────────────      │
│                                                                         │
│  - Lazy loading (load visible blocks first)                             │
│  - Document chunking                                                    │
│  - CDN caching for frequently accessed docs                             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Edge Case 5: Document Deleted While Being Edited

**Scenario:** User A is editing a document. User B (or an admin) deletes it.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  Current Behavior:                                                      │
│  ─────────────────────────────────────────────────────────────────      │
│                                                                         │
│  1. User A is editing document                                          │
│  2. Document deleted from database                                      │
│  3. User A continues editing (local Y.Doc)                              │
│  4. Next save attempt fails:                                            │
│     - document_state FK constraint fails                                │
│     - OR RLS blocks access (permission row deleted)                     │
│  5. PartyKit logs error                                                 │
│  6. User A's local changes exist but cannot be saved                    │
│                                                                         │
│  Recommended Future Handling:                                           │
│  ─────────────────────────────────────────────────────────────────      │
│                                                                         │
│  - Detect save failure due to deletion                                  │
│  - Notify user: "This document has been deleted"                        │
│  - Offer to create a new document with current content                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## UX Optimizations

### Delayed Loading Skeleton

To avoid "flicker" on fast loads while still providing feedback on slow loads:

```typescript
const SKELETON_DELAY_MS = 250;

const [showSkeleton, setShowSkeleton] = useState(false);
const isStillLoading = isLoading || !isReady || !ydoc || !provider;

useEffect(() => {
  if (!isStillLoading) {
    setShowSkeleton(false);
    return;
  }
  const timer = setTimeout(() => setShowSkeleton(true), SKELETON_DELAY_MS);
  return () => clearTimeout(timer);
}, [isStillLoading]);

// Render:
// - Fast load (< 250ms): blank → editor (no skeleton)
// - Slow load (> 250ms): blank → skeleton → editor
```

### Instant New Document Feel

New document creation feels instant because:

1. No API call before navigation (UUID generated client-side)
2. No loading skeleton shown (returns `null` while connecting)
3. Document created during first WebSocket connection
4. Empty editor appears as soon as connection established

---

## Caveats and Limitations

### 1. No True Offline Support

**Current:** Local Y.Doc exists only in memory. If browser closes during network outage, unsaved changes are lost.

**Mitigation:** Could add IndexedDB persistence layer (y-indexeddb) for offline resilience.

### 2. Single Room = Single JWT

**Current:** PartyKit room uses the JWT of the first client that connected (the "initializer"). Subsequent clients connect but room still uses initializer's JWT for saves.

**Implication:** If initializer's permissions change (e.g., demoted from editor to viewer), saves may fail.

**Mitigation:** Could rotate JWT to most recently connected client with write permissions, or require each save to use a still-connected client's JWT.

### 3. JWT Not Cryptographically Verified by PartyKit

**Current:** PartyKit only checks that JWT is not expired (decodes payload, checks `exp`). It does not verify the signature.

**Why This Is OK:** The real security enforcement happens at Supabase when the API route uses the JWT to create a client. Invalid/forged JWTs will fail at that layer.

**Risk:** A malicious actor could potentially connect to PartyKit with a forged JWT, but any actual database operations would fail.

### 4. Debounce Delay Before Persistence

**Current:** Changes are debounced for 1 second before saving. If PartyKit server crashes within that window, those changes are lost.

**Risk:** Very low (Cloudflare Workers are highly reliable), but theoretically possible.

**Mitigation:** Could reduce debounce time or implement optimistic persistence.

### 5. No Conflict Resolution UI

**Current:** Yjs handles conflicts automatically using CRDT semantics. No user-facing conflict resolution.

**Implication:** In rare cases, Yjs's automatic resolution might not match user intent (e.g., both users editing same sentence).

**Mitigation:** For most text editing, Yjs's approach is acceptable. Heavy concurrent editing of the same section could use operational transform or last-writer-wins at block level.

---

## Future Considerations: Multi-User Collaboration

### Sharing Flow Design

When collaboration is enabled, the recommended flow:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     FUTURE: SHARING A DOCUMENT                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Scenario: User A wants to share with User B                            │
│                                                                         │
│  1. User A clicks "Share" button                                        │
│                                                                         │
│  2. Check if document has initial save:                                 │
│     ┌────────────────────────────────────────────────────────────┐      │
│     │  IF document_state row exists:                             │      │
│     │     → Proceed to share dialog                              │      │
│     │                                                            │      │
│     │  IF document_state row does NOT exist:                     │      │
│     │     → Force save current Y.Doc state first                 │      │
│     │     → Then proceed to share dialog                         │      │
│     └────────────────────────────────────────────────────────────┘      │
│                                                                         │
│  3. User A enters User B's email                                        │
│                                                                         │
│  4. Create permission record:                                           │
│     INSERT INTO document_permissions                                    │
│       (document_id, user_id, permission_level)                          │
│     VALUES ({doc}, {user_b}, 'editor')                                  │
│                                                                         │
│  5. User B can now access the document                                  │
│                                                                         │
│  Note: Shared link without explicit permission shows                    │
│        "Access denied" or "Document not found" (no auto-share)          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Awareness Features (Presence, Cursors)

YPartyKitProvider already supports Yjs Awareness:

```typescript
// Already available via provider.awareness
provider.awareness.setLocalStateField('user', {
  name: userName,
  color: userColor,
});

// BlockNote can show other users' cursors automatically
// when configured with awareness
```

Future work:
- Show avatars of connected users
- Show cursor positions in document
- Show "User X is editing..." indicators

### Permission Levels

Current schema supports:

| Level | Can Read | Can Edit | Can Delete | Can Share |
|-------|----------|----------|------------|-----------|
| `viewer` | ✓ | ✗ | ✗ | ✗ |
| `editor` | ✓ | ✓ | ✗ | ✗ |
| `owner` | ✓ | ✓ | ✓ | ✓ |

RLS policies should enforce these based on `permission_level`.

### Rate Limiting / Abuse Prevention

Considerations for production:

1. **Connection limits**: Max connections per document
2. **Save rate limiting**: Max saves per minute per document
3. **Document size limits**: Max state_data size
4. **User connection limits**: Max documents per user

### Webhooks / Real-time Notifications

Future: Notify users when:
- Someone shares a document with them
- Someone joins a document they're editing
- Significant changes made to shared document

---

## Data Migration

### Migrating from Old Schema

If you have existing documents using the old `document_changes` + `document_snapshots` schema:

```sql
-- Migration script to convert existing documents to new schema
INSERT INTO document_state (document_id, state_data, updated_at)
SELECT 
    ds.document_id,
    ds.snapshot_data as state_data,  -- Use latest snapshot
    ds.created_at as updated_at
FROM document_snapshots ds
WHERE NOT EXISTS (
    SELECT 1 FROM document_state 
    WHERE document_id = ds.document_id
);

-- Note: This uses snapshots only. For full accuracy, you would need to:
-- 1. Load snapshot
-- 2. Apply all changes since snapshot
-- 3. Encode full Y.Doc state
-- 4. Insert into document_state
```

### Rollback Procedure

To revert to y-webrtc:

1. Restore old hook import in `page.tsx`
2. Restore `WebrtcProvider` type in `editor.tsx`
3. Keep `document_state` table (no harm)
4. Old `document_changes` and `document_snapshots` tables still exist

---

## Summary

| Aspect | Implementation |
|--------|----------------|
| **Sync Protocol** | Yjs over WebSocket via PartyKit |
| **Topology** | Star (all clients → PartyKit → database) |
| **Persistence** | Server-side only, debounced 1s |
| **Schema** | Single `document_state` table |
| **Security** | JWT flows through entire system, RLS enforced |
| **New Doc UX** | Instant (no skeleton, create on connect) |
| **Existing Doc UX** | Delayed skeleton (250ms threshold) |
| **Multi-tab** | Fully supported via PartyKit sync |
| **Offline** | Limited (local Y.Doc only, no IndexedDB) |
| **Cost** | Free tier for small usage |

This architecture provides a solid foundation for single-user multi-device editing, with clear paths to enable multi-user collaboration when needed.
