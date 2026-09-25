import { EDITOR_ONLY_BLOCK_TYPES } from "~/app/_components/article/block-contract";

export type PublishedBlock = {
  id: string;
  type: string;
  props: Record<string, unknown>;
  content: unknown;
  children: PublishedBlock[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseBlock(value: unknown, path: string): PublishedBlock[] {
  if (!isRecord(value) || typeof value.type !== "string" || !value.type) {
    return [];
  }

  const id = typeof value.id === "string" && value.id ? value.id : path;
  const children = Array.isArray(value.children)
    ? value.children.flatMap((child, index) =>
        parseBlock(child, `${path}.${index}`),
      )
    : [];

  if (EDITOR_ONLY_BLOCK_TYPES.has(value.type)) {
    return children;
  }

  return [
    {
      id,
      type: value.type,
      props: isRecord(value.props) ? value.props : {},
      content: value.content,
      children,
    },
  ];
}

export function parsePublishedBlocks(value: unknown): PublishedBlock[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((block, index) => parseBlock(block, `b${index}`));
}

function inlineHasText(content: unknown): boolean {
  if (typeof content === "string") return content.trim().length > 0;
  if (!Array.isArray(content)) return false;
  return content.some((part) => {
    if (!isRecord(part)) return false;
    if (part.type === "text" && typeof part.text === "string") {
      return part.text.trim().length > 0;
    }
    if (part.type === "link") return inlineHasText(part.content);
    return false;
  });
}

function tableHasText(content: unknown): boolean {
  if (!isRecord(content) || !Array.isArray(content.rows)) return false;
  return content.rows.some((row) => {
    if (!isRecord(row) || !Array.isArray(row.cells)) return false;
    return row.cells.some((cell) => {
      if (Array.isArray(cell)) return inlineHasText(cell);
      if (isRecord(cell)) return inlineHasText(cell.content);
      return false;
    });
  });
}

function blockHasContent(block: PublishedBlock): boolean {
  if (block.children.some(blockHasContent)) return true;

  const url = block.props.url;
  if (
    (block.type === "image" ||
      block.type === "video" ||
      block.type === "audio" ||
      block.type === "file") &&
    typeof url === "string" &&
    url.trim().length > 0
  ) {
    return true;
  }

  if (block.type === "table") return tableHasText(block.content);
  return inlineHasText(block.content);
}

export function publishedBlocksHaveContent(blocks: PublishedBlock[]): boolean {
  return blocks.some(blockHasContent);
}

export function inlineToPlainText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (!isRecord(part)) return "";
      if (part.type === "text" && typeof part.text === "string")
        return part.text;
      if (part.type === "link") return inlineToPlainText(part.content);
      return "";
    })
    .join("");
}
