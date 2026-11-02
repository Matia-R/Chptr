import {
  routePartykitRequest,
  type Connection,
  type ConnectionContext,
} from "partyserver";
import { YServer } from "y-partyserver";
import * as Y from "yjs";
import { canWrite } from "../src/lib/document-permission";

interface Env {
  APP_URL?: string;
  PARTYKIT_SECRET?: string;
  Main: DurableObjectNamespace<DocumentParty>;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64.trim());
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/** Best-effort expiry read. Not a security check — only used to prefer a live save token. */
function jwtLooksExpired(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return true;
    const payload = JSON.parse(
      atob(parts[1]!.replace(/-/g, "+").replace(/_/g, "/")),
    ) as { exp?: number };
    if (!payload.exp) return true;
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
}

type ConnectResult =
  | {
      ok: true;
      userId: string;
      permission: string;
      created: boolean;
      state: string | null;
    }
  | { ok: false; errorCode: number; errorMessage: string };

type AuthorizedClient = {
  token: string;
  userId: string;
  permission: string;
};

function closeCodeFromHttpStatus(status: number): {
  errorCode: number;
  errorMessage: string;
} {
  if (status === 401) {
    return { errorCode: 4001, errorMessage: "Unauthorized" };
  }
  if (status === 403) {
    return { errorCode: 4003, errorMessage: "Access denied" };
  }
  if (status === 404) {
    return { errorCode: 4004, errorMessage: "Document not found" };
  }
  if (status === 400) {
    return { errorCode: 4000, errorMessage: "Bad request" };
  }
  return { errorCode: 4005, errorMessage: "Failed to authorize" };
}

function readAuth(connection: Connection): AuthorizedClient | null {
  const state = connection.state;
  if (!state || typeof state !== "object") return null;
  const record = state as Record<string, unknown>;
  const token = typeof record.token === "string" ? record.token : null;
  const userId = typeof record.userId === "string" ? record.userId : null;
  const permission =
    typeof record.permission === "string" ? record.permission : null;
  if (!token || !userId || !permission) return null;
  return { token, userId, permission };
}

export class DocumentParty extends YServer<Env> {
  static override options = { hibernate: false };
  static override callbackOptions = {
    debounceWait: 1000,
    debounceMaxWait: 5000,
  };

  private loaded = false;
  private loadTail: Promise<void> = Promise.resolve();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // YServer builds the doc with gc on. Keep tombstones, matching the
    // documents already stored in Postgres.
    this.document.gc = false;
  }

  get appUrl(): string {
    return this.env.APP_URL || "http://localhost:3000";
  }

  get partykitSecret(): string {
    return this.env.PARTYKIT_SECRET || "";
  }

  async connectDocument(token: string, isNew: boolean): Promise<ConnectResult> {
    try {
      const response = await fetch(`${this.appUrl}/api/partykit/connect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Partykit-Secret": this.partykitSecret,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          documentId: this.name,
          isNew,
        }),
      });

      if (!response.ok) {
        const { errorCode, errorMessage } = closeCodeFromHttpStatus(
          response.status,
        );
        console.log(
          `[PartyKit] Connect failed for ${this.name}: ${response.status}`,
        );
        return { ok: false, errorCode, errorMessage };
      }

      const data = (await response.json()) as {
        userId: string;
        permission: string;
        created?: boolean;
        state?: string | null;
      };
      return {
        ok: true,
        userId: data.userId,
        permission: data.permission,
        created: data.created === true,
        state: data.state ?? null,
      };
    } catch (error) {
      console.error(
        `[PartyKit] Connect request failed for ${this.name}:`,
        error,
      );
      return {
        ok: false,
        errorCode: 4005,
        errorMessage: "Failed to authorize",
      };
    }
  }

  kickAll(reason = "Document not found"): void {
    for (const conn of this.getConnections()) {
      try {
        conn.close(4004, reason);
      } catch {
        // Connection may already be closing.
      }
    }
    // Next authorized connect merges the saved snapshot into this document.
    this.loaded = false;
  }

  /** Close only sockets that used this save token (lost write access). */
  invalidateTokenSessions(token: string): void {
    for (const conn of this.getConnections()) {
      const client = readAuth(conn);
      if (!client || client.token !== token) continue;
      try {
        conn.close(4003, "Access denied");
      } catch {
        // Connection may already be closing.
      }
    }
  }

  async onRequest(req: Request): Promise<Response> {
    const secret = req.headers.get("X-Partykit-Secret");
    if (!this.partykitSecret || secret !== this.partykitSecret) {
      return new Response("Unauthorized", { status: 401 });
    }
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    let body: { type?: string } = {};
    try {
      const parsed: unknown = await req.json();
      if (parsed && typeof parsed === "object" && "type" in parsed) {
        const type = (parsed as { type?: unknown }).type;
        body = { type: typeof type === "string" ? type : undefined };
      }
    } catch {
      return new Response("Bad request", { status: 400 });
    }

    if (body.type !== "trash") {
      return new Response("Bad request", { status: 400 });
    }

    this.kickAll();
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  pickSaveToken(): string | null {
    let fallback: string | null = null;
    for (const conn of this.getConnections()) {
      const client = readAuth(conn);
      if (!client || !canWrite(client.permission)) continue;
      fallback = client.token;
      if (!jwtLooksExpired(client.token)) {
        return client.token;
      }
    }
    return fallback;
  }

  async saveDocument(ydoc: Y.Doc): Promise<void> {
    const token = this.pickSaveToken();
    if (!token) {
      console.error("[PartyKit] No authorized token available for save");
      return;
    }

    const documentId = this.name;
    const stateUpdate = Y.encodeStateAsUpdate(ydoc);
    const stateBase64 = uint8ArrayToBase64(stateUpdate);

    try {
      const response = await fetch(`${this.appUrl}/api/partykit/save`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Partykit-Secret": this.partykitSecret,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          documentId,
          state: stateBase64,
        }),
      });

      if (!response.ok) {
        if (response.status === 404) {
          this.kickAll();
        } else if (response.status === 403) {
          this.invalidateTokenSessions(token);
        }
        throw new Error(`Failed to save document: ${response.status}`);
      }

      console.log(`[PartyKit] Saved document ${documentId}`);
    } catch (error) {
      console.error(`[PartyKit] Failed to save document ${documentId}:`, error);
    }
  }

  override async onSave(): Promise<void> {
    await this.saveDocument(this.document);
  }

  override isReadOnly(connection: Connection): boolean {
    return !canWrite(readAuth(connection)?.permission);
  }

  /**
   * Apply the snapshot from a connect response that already succeeded.
   * YServer.onLoad runs when the room wakes, before any socket or JWT, so it
   * must stay empty. Permissions are enforced by /api/partykit/connect.
   */
  private ensureLoaded(auth: {
    created: boolean;
    state: string | null;
  }): Promise<void> {
    const job = this.loadTail.then(() => {
      this.installState(auth);
    });
    this.loadTail = job.then(
      () => undefined,
      () => undefined,
    );
    return job;
  }

  private installState(auth: { created: boolean; state: string | null }): void {
    if (this.loaded) return;

    const bytes =
      !auth.created && auth.state ? base64ToUint8Array(auth.state) : null;
    if (bytes) Y.applyUpdate(this.document, bytes);

    this.loaded = true;
    if (bytes) {
      console.log(
        `[PartyKit] Loaded document ${this.name} with existing state (${bytes.length} bytes)`,
      );
    } else {
      console.log(`[PartyKit] Document ${this.name} starting with empty state`);
    }
  }

  override async onConnect(
    conn: Connection,
    ctx: ConnectionContext,
  ): Promise<void> {
    const url = new URL(ctx.request.url);
    const token = url.searchParams.get("token");
    const isNew = url.searchParams.get("isNew") === "true";

    if (!token) {
      console.log("[PartyKit] Connection rejected: no token provided");
      conn.close(4001, "Unauthorized: no token");
      return;
    }

    const auth = await this.connectDocument(token, isNew);
    if (!auth.ok) {
      conn.close(auth.errorCode, auth.errorMessage);
      return;
    }

    conn.setState((prev: Record<string, unknown> | null) => ({
      ...(prev ?? {}),
      token,
      userId: auth.userId,
      permission: auth.permission,
    }));

    await this.ensureLoaded(auth);
    await super.onConnect(conn, ctx);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (
      (await routePartykitRequest(request, env)) ??
      new Response("Not Found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;
