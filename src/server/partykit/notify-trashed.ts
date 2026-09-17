/**
 * Ask the PartyKit room to drop live editors after a document is trashed.
 * Best-effort: trash still succeeds if the room is asleep or unreachable.
 */
export async function notifyPartykitDocumentTrashed(
  documentId: string
): Promise<void> {
  const host = process.env.NEXT_PUBLIC_PARTYKIT_HOST;
  const secret = process.env.PARTYKIT_SECRET;
  if (!host || !secret) return;

  const protocol =
    host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https";
  const url = `${protocol}://${host}/parties/main/${documentId}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Partykit-Secret": secret,
      },
      body: JSON.stringify({ type: "trash" }),
      signal: AbortSignal.timeout(2000),
    });

    if (!response.ok) {
      console.error(
        `[PartyKit] Trash notify failed for ${documentId}: ${response.status}`
      );
    }
  } catch (error) {
    console.error(
      `[PartyKit] Trash notify request failed for ${documentId}:`,
      error
    );
  }
}
