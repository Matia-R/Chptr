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
                    HTTP + JWT + PARTYKIT_SECRET
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          NEXT.JS API LAYER                              │
│                         (Vercel Serverless)                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────────────────┐    ┌─────────────────────────┐            │
│   │  /api/partykit/connect  │    │  /api/partykit/save     │            │
│   │                         │    │                         │            │
│   │  - getUser(JWT)         │    │  - Re-validate JWT      │            │
│   │  - Check permission row │    │  - Check permission     │            │
│   │  - 403 vs 404 via RPC   │    │  - Upsert state         │            │
│   │  - Create only if isNew │    │  - RLS still applies    │            │
│   │    and doc is missing   │    │                         │            │
│   │  - Return Y.Doc state   │    │                         │            │
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
| **Client (Browser)** | Local Y.Doc, UI rendering, user input, JWT + error-code mapping |
| **YPartyKitProvider** | WebSocket connection, Yjs sync protocol, awareness |
| **PartyKit Room** | Authorize every socket, central Y.Doc, broadcast, save-token pool |
| **Next.js API** | `/connect` (JWT + permission + state), `/save` (re-check + RLS) |
| **Supabase** | Document storage, permissions, RLS, `document_exists` RPC |

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
     │                     │ 3. POST /api/partykit/connect             │
     │                     │    (every connection)                     │
     │                     │────────────────────►│                     │
     │                     │                     │ 4. getUser(JWT)     │
     │                     │                     │    permission row   │
     │                     │                     │    document_state   │
     │                     │                     │────────────────────►│
     │                     │                     │◄────────────────────│
     │                     │◄────────────────────│                     │
     │                     │   200 { userId, state } or 401/403/404    │
     │                     │                     │                     │
     │ 5. Yjs Sync         │                     │                     │
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
     │                     │    JWT from a live authorized client       │
     │                     │    { documentId, state }                  │
     │                     │────────────────────►│                     │
     │                     │                     │                     │
     │                     │                     │ 7. Re-check         │
     │                     │                     │    permission +     │
     │                     │                     │    upsert as user   │
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

Authorization is **per connection**. The in-memory Y.Doc is cached after the first *authorized* load; that cache is never a substitute for a permission check.

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
│           ▼                                                             │
│  2. CLIENT CONNECTS TO PARTYKIT                                         │
│     ┌──────────┐     ┌──────────┐                                       │
│     │  Client  │────►│ PartyKit │  WebSocket: ?token=JWT&isNew=...      │
│     │          │     │  Server  │                                       │
│     └──────────┘     └──────────┘                                       │
│                            │                                            │
│                            │ Every connect calls /connect.              │
│                            │ PartyKit does not treat JWT expiry         │
│                            │ as the access check.                       │
│                            ▼                                            │
│  3. POST /api/partykit/connect                                          │
│     ┌──────────┐     ┌──────────┐                                       │
│     │ PartyKit │────►│ Next.js  │  PARTYKIT_SECRET + Bearer JWT         │
│     │  Server  │     │   API    │                                       │
│     └──────────┘     └──────────┘                                       │
│                            │                                            │
│                            │ a. getUser(JWT) via Auth (signature + exp) │
│                            │ b. SELECT document_permissions             │
│                            │    WHERE document_id AND user_id           │
│                            │ c. If no row: document_exists()            │
│                            │    exists → 403, missing → 404             │
│                            │    missing + isNew → create as owner       │
│                            │ d. Return document_state in the same body  │
│                            ▼                                            │
│  4. ONLY THEN JOIN THE Y.DOC ROOM                                       │
│     Save (any live token) re-checks JWT + permission, then writes as    │
│     that user so RLS applies.                                           │
│                                                                         │
│  ═══════════════════════════════════════════════════════════════════    │
│  RESULT: A forged or other-user JWT cannot join a loaded room.          │
│          isNew cannot mint access to an existing document.              │
│          Empty document_state is not treated as "allowed in".           │
│  ═══════════════════════════════════════════════════════════════════    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Error Codes

| HTTP | WebSocket Close Code | Meaning | Client Behavior |
|------|---------------------|---------|-----------------|
| 400 | `4000` | Bad request | Show "Bad URL"; stop reconnect |
| 401 | `4001` | Missing / invalid / expired token | Refresh session and reconnect. Show "Login required" only if there is no session |
| 403 | `4003` | Signed in, no permission | Show "Restricted access"; stop reconnect |
| 404 | `4004` | Document does not exist | Show "Doc not found"; stop reconnect |
| 500 | `4005` | Connect failure (app unreachable) | Treat as connection lost; retry with a fresh JWT |

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
│     │          │  - Empty Y.Doc + provider are ready immediately        │
│     │          │  - Editor renders (no skeleton, does not wait for sync)│
│     │          │  - Connects to PartyKit in the background              │
│     └──────────┘                                                        │
│           │                                                             │
│           ▼                                                             │
│  3. PartyKit receives connection                                        │
│     ┌──────────┐                                                        │
│     │ PartyKit │  - Calls /api/partykit/connect with isNew=true         │
│     │  Server  │  - created=true → empty Y.Doc (no extra load hop)      │
│     └──────────┘                                                        │
│           │                                                             │
│           ▼                                                             │
│  4. Authorize API handles new document                                  │
│     ┌──────────┐                                                        │
│     │ Next.js  │  - JWT valid, no permission row                        │
│     │   API    │  - document_exists → false                             │
│     │          │  - isNew=true → create_document_with_owner             │
│     │          │  - Returns { userId, permission: owner, created: true }│
│     │          │  If the id already exists → 403 (not create)           │
│     │          │  If permission already exists → created: false (load)  │
│     └──────────┘                                                        │
│           │                                                             │
│           ▼                                                             │
│  5. User is already typing                                              │
│     ┌──────────┐                                                        │
│     │  Client  │  - Local edits merge into the empty PartyKit Y.Doc     │
│     │          │    once the socket syncs                               │
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
│  RESULT: User sees empty editor immediately. Authorize creates the      │
│          document in the background. State persists on first edit.      │
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
│  2. Snapshot + PartyKit in parallel                                     │
│     ┌──────────┐     ┌──────────┐                                       │
│     │  Client  │────►│ tRPC     │  getDocumentState (cache if hovered)  │
│     │          │────►│ PartyKit │  WebSocket → POST /connect            │
│     └──────────┘     └──────────┘                                       │
│           │                                                             │
│           │ First of: cached/tRPC snapshot or PartyKit sync → editor    │
│           │ 401/403/404 → matching UI alert                             │
│           ▼                                                             │
│  3. Editor renders with content                                         │
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
│      → Authorize creates document (via RPC)                             │
│      → Empty editor shown                                               │
│                                                                         │
│  T1: User duplicates tab (Cmd+D) without typing                         │
│      → Tab 2 opens same URL                                             │
│      → isNew=false (flag only in Tab 1's memory)                        │
│      → Connects to PartyKit                                             │
│      → Authorize finds permission row → 200                             │
│      → Load returns empty state (or live Y.Doc if Tab 1 is connected)   │
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
│  2. Supabase refreshes the access token in the browser                  │
│  3. Hook sees TOKEN_REFRESHED, replaces the PartyKit provider           │
│     (same Y.Doc), reconnects with the new JWT                           │
│  4. PartyKit re-authorizes and stores the fresh token for saves         │
│  5. Save picks a currently connected token that is not expired          │
│                                                                         │
│  If the user signs out:                                                 │
│  ─────────────────────────────────────────────────────────────────      │
│                                                                         │
│  - Hook stops reconnect, shows "Login required"                         │
│  - PartyKit drops that connection's token from the save pool            │
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
│  1. Network drops (or laptop sleeps)                                    │
│  2. WebSocket disconnects (1001/1006). PartyKit may log                 │
│     "Network connection lost" — that connection cannot be recovered     │
│  3. Hook pauses y-partykit's built-in retry (it would reuse the stale   │
│     JWT in the last WebSocket URL)                                      │
│  4. Hook refreshes the Supabase session and calls provider.connect()    │
│     so query params are rebuilt with a live JWT                         │
│  5. Editor stays mounted (read-only) with a "Connection lost" banner.   │
│     Editing is paused until the socket is back — offline editing is     │
│     not shipped yet. Browser `offline` shows this immediately (the      │
│     WebSocket often stays half-open until TCP times out).               │
│  6. If connect returns 401, that is a stale JWT, not a sign-out.        │
│     Refresh and reconnect. Login only if getSession() has no session    │
│  7. Network returns / tab becomes visible → refresh + reconnect         │
│  8. Editor unlocks when status is connected again                       │
│                                                                         │
│  Note: True offline support (local edits + IndexedDB persistence) is    │
│        not enabled. See Future Considerations.                          │
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
const SKELETON_DELAY_MS = 500;

const isStillLoading = isNew
  ? !ydoc || !provider
  : isLoading || !isReady || !ydoc || !provider;

// Render:
// - New document: blank (at most getSession) → editor. Never a skeleton.
// - Fast existing load (< 500ms): blank → editor (no skeleton)
// - Slow existing load (> 500ms): blank → skeleton → editor
```

### Instant New Document Feel

New document creation feels instant because:

1. No API call before navigation (UUID generated client-side)
2. Local empty Y.Doc is treated as ready — the editor does not wait for PartyKit `sync`
3. No loading skeleton for `isNew`
4. Connect creates the owner row in the background; empty state when `created: true`
5. First keystrokes live in the local Y.Doc and merge into the room when the socket connects
6. Existing docs: sidebar hover prefetches `getDocumentState` so the editor can paint from cache

---

## Caveats and Limitations

### 1. No True Offline Support

**Current:** Local Y.Doc exists only in memory. If browser closes during network outage, unsaved changes are lost.

**Mitigation:** Could add IndexedDB persistence layer (y-indexeddb) for offline resilience.

### 2. Save Tokens Come From Live Connections

**Current:** Each authorized socket contributes its JWT to a room-level pool. Saves use a token that does not look expired; `onClose` removes that connection.

**Implication:** If every connected client’s token expires at once and none have refreshed yet, the next debounce save can fail until a client reconnects with a fresh JWT.

**Mitigation:** The browser hook reconnects on `TOKEN_REFRESHED` so the pool stays current during long sessions.

### 3. PartyKit Does Not Verify JWT Signatures Itself

**Current:** PartyKit forwards the JWT to `/api/partykit/connect`. Supabase Auth (`getUser`) verifies signature and expiry. A connection is not attached to the Y.Doc until that call returns 200.

**Why This Is OK:** Forged tokens fail authorize (401) and never join the room, even if another user already loaded the document.

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

A migration script is provided to convert existing documents from the old `document_changes` + `document_snapshots` schema to the new `document_state` schema.

**Location:** `scripts/migrate-to-partykit.ts`

**What it does:**
1. Scans for all documents with data in the old tables
2. For each document:
   - Loads the snapshot (if exists)
   - Loads all changes after the snapshot cutoff (the "tail")
   - Reconstructs the full Y.Doc by applying snapshot + tail
   - Encodes the full state and inserts into `document_state`
3. Provides detailed progress and error reporting

**Usage:**

```bash
# First, do a dry run to see what would be migrated
SUPABASE_SERVICE_ROLE_KEY="your-key" npx tsx scripts/migrate-to-partykit.ts --dry-run

# Run the actual migration
SUPABASE_SERVICE_ROLE_KEY="your-key" npx tsx scripts/migrate-to-partykit.ts

# Migrate a specific document
SUPABASE_SERVICE_ROLE_KEY="your-key" npx tsx scripts/migrate-to-partykit.ts --document-id=<uuid>
```

**Requirements:**
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (from Supabase Dashboard → Settings → API)

**Notes:**
- The script uses the service role key to bypass RLS and access all documents
- Already-migrated documents are skipped (safe to re-run)
- Old tables are not modified - you can run both systems side-by-side
- The script processes documents in batches of 50 for efficiency

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
| **Security** | Per-connection authorize + permission row; RLS on load/save |
| **New Doc UX** | Instant (no skeleton, create on connect) |
| **Existing Doc UX** | Delayed skeleton (250ms threshold) |
| **Multi-tab** | Fully supported via PartyKit sync |
| **Offline** | Limited (local Y.Doc only, no IndexedDB) |
| **Cost** | Free tier for small usage |

This architecture provides a solid foundation for single-user multi-device editing, with clear paths to enable multi-user collaboration when needed.
