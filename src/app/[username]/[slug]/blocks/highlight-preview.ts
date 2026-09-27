import { createHighlighter, type Highlighter } from "shiki";

import {
  highlightPublishedBlocks,
  publishedShikiLanguageIds,
} from "./highlight-published";
import type { HighlightedCode } from "./highlight-types";
import type { PublishedBlock } from "./parse";

let highlighterPromise: Promise<Highlighter> | null = null;

function getPreviewHighlighter(): Promise<Highlighter> {
  highlighterPromise ??= createHighlighter({
    themes: ["github-light", "github-dark"],
    langs: publishedShikiLanguageIds,
  });
  return highlighterPromise;
}

/** Browser highlighter for the editor preview. Same classes as the published page. */
export async function highlightPreviewCode(
  blocks: PublishedBlock[],
): Promise<Map<string, HighlightedCode>> {
  const highlighter = await getPreviewHighlighter();
  return highlightPublishedBlocks(highlighter, blocks);
}
