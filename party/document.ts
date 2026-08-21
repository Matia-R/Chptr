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

export default class DocumentParty implements Party.Server {
  ydoc: Y.Doc;
  isLoaded: boolean = false;
  pendingSave: boolean = false;
  saveTimeout: ReturnType<typeof setTimeout> | null = null;
  authorizedToken: string | null = null;

  constructor(readonly room: Party.Room) {
    this.ydoc = new Y.Doc();
  }

  get appUrl(): string {
    return (this.room.env.APP_URL as string) || "http://localhost:3000";
  }

  get partykitSecret(): string {
    return (this.room.env.PARTYKIT_SECRET as string) || "";
  }

  async onStart(): Promise<void> {
    this.ydoc.on("update", (_update: Uint8Array, origin: unknown) => {
      if (origin === "load") return;
      this.scheduleSave();
    });
  }

  async loadDocument(token: string, isNew: boolean): Promise<{ success: boolean; errorCode?: number }> {
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
        return { success: false, errorCode: response.status };
      }

      const data = (await response.json()) as { state: string | null };

      if (data.state) {
        const stateBytes = base64ToUint8Array(data.state);
        Y.applyUpdate(this.ydoc, stateBytes, "load");
        console.log(`[PartyKit] Loaded document ${documentId} with existing state`);
      } else {
        console.log(`[PartyKit] Document ${documentId} starting with empty state`);
      }

      this.isLoaded = true;
      return { success: true };
    } catch (error) {
      console.error(`[PartyKit] Failed to load document ${documentId}:`, error);
      return { success: false, errorCode: 500 };
    }
  }

  scheduleSave(): void {
    if (this.pendingSave) return;
    this.pendingSave = true;

    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => {
      this.pendingSave = false;
      this.saveTimeout = null;
      void this.saveDocument();
    }, 1000);
  }

  async saveDocument(): Promise<void> {
    if (!this.authorizedToken) {
      console.error("[PartyKit] No authorized token available for save");
      return;
    }

    const documentId = this.room.id;
    const stateUpdate = Y.encodeStateAsUpdate(this.ydoc);
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

    // Only load on first connection to this room
    if (!this.isLoaded) {
      const result = await this.loadDocument(token, isNew);
      if (!result.success) {
        const code = result.errorCode === 404 ? 4004 : 4003;
        const message = result.errorCode === 404 
          ? "Document not found" 
          : "Access denied";
        conn.close(code, message);
        return;
      }
    }

    this.authorizedToken = token;

    const options: YPartyKitOptions = {
      callback: { handler: () => {} },
    };

    return onConnect(conn, this.room, options);
  }

  async onClose(): Promise<void> {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    if (this.pendingSave) {
      await this.saveDocument();
    }
  }
}
