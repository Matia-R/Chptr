import {
  createDocumentAsOwner,
  documentExists,
  getDocumentPermission,
  type PartykitSupabase,
} from "~/server/partykit/auth";

export function byteaToBase64(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("\\x")) {
    const hex = trimmed.slice(2);
    return Buffer.from(hex, "hex").toString("base64");
  }

  if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0) {
    return Buffer.from(trimmed, "hex").toString("base64");
  }

  return trimmed;
}

export type DocumentConnectSuccess = {
  ok: true;
  permission: string;
  created: boolean;
  state: string | null;
};

export type DocumentConnectFailure = {
  ok: false;
  status: 403 | 404;
  error: string;
};

export async function loadDocumentState(
  supabase: PartykitSupabase,
  documentId: string
): Promise<string | null> {
  const { data: stateRow, error: stateError } = await supabase
    .from("document_state")
    .select("state_data")
    .eq("document_id", documentId)
    .maybeSingle();

  if (stateError) {
    console.error("[PartyKit] State load failed:", stateError);
    throw stateError;
  }

  return stateRow
    ? byteaToBase64((stateRow as { state_data: string }).state_data)
    : null;
}

/**
 * Single permission + state resolution used by /api/partykit/connect and tRPC prefetch.
 */
export async function connectDocument(options: {
  supabase: PartykitSupabase;
  userId: string;
  documentId: string;
  isNew: boolean;
}): Promise<DocumentConnectSuccess | DocumentConnectFailure> {
  const { supabase, userId, documentId, isNew } = options;

  const permission = await getDocumentPermission(supabase, documentId, userId);
  if (permission) {
    const state = await loadDocumentState(supabase, documentId);
    return { ok: true, permission, created: false, state };
  }

  const exists = await documentExists(supabase, documentId);
  if (exists) {
    return { ok: false, status: 403, error: "Access denied" };
  }

  if (!isNew) {
    return { ok: false, status: 404, error: "Document not found" };
  }

  await createDocumentAsOwner(supabase, documentId);
  const createdPermission =
    (await getDocumentPermission(supabase, documentId, userId)) ?? "owner";

  return {
    ok: true,
    permission: createdPermission,
    created: true,
    state: null,
  };
}
