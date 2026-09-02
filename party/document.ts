import type * as Party from "partykit/server";
import { onConnect, type YPartyKitOptions } from "y-partykit";
import * as Y from "yjs";

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
      atob(parts[1]!.replace(/-/g, "+").replace(/_/g, "/"))
    ) as { exp?: number };
    if (!payload.exp) return true;
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
}

type LoadResult =
  | { success: true; ydoc: Y.Doc | null }
  | { success: false; errorCode: number; errorMessage: string };

type AuthorizeResult =
  | { ok: true; userId: string; permission: string; created: boolean }
  | { ok: false; errorCode: number; errorMessage: string };

type AuthorizedClient = {
  token: string;
  userId: string;
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

export default class DocumentParty implements Party.Server {
  loadedDoc: Y.Doc | null = null;
  isLoaded = false;
  authorizedByConnection = new Map<string, AuthorizedClient>();

  constructor(readonly room: Party.Room) {}

  get appUrl(): string {
    return (this.room.env.APP_URL as string) || "http://localhost:3000";
  }

  get partykitSecret(): string {
    return (this.room.env.PARTYKIT_SECRET as string) || "";
  }

  async authorizeConnection(
    token: string,
    isNew: boolean
  ): Promise<AuthorizeResult> {
    try {
      const response = await fetch(`${this.appUrl}/api/partykit/authorize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Partykit-Secret": this.partykitSecret,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          documentId: this.room.id,
          isNew,
        }),
      });

      if (!response.ok) {
        const { errorCode, errorMessage } = closeCodeFromHttpStatus(
          response.status
        );
        console.log(
          `[PartyKit] Authorize failed for ${this.room.id}: ${response.status}`
        );
        return { ok: false, errorCode, errorMessage };
      }

      const data = (await response.json()) as {
        userId: string;
        permission: string;
        created?: boolean;
      };
      return {
        ok: true,
        userId: data.userId,
        permission: data.permission,
        created: data.created === true,
      };
    } catch (error) {
      console.error(
        `[PartyKit] Authorize request failed for ${this.room.id}:`,
        error
      );
      return {
        ok: false,
        errorCode: 4005,
        errorMessage: "Failed to authorize",
      };
    }
  }

  async fetchDocument(token: string): Promise<LoadResult> {
    const documentId = this.room.id;

    try {
      const response = await fetch(`${this.appUrl}/api/partykit/load`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Partykit-Secret": this.partykitSecret,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ documentId }),
      });

      if (!response.ok) {
        console.log(
          `[PartyKit] Load failed for ${documentId}: ${response.status}`
        );
        const { errorCode, errorMessage } = closeCodeFromHttpStatus(
          response.status
        );
        return { success: false, errorCode, errorMessage };
      }

      const data = (await response.json()) as { state: string | null };

      if (data.state) {
        const ydoc = new Y.Doc();
        const stateBytes = base64ToUint8Array(data.state);
        Y.applyUpdate(ydoc, stateBytes);
        console.log(
          `[PartyKit] Loaded document ${documentId} with existing state (${stateBytes.length} bytes)`
        );
        return { success: true, ydoc };
      }

      console.log(
        `[PartyKit] Document ${documentId} starting with empty state`
      );
      return { success: true, ydoc: null };
    } catch (error) {
      console.error(`[PartyKit] Failed to load document ${documentId}:`, error);
      return {
        success: false,
        errorCode: 4005,
        errorMessage: "Failed to load document",
      };
    }
  }

  pickSaveToken(): string | null {
    let fallback: string | null = null;
    for (const client of this.authorizedByConnection.values()) {
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

    const documentId = this.room.id;
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
        throw new Error(`Failed to save document: ${response.status}`);
      }

      console.log(`[PartyKit] Saved document ${documentId}`);
    } catch (error) {
      console.error(`[PartyKit] Failed to save document ${documentId}:`, error);
    }
  }

  async onConnect(conn: Party.Connection): Promise<void> {
    const url = new URL(conn.uri, "http://dummy");
    const token = url.searchParams.get("token");
    const isNew = url.searchParams.get("isNew") === "true";

    if (!token) {
      console.log("[PartyKit] Connection rejected: no token provided");
      conn.close(4001, "Unauthorized: no token");
      return;
    }

    const auth = await this.authorizeConnection(token, isNew);
    if (!auth.ok) {
      conn.close(auth.errorCode, auth.errorMessage);
      return;
    }

    this.authorizedByConnection.set(conn.id, {
      token,
      userId: auth.userId,
    });

    if (!this.isLoaded) {
      if (auth.created) {
        this.loadedDoc = null;
        this.isLoaded = true;
        console.log(
          `[PartyKit] New document ${this.room.id} starting empty (skip load)`
        );
      } else {
        const result = await this.fetchDocument(token);

        if (!result.success) {
          this.authorizedByConnection.delete(conn.id);
          conn.close(result.errorCode, result.errorMessage);
          return;
        }

        this.loadedDoc = result.ydoc;
        this.isLoaded = true;
      }
    }

    const loadedDoc = this.loadedDoc;

    const options: YPartyKitOptions = {
      gc: false,
      load: async () => {
        return loadedDoc;
      },
      callback: {
        handler: async (ydoc: Y.Doc) => {
          await this.saveDocument(ydoc);
        },
        debounceWait: 1000,
        debounceMaxWait: 5000,
      },
    };

    return onConnect(conn, this.room, options);
  }

  onClose(conn: Party.Connection): void {
    this.authorizedByConnection.delete(conn.id);
  }
}
