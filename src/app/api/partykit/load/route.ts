import { NextResponse } from "next/server";
import {
  authenticatePartykitUser,
  getDocumentPermission,
} from "~/server/partykit/auth";

function byteaToBase64(raw: string | null | undefined): string | null {
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

export async function POST(request: Request) {
  const auth = await authenticatePartykitUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = (await request.json()) as { documentId?: string };
    const documentId = body.documentId;

    if (!documentId) {
      return NextResponse.json(
        { error: "Missing documentId" },
        { status: 400 }
      );
    }

    const permission = await getDocumentPermission(
      auth.supabase,
      documentId,
      auth.user.id
    );
    if (!permission) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { data: stateRow, error: stateError } = await auth.supabase
      .from("document_state")
      .select("state_data")
      .eq("document_id", documentId)
      .maybeSingle();

    if (stateError) {
      console.error("[PartyKit Load] State error:", stateError);
      return NextResponse.json(
        { error: "Failed to load document state" },
        { status: 500 }
      );
    }

    const state = stateRow
      ? byteaToBase64((stateRow as { state_data: string }).state_data)
      : null;

    return NextResponse.json({ state });
  } catch (error) {
    console.error("[PartyKit Load] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
