import "server-only";

import { highlightPublishedCode } from "./highlight-code";
import { parsePublishedBlocks, type PublishedBlock } from "./parse";
import { PublishedArticleBody } from "./published-blocks";

export async function renderPublishedBlocks(blocks: PublishedBlock[]) {
  const code = await highlightPublishedCode(blocks);
  return <PublishedArticleBody blocks={blocks} code={code} />;
}

export async function renderPublishedArticle(blocks: unknown) {
  return renderPublishedBlocks(parsePublishedBlocks(blocks));
}
