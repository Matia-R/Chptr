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

function decodeJwtPayload(token: string): { sub?: string; exp?: number } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = atob(parts[1]!.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(payload) as { sub?: string; exp?: number };
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return true;
  return Date.now() >= payload.exp * 1000;
}

type LoadResult = 
  | { success: true; ydoc: Y.Doc | null }
  | { success: false; errorCode: number; errorMessage: string };

export default class DocumentParty implements Party.Server {
  authorizedToken: string | null = null;
  loadedDoc: Y.Doc | null = null;
  isLoaded: boolean = false;

  constructor(readonly room: Party.Room) {}

  get appUrl(): string {
    return (this.room.env.APP_URL as string) || "http://localhost:3000";
  }

  get partykitSecret(): string {
    return (this.room.env.PARTYKIT_SECRET as string) || "";
  }

  async fetchDocument(token: string, isNew: boolean): Promise<LoadResult> {
    const documentId = this.room.id;

    try {
      const response = await fetch(`${this.appUrl}/api/partykit/load`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Partykit-Secret": this.partykitSecret,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ documentId, isNew }),
      });

      if (!response.ok) {
        console.log(`[PartyKit] Load failed for ${documentId}: ${response.status}`);
        return {
          success: false,
          errorCode: response.status === 404 ? 4004 : 4003,
          errorMessage: response.status === 404 ? "Document not found" : "Access denied",
        };
      }

      const data = (await response.json()) as { state: string | null };

      if (data.state) {
        const ydoc = new Y.Doc();
        const stateBytes = base64ToUint8Array(data.state);
        Y.applyUpdate(ydoc, stateBytes);
        console.log(`[PartyKit] Loaded document ${documentId} with existing state (${stateBytes.length} bytes)`);
        return { success: true, ydoc };
      } else {
        console.log(`[PartyKit] Document ${documentId} starting with empty state`);
        return { success: true, ydoc: null };
      }
    } catch (error) {
      console.error(`[PartyKit] Failed to load document ${documentId}:`, error);
      return { success: false, errorCode: 4003, errorMessage: "Failed to load document" };
    }
  }

  async saveDocument(ydoc: Y.Doc): Promise<void> {
    if (!this.authorizedToken) {
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
          Authorization: `Bearer ${this.authorizedToken}`,
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

    if (isTokenExpired(token)) {
      console.log("[PartyKit] Connection rejected: token expired");
      conn.close(4001, "Unauthorized: token expired");
      return;
    }

    // Store the token for saving
    this.authorizedToken = token;

    // Load document on first connection
    if (!this.isLoaded) {
      const result = await this.fetchDocument(token, isNew);
      
      if (!result.success) {
        conn.close(result.errorCode, result.errorMessage);
        return;
      }

      this.loadedDoc = result.ydoc;
      this.isLoaded = true;
    }

    const loadedDoc = this.loadedDoc;

    const options: YPartyKitOptions = {
      gc: false,
      load: async () => {
        // Return the pre-loaded document
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
}
