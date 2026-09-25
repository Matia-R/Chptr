import "server-only";

import { renderToStaticMarkup } from "react-dom/server.browser";

import type { PublishedBlock } from "./parse";
import { renderPublishedBlocks } from "./render-article";

export async function publishedBlocksToHtml(
  blocks: PublishedBlock[],
): Promise<string> {
  return renderToStaticMarkup(await renderPublishedBlocks(blocks));
}
