# Chptr

Chptr is a platform for creating and sharing blog posts. Documents save and sync in realtime across sessions, and can be published at anytime to a public URL.

This is a work in progress! An Early Access beta is set to go live Novemeber 2026.

## Is Chptr open source?

I'm not actively accepting contributions and don't have plans to make this an OSS repo. I would be very grateful for any interest in contributing, but I don't have the resources to maintain a community at this time. This is also a passion project, so keeping it closed will help guide the direction in these very early stages.

On a practical note, our current infrastructure, hosting and CI doesn't lend itself to having many developers working on (at least not cheaply). That said, the code is fully available here to browse, or fork if you'd like! If you're really interested in helping with the project, please reach out myself directly: [Matia Raspopovic](https://github.com/Matia-R).

Thank you for your understanding 🫶

## Goals 🎯

The goal for Chptr is to make a platform that focuses on the ergonomics of writing and sharing long-form content.

Exisiting platforms like Medium and Substack are excellent solutions for distribution but are somewhat lacking in the inspiration department. With Chptr, we want to create an experience around the editor that facilitates the creative process from ideation, research, editing to sharing the finished work.

The process of writing an article is fragmented. The mission is to create something that unifies all the aspects of the workflow in one place so you don't need to context switch. What if your whiteboard, countless tabs of sources, thesarus and LLM where all in the document with you? What if your human editor, or collaborator could work with you in the same document **in realtime**?

The hope is that we can build something that simplifies all the most archaic aspects of writing while keeping the messy parts that promote creativity.

## How it works ⚙️

- **Write.** Documents open in a [BlockNote](https://www.blocknotejs.org/) editor (slash commands, code blocks with syntax highlighting, alert blocks, and an in-editor AI prompt).
- **Keep drafts in sync.** The editor is backed by a [Yjs](https://yjs.dev/) document. Open sessions connect to a [PartyKit](https://www.partykit.io/) room, which is the only process that writes the live document back to the database.
- **Publish.** A published snapshot is a public article. Changing the author’s username or the slug leaves a redirect from the old path.
- **Organize.** The sidebar lists documents. Trashed documents can be restored; expired trash is removed on a schedule in the database.
- **Account.** Email and password sign-up, profile (name, username, avatar), and password change.

Inviting other people to a document is not a product flow yet. Permission rows exist so a connection can be allowed or refused, and the owner is created with the document.

In-editor AI calls Google Gemini through the [Vercel AI SDK](https://sdk.vercel.ai/) (`ai`, `@ai-sdk/google`). Those requests are rate-limited per user. The rest of the app runs without an AI key; prompts fail until one is set.

## Stack 🥞

| Piece                   | Role                                          |
| ----------------------- | --------------------------------------------- |
| Next.js 15 (App Router) | UI, server actions, route handlers            |
| tRPC + TanStack Query   | Typed API between the client and `src/server` |
| Supabase                | Auth, Postgres, row-level security            |
| PartyKit + Yjs          | Real-time document room                       |
| Tailwind CSS, Radix     | UI                                            |
| BlockNote               | Editor                                        |

## Repository layout 📁  

```
src/app/                  Routes and UI
  documents/              Library and the editor (`/documents/[documentId]`)
  [username]/[slug]/      Public published article
  account/, login/, …     Auth and settings
  api/trpc/               tRPC endpoint
  api/partykit/           Connect and save callbacks for the PartyKit room
  _components/            Shared UI, including the editor
src/server/               tRPC routers, database access, PartyKit auth helpers
src/hooks/                Client hooks (collab session, publish, trash, …)
src/lib/                  Shared helpers (slugs, permissions, publish hashing)
src/utils/supabase/       Browser, server, and middleware Supabase clients
party/document.ts         PartyKit room: authorize, sync Y.Doc, debounce saves
migrations/               SQL source of truth (applied to Supabase separately)
```

tRPC routers live in `src/server/api/routers/` and are mounted in `src/server/api/root.ts`: `document`, `user`, and `aiPrompt`.

### How a document moves through the system

```
Browser (BlockNote + Y.Doc)
        │  WebSocket + Supabase access token
        ▼
PartyKit room  (party/document.ts, one room per document)
        │  HTTPS + shared secret + that user's token
        ▼
Next.js  /api/partykit/connect   load or create
         /api/partykit/save      persist Y.Doc bytes
        │
        ▼
Supabase   documents, document_permissions, document_state
           document_publications (+ redirects) for the public page
```

Signing in is Supabase Auth (email and password). Middleware refreshes the session and sends anonymous visitors away from `/documents` and `/account`.

Creating a note navigates straight to a new id. The row is created when the PartyKit room connects, after the connect route checks that the caller may create it. Later connections are authorized again. Saves run as that user, so row-level security still applies. The room debounces those writes; the stored blob is the full Y.Doc, not a change log.

Publishing copies the current blocks into `document_publications`. The public page renders that snapshot (it does not open the live Y.Doc). Old username/slug pairs redirect to the current path.

App features other than live sync — list, rename, trash, restore, profile, publish — go through tRPC.

Details, close codes, and edge cases: [PARTYKIT.md](./PARTYKIT.md) and [PARTYKIT_ARCHITECTURE.md](./PARTYKIT_ARCHITECTURE.md).

### Routes

| Path                                               | Who                    | What                                     |
| -------------------------------------------------- | ---------------------- | ---------------------------------------- |
| `/`                                                | Public                 | Placeholder                              |
| `/login`, `/signup`, `/confirm-signup`, `/welcome` | Public                 | Sign-in and first-run                    |
| `/documents`                                       | Signed in              | Library; create a note                   |
| `/documents/[documentId]`                          | Signed in, with access | Editor                                   |
| `/account`                                         | Signed in              | Profile and password                     |
| `/[username]/[slug]`                               | Public                 | Published article                        |
| `/api/trpc/[trpc]`                                 | —                      | tRPC                                     |
| `/api/partykit/connect`, `/api/partykit/save`      | PartyKit server        | Load, create, and persist document state |

## Run it locally 💻

You need Node.js 18.18 or newer (this repo uses npm 10) and a Supabase project you can point the app at.

1. Install dependencies.

   ```bash
   npm install
   ```

2. Copy `[.env.example](./.env.example)` to `.env` and fill in your own values. Do not commit `.env`.

   | Variable                        | Purpose                                                                        |
   | ------------------------------- | ------------------------------------------------------------------------------ |
   | `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL                                                           |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (client and server)                                          |
   | `NEXT_PUBLIC_PARTYKIT_HOST`     | PartyKit host. Local default: `localhost:1999`                                 |
   | `PARTYKIT_SECRET`               | Shared secret. The Next.js app and the PartyKit worker must use the same value |
   | `APP_URL`                       | URL the PartyKit worker calls back to. Local: `http://localhost:3000`          |
   | `GOOGLE_GENERATIVE_AI_API_KEY`  | Google AI key for in-editor prompts. Optional for everything else              |

3. Apply the SQL in `[migrations/](./migrations/)`. `npm run dev` does not migrate the database. Follow [migrations/README.md](./migrations/README.md): most files go through Supabase `apply_migration`; two index files cannot run inside a transaction.

4. Start the app and the collaboration worker in two terminals.

   ```bash
   npm run dev
   npm run dev:partykit
   ```

   Next.js is at [http://localhost:3000](http://localhost:3000) (Turbopack). PartyKit listens on port 1999.

   Use `npm run dev:partykit`, not `npx partykit dev`. A freshly downloaded CLI cannot see this project’s dependencies.

## Serve it ☁️

The Next.js app and the PartyKit worker are deployed separately. They must share `PARTYKIT_SECRET`, and the worker’s `APP_URL` must be the public URL of the Next.js app. The client’s `NEXT_PUBLIC_PARTYKIT_HOST` must be the deployed worker host. The PartyKit project name is `chptr-collab` (`partykit.json`).

```bash
npm run build
npm run start          # or: npm run preview  (build, then start)
npm run deploy:partykit
```

Set `APP_URL` and `PARTYKIT_SECRET` on the PartyKit project after deploy (`npx partykit env add …`). Step-by-step notes are in [PARTYKIT.md](./PARTYKIT.md).

## Scripts 📄

| Script                                  | What it does                |
| --------------------------------------- | --------------------------- |
| `npm run dev`                           | Next.js dev server          |
| `npm run dev:partykit`                  | Local PartyKit worker       |
| `npm run build` / `start` / `preview`   | Production build and server |
| `npm run deploy:partykit`               | Deploy the PartyKit worker  |
| `npm run check`                         | Lint and typecheck          |
| `npm run lint` / `lint:fix`             | ESLint                      |
| `npm run typecheck`                     | `tsc --noEmit`              |
| `npm run format:check` / `format:write` | Prettier                    |

## More documentation

- [PARTYKIT.md](./PARTYKIT.md) — collaboration setup, security model, and the files involved
- [PARTYKIT_ARCHITECTURE.md](./PARTYKIT_ARCHITECTURE.md) — data flow, edge cases, and publish behavior
- [migrations/README.md](./migrations/README.md) — how schema changes are applied
