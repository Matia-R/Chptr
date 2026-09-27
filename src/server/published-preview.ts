import "server-only";

import { TRPCError } from "@trpc/server";

import { highlightPublishedCode } from "~/app/[username]/[slug]/blocks/highlight-code";
import type { HighlightedCode } from "~/app/[username]/[slug]/blocks/highlight-types";
import { parsePublishedBlocks } from "~/app/[username]/[slug]/blocks/parse";

/** Syntax colors for a preview of the current editor blocks. Same highlighter as publish. */
export async function highlightPublishedPreview(
  blocksJson: string,
): Promise<Record<string, HighlightedCode>> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(blocksJson) as unknown;
  } catch {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid blocks payload",
    });
  }

  const highlighted = await highlightPublishedCode(parsePublishedBlocks(parsed));
  return Object.fromEntries(highlighted);
}
