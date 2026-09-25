import "server-only";

import { highlightPublishedCode } from "./highlight-code";
import { parsePublishedBlocks, type PublishedBlock } from "./parse";
import { PublishedSequence } from "./published-blocks";

export async function renderPublishedBlocks(blocks: PublishedBlock[]) {
  const code = await highlightPublishedCode(blocks);
  return (
    <div className="published-document text-[1.05rem] leading-relaxed">
      <PublishedSequence blocks={blocks} code={code} />
    </div>
  );
}

export async function renderPublishedArticle(blocks: unknown) {
  return renderPublishedBlocks(parsePublishedBlocks(blocks));
}
