import { NextResponse } from "next/server";
import { createClientFromToken } from "~/utils/supabase/from-token";

function byteaToBase64(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  
  // Handle PostgreSQL bytea hex format (\x...)
  if (trimmed.startsWith("\\x")) {
    const hex = trimmed.slice(2);
    return Buffer.from(hex, "hex").toString("base64");
  }
  
  // Handle raw hex
  if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0) {
    return Buffer.from(trimmed, "hex").toString("base64");
  }
  
  // Assume already base64
  return trimmed;
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
    const { documentId } = (await request.json()) as { documentId: string };

    if (!documentId) {
      return NextResponse.json(
        { error: "Missing documentId" },
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
      if (docError?.code === "PGRST116") {
        return NextResponse.json({ error: "Document not found" }, { status: 404 });
      }
      return NextResponse.json(
        { error: "Access denied or document not found" },
        { status: 403 }
      );
    }

    // Load document state
    const { data: stateRow, error: stateError } = await supabase
      .from("document_state")
      .select("state_data")
      .eq("document_id", documentId)
      .single();

    if (stateError && stateError.code !== "PGRST116") {
      console.error("[PartyKit Load] State error:", stateError);
      return NextResponse.json(
        { error: "Failed to load document state" },
        { status: 500 }
      );
    }

    // Convert bytea to base64
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
