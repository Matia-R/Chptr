import { NextResponse } from "next/server";
import { authenticatePartykitUser } from "~/server/partykit/auth";
import { connectDocument } from "~/server/partykit/connect-document";

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

    const result = await connectDocument({
      supabase: auth.supabase,
      userId: auth.user.id,
      documentId,
      isNew,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json({
      userId: auth.user.id,
      permission: result.permission,
      created: result.created,
      state: result.state,
    });
  } catch (error) {
    console.error("[PartyKit Connect] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
