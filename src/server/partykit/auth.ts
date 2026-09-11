import { NextResponse } from "next/server";
import type { PostgrestError, User } from "@supabase/supabase-js";
import {
  type createClientFromToken,
  getUserFromAccessToken,
} from "~/utils/supabase/from-token";

export type PartykitSupabase = ReturnType<typeof createClientFromToken>;

export function requirePartykitSecret(request: Request): NextResponse | null {
  const partykitSecret = request.headers.get("X-Partykit-Secret");
  const expectedSecret = process.env.PARTYKIT_SECRET;

  if (!expectedSecret || partykitSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export function getBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  return token ?? null;
}

export async function authenticatePartykitUser(request: Request): Promise<
  | { ok: false; response: NextResponse }
  | { ok: true; token: string; user: User; supabase: PartykitSupabase }
> {
  const secretError = requirePartykitSecret(request);
  if (secretError) {
    return { ok: false, response: secretError };
  }

  const token = getBearerToken(request);
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Missing authorization token" },
        { status: 401 }
      ),
    };
  }

  const { supabase, user } = await getUserFromAccessToken(token);
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      ),
    };
  }

  return { ok: true, token, user, supabase };
}

export async function getDocumentPermission(
  supabase: PartykitSupabase,
  documentId: string,
  userId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("document_permissions")
    .select("permission")
    .eq("document_id", documentId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[PartyKit] Permission lookup failed:", error);
    throw error;
  }

  return (data?.permission as string | undefined) ?? null;
}

/**
 * Privileged existence check. RLS would hide other users' documents as
 * "not found"; this RPC only returns a boolean so we can distinguish 403 vs 404.
 */
export async function documentExists(
  supabase: PartykitSupabase,
  documentId: string
): Promise<boolean> {
  const { data, error } = (await supabase.rpc("document_exists", {
    p_document_id: documentId,
  })) as { data: unknown; error: PostgrestError | null };

  if (error) {
    console.error("[PartyKit] document_exists RPC failed:", error);
    throw error;
  }

  return data === true;
}

export async function createDocumentAsOwner(
  supabase: PartykitSupabase,
  documentId: string,
  name = "Untitled"
): Promise<void> {
  const { error } = await supabase.rpc("create_document_with_owner", {
    p_document_id: documentId,
    p_name: name,
  });

  if (error) {
    console.error("[PartyKit] create_document_with_owner failed:", error);
    throw error;
  }
}
