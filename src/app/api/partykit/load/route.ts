import { NextResponse } from "next/server";
import { createClientFromToken } from "~/utils/supabase/from-token";

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
    const body = (await request.json()) as {
      documentId: string;
      isNew?: boolean;
    };
    const { documentId, isNew } = body;

    if (!documentId) {
      return NextResponse.json(
        { error: "Missing documentId" },
        { status: 400 }
      );
    }

    const supabase = createClientFromToken(token);

    // Check if document exists
    const { data: existingDoc, error: docError } = await supabase
      .from("documents")
      .select("id")
      .eq("id", documentId)
      .single();

    if (docError && docError.code !== "PGRST116") {
      console.error("[PartyKit Load] Document check error:", docError);
      return NextResponse.json(
        { error: "Failed to check document" },
        { status: 500 }
      );
    }

    // Document doesn't exist
    if (!existingDoc) {
      if (isNew) {
        // Create document with user as owner
        const { error: createError } = await supabase.rpc(
          "create_document_with_owner",
          {
            p_document_id: documentId,
            p_name: "Untitled",
          }
        );

        if (createError) {
          console.error("[PartyKit Load] Create error:", createError);
          return NextResponse.json(
            { error: "Failed to create document" },
            { status: 500 }
          );
        }

        // Return empty state for new document
        return NextResponse.json({ state: null });
      } else {
        // Not a new document request, document doesn't exist
        return NextResponse.json(
          { error: "Document not found" },
          { status: 404 }
        );
      }
    }

    // Document exists - check if user has permission by trying to read state
    // RLS will enforce permission check
    const { data: stateRow, error: stateError } = await supabase
      .from("document_state")
      .select("state_data")
      .eq("document_id", documentId)
      .single();

    if (stateError && stateError.code !== "PGRST116") {
      // If we get an error other than "not found", it might be permission denied
      // But RLS errors typically manifest differently, so let's check document_permissions
      const { data: permission, error: permError } = await supabase
        .from("document_permissions")
        .select("id")
        .eq("document_id", documentId)
        .single();

      if (permError || !permission) {
        return NextResponse.json(
          { error: "Access denied" },
          { status: 403 }
        );
      }

      console.error("[PartyKit Load] State error:", stateError);
      return NextResponse.json(
        { error: "Failed to load document state" },
        { status: 500 }
      );
    }

    // Return state (may be null if no state saved yet)
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
