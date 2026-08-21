import { NextResponse } from "next/server";
import { createClientFromToken } from "~/utils/supabase/from-token";

export async function POST(request: Request) {
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

    // Check if document already exists
    const { data: existingDoc, error: checkError } = await supabase
      .from("documents")
      .select("id")
      .eq("id", documentId)
      .single();

    if (checkError && checkError.code !== "PGRST116") {
      console.error("[Create Document] Check error:", checkError);
      return NextResponse.json(
        { error: "Failed to check document" },
        { status: 500 }
      );
    }

    // Document already exists, that's fine
    if (existingDoc) {
      return NextResponse.json({ success: true, created: false });
    }

    // Create document with owner permission using the RPC
    const { error: createError } = await supabase.rpc("create_document_with_owner", {
      p_document_id: documentId,
      p_name: "Untitled",
    });

    if (createError) {
      console.error("[Create Document] RPC error:", createError);
      return NextResponse.json(
        { error: "Failed to create document" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, created: true });
  } catch (error) {
    console.error("[Create Document] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
