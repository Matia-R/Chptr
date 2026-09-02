import { NextResponse } from "next/server";
import {
  authenticatePartykitUser,
  createDocumentAsOwner,
  documentExists,
  getDocumentPermission,
} from "~/server/partykit/auth";

export async function POST(request: Request) {
  const auth = await authenticatePartykitUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = (await request.json()) as {
      documentId?: string;
      isNew?: boolean;
    };
    const documentId = body.documentId;
    const isNew = body.isNew === true;

    if (!documentId) {
      return NextResponse.json(
        { error: "Missing documentId" },
        { status: 400 }
      );
    }

    const { user, supabase } = auth;

    const permission = await getDocumentPermission(
      supabase,
      documentId,
      user.id
    );
    if (permission) {
      return NextResponse.json({
        userId: user.id,
        permission,
        created: false,
      });
    }

    const exists = await documentExists(supabase, documentId);
    if (exists) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (!isNew) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    await createDocumentAsOwner(supabase, documentId);

    const createdPermission =
      (await getDocumentPermission(supabase, documentId, user.id)) ?? "owner";

    return NextResponse.json({
      userId: user.id,
      permission: createdPermission,
      created: true,
    });
  } catch (error) {
    console.error("[PartyKit Authorize] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
