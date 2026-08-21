import { NextResponse } from "next/server";
import { createClientFromToken } from "~/utils/supabase/from-token";

interface SnapshotRow {
  snapshot_data: string | null;
  snapshot_cutoff_created_at: string | null;
}

interface ChangeRow {
  update_data: string | null;
  created_at: string;
}

function byteaResponseToBase64(raw: string | null | undefined): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "";
  if (
    trimmed.startsWith("\\x") ||
    trimmed.startsWith("0x") ||
    trimmed.startsWith("0X")
  ) {
    const hex = trimmed.replace(/^\\x|^0x|^0X/i, "").replace(/\s/g, "");
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
    const { documentId } = (await request.json()) as { documentId: string };

    if (!documentId) {
      return NextResponse.json(
        { error: "Missing documentId" },
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
      if (docError?.code === "PGRST116") {
        return NextResponse.json({ error: "Document not found" }, { status: 404 });
      }
      return NextResponse.json(
        { error: "Access denied or document not found" },
        { status: 403 }
      );
    }

    const { data: rawSnapshotRow, error: snapshotError } = await supabase
      .from("document_snapshots")
      .select("snapshot_data, snapshot_cutoff_created_at")
      .eq("document_id", documentId)
      .single();

    if (snapshotError && snapshotError.code !== "PGRST116") {
      console.error("[PartyKit Load] Snapshot error:", snapshotError);
    }

    const snapshotRow = rawSnapshotRow as SnapshotRow | null;
    const snapshot: string | null = snapshotRow?.snapshot_data
      ? byteaResponseToBase64(snapshotRow.snapshot_data)
      : null;
    const snapshotCutoffCreatedAt: string | null =
      snapshotRow?.snapshot_cutoff_created_at ?? null;

    let changesQuery = supabase
      .from("document_changes")
      .select("update_data, created_at")
      .eq("document_id", documentId)
      .order("created_at", { ascending: true });

    if (snapshotCutoffCreatedAt) {
      changesQuery = changesQuery.gt("created_at", snapshotCutoffCreatedAt);
    }

    const { data: rawChangesRows, error: changesError } = await changesQuery;

    if (changesError) {
      console.error("[PartyKit Load] Changes error:", changesError);
      return NextResponse.json(
        { error: "Failed to load changes" },
        { status: 500 }
      );
    }

    const changesRows = (rawChangesRows ?? []) as ChangeRow[];
    const changes = changesRows.map((row) => ({
      updateData: byteaResponseToBase64(row.update_data),
    }));

    return NextResponse.json({
      snapshot,
      changes,
    });
  } catch (error) {
    console.error("[PartyKit Load] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
