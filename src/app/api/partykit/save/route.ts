import { NextResponse } from "next/server";
import { createClientFromToken } from "~/utils/supabase/from-token";

function base64ToByteaHex(base64: string): string {
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
    const { documentId, snapshot } = (await request.json()) as {
      documentId: string;
      snapshot: string;
    };

    if (!documentId || !snapshot) {
      return NextResponse.json(
        { error: "Missing documentId or snapshot" },
        { status: 400 }
      );
    }

    const supabase = createClientFromToken(token);

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

    const { error: upsertError } = await supabase
      .from("document_snapshots")
      .upsert(
        {
          document_id: documentId,
          snapshot_data: base64ToByteaHex(snapshot),
          snapshot_cutoff_created_at: new Date().toISOString(),
        },
        { onConflict: "document_id" }
      );

    if (upsertError) {
      console.error("[PartyKit Save] Upsert error:", upsertError);
      return NextResponse.json(
        { error: "Failed to save snapshot" },
        { status: 500 }
      );
    }

    const { error: deleteError } = await supabase
      .from("document_changes")
      .delete()
      .eq("document_id", documentId);

    if (deleteError) {
      console.error("[PartyKit Save] Delete error (non-fatal):", deleteError);
    }

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
