import { NextResponse } from "next/server";
import {
  authenticatePartykitUser,
  getDocumentPermission,
} from "~/server/partykit/auth";

function base64ToBytea(base64: string): string {
  const buf = Buffer.from(base64, "base64");
  return "\\x" + buf.toString("hex");
}

export async function POST(request: Request) {
  const auth = await authenticatePartykitUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { documentId, state } = (await request.json()) as {
      documentId?: string;
      state?: string;
    };

    if (!documentId || !state) {
      return NextResponse.json(
        { error: "Missing documentId or state" },
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

    const { error: upsertError } = await auth.supabase
      .from("document_state")
      .upsert(
        {
          document_id: documentId,
          state_data: base64ToBytea(state),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "document_id" }
      );

    if (upsertError) {
      console.error("[PartyKit Save] Upsert error:", upsertError);
      return NextResponse.json(
        { error: "Failed to save document state" },
        { status: 500 }
      );
    }

    await auth.supabase
      .from("documents")
      .update({ last_updated: new Date().toISOString() })
      .eq("id", documentId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PartyKit Save] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
