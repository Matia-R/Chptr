import { NextResponse } from "next/server";
import { createClientFromToken } from "~/utils/supabase/from-token";

function base64ToBytea(base64: string): string {
  const buf = Buffer.from(base64, "base64");
  return "\\x" + buf.toString("hex");
}

export async function POST(request: Request) {
  const partykitSecret = request.headers.get("X-Partykit-Secret");
  const expectedSecret = process.env.PARTYKIT_SECRET;

  if (!expectedSecret || partykitSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    return NextResponse.json(
      { error: "Missing authorization token" },
      { status: 401 }
    );
  }

  try {
    const { documentId, state } = (await request.json()) as {
      documentId: string;
      state: string;
    };

    if (!documentId || !state) {
      return NextResponse.json(
        { error: "Missing documentId or state" },
        { status: 400 }
      );
    }

    const supabase = createClientFromToken(token);

    // Check if user has access to the document
    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select("id")
      .eq("id", documentId)
      .single();

    if (docError || !doc) {
      return NextResponse.json(
        { error: "Access denied or document not found" },
        { status: 403 }
      );
    }

    // Upsert document state
    const { error: upsertError } = await supabase
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

    // Update document's last_updated timestamp
    const { error: updateError } = await supabase
      .from("documents")
      .update({ last_updated: new Date().toISOString() })
      .eq("id", documentId);

    if (updateError) {
      console.error("[PartyKit Save] Update timestamp error (non-fatal):", updateError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PartyKit Save] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
