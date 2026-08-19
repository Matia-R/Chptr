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

export default class DocumentParty implements Party.Server {
  ydoc: Y.Doc;
  isLoaded: boolean = false;
  pendingSave: boolean = false;
  saveTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(readonly room: Party.Room) {
    this.ydoc = new Y.Doc();
  }

  get appUrl(): string {
    return this.room.env.APP_URL as string || "http://localhost:3000";
  }

  get partykitSecret(): string {
    return this.room.env.PARTYKIT_SECRET as string || "";
  }

  async onStart(): Promise<void> {
    await this.loadDocument();

    this.ydoc.on("update", (_update: Uint8Array, origin: unknown) => {
      if (origin === "load") return;
      this.scheduleSave();
    });
  }

  async loadDocument(): Promise<void> {
    const documentId = this.room.id;

    try {
      const response = await fetch(`${this.appUrl}/api/partykit/load`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Partykit-Secret": this.partykitSecret,
        },
        body: JSON.stringify({ documentId }),
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.log(`[PartyKit] Document ${documentId} not found, starting fresh`);
          this.isLoaded = true;
          return;
        }
        throw new Error(`Failed to load document: ${response.status}`);
      }

      const data = await response.json() as {
        snapshot: string | null;
        changes: Array<{ updateData: string }>;
      };

      const updates: Uint8Array[] = [];

      if (data.snapshot) {
        updates.push(base64ToUint8Array(data.snapshot));
      }

      for (const change of data.changes || []) {
        updates.push(base64ToUint8Array(change.updateData));
      }

      if (updates.length > 0) {
        const merged = Y.mergeUpdates(updates);
        Y.applyUpdate(this.ydoc, merged, "load");
      }

      this.isLoaded = true;
      console.log(`[PartyKit] Loaded document ${documentId} with ${updates.length} updates`);
    } catch (error) {
      console.error(`[PartyKit] Failed to load document ${documentId}:`, error);
      this.isLoaded = true;
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
    const documentId = this.room.id;
    const stateUpdate = Y.encodeStateAsUpdate(this.ydoc);
    const stateBase64 = uint8ArrayToBase64(stateUpdate);

    try {
      const response = await fetch(`${this.appUrl}/api/partykit/save`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Partykit-Secret": this.partykitSecret,
        },
        body: JSON.stringify({
          documentId,
          snapshot: stateBase64,
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

  onConnect(conn: Party.Connection): void | Promise<void> {
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
