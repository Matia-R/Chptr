import type { ReactNode } from "react";

import { AlertView } from "~/app/_components/article/alert-view";
import { cn } from "~/lib/utils";

import { Button } from "~/app/_components/button";

import type { HighlightedCode, HighlightedToken } from "./highlight-code";
import { inlineToPlainText, type PublishedBlock } from "./parse";

const TEXT_COLORS = new Set([
  "gray",
  "brown",
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
]);

const ALIGNMENT = new Set(["left", "center", "right", "justify"]);

const LIST_TYPES = new Set([
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringProp(
  props: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = props[key];
  return typeof value === "string" ? value : undefined;
}

function colorClass(kind: "fg" | "bg", value: unknown): string | undefined {
  if (
    typeof value !== "string" ||
    value === "default" ||
    !TEXT_COLORS.has(value)
  ) {
    return undefined;
  }
  return `published-${kind}-${value}`;
}

function alignmentClass(value: unknown): string | undefined {
  if (typeof value !== "string" || !ALIGNMENT.has(value) || value === "left") {
    return undefined;
  }
  if (value === "center") return "text-center";
  if (value === "right") return "text-right";
  return "text-justify";
}

function blockChrome(props: Record<string, unknown>): string {
  return cn(
    alignmentClass(props.textAlignment),
    colorClass("fg", props.textColor),
    colorClass("bg", props.backgroundColor),
  );
}

function safeUrl(value: string, allowed: Set<string>): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (
    trimmed.startsWith("/") &&
    !trimmed.startsWith("//") &&
    !trimmed.startsWith("/\\")
  ) {
    return allowed.has("path") ? trimmed : undefined;
  }
  try {
    const url = new URL(trimmed);
    if (!allowed.has(url.protocol)) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

const LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:", "path"]);
const MEDIA_PROTOCOLS = new Set(["http:", "https:", "data:"]);

function safeMediaUrl(url: string, type: string): string | undefined {
  const href = safeUrl(
    url,
    type === "file" ? new Set(["http:", "https:"]) : MEDIA_PROTOCOLS,
  );
  if (!href?.startsWith("data:")) return href;
  const allowedPrefix =
    type === "image"
      ? "data:image/"
      : type === "video"
        ? "data:video/"
        : type === "audio"
          ? "data:audio/"
          : undefined;
  if (!allowedPrefix || !href.startsWith(allowedPrefix)) return undefined;
  return href;
}

function styleClass(styles: Record<string, unknown> | undefined): string {
  if (!styles) return "";
  return cn(
    styles.bold === true && "font-semibold",
    styles.italic === true && "italic",
    styles.underline === true && "underline",
    styles.strike === true && "line-through",
    styles.code === true &&
      "rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]",
    colorClass("fg", styles.textColor),
    colorClass("bg", styles.backgroundColor),
  );
}

function InlineContent({ content }: { content: unknown }) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return null;
  return content.map((part, index) => {
    if (!isRecord(part)) return null;
    if (part.type === "link" && typeof part.href === "string") {
      const href = safeUrl(part.href, LINK_PROTOCOLS);
      const children = <InlineContent content={part.content} />;
      if (!href) return <span key={index}>{children}</span>;
      const external =
        href.startsWith("http://") || href.startsWith("https://");
      return (
        <a
          key={index}
          href={href}
          {...(external
            ? { target: "_blank", rel: "noopener noreferrer" }
            : {})}
        >
          {children}
        </a>
      );
    }
    if (part.type === "text" && typeof part.text === "string") {
      const className = styleClass(
        isRecord(part.styles) ? part.styles : undefined,
      );
      if (!className) return <span key={index}>{part.text}</span>;
      return (
        <span key={index} className={className}>
          {part.text}
        </span>
      );
    }
    return null;
  });
}

function CodeTokens({ lines }: { lines: HighlightedToken[][] }) {
  return lines.map((line, lineIndex) => (
    <span key={lineIndex} className="block">
      {line.length === 0
        ? "\n"
        : line.map((token, tokenIndex) => (
            <span
              key={tokenIndex}
              className={cn(
                token.lightClass,
                token.darkClass,
                token.italic && "italic",
                token.bold && "font-bold",
                token.underline && "underline",
              )}
            >
              {token.text}
            </span>
          ))}
    </span>
  ));
}

function PublishedList({
  type,
  items,
  code,
}: {
  type: string;
  items: PublishedBlock[];
  code: Map<string, HighlightedCode>;
}) {
  const start = items[0]?.props.start;
  const Tag = type === "numberedListItem" ? "ol" : "ul";
  return (
    <Tag className="article-list">
      {items.map((item, index) => {
        const number =
          type === "numberedListItem"
            ? `${(typeof start === "number" ? start : 1) + index}.`
            : null;
        return (
          <li key={item.id} className={cn("article-list-item", blockChrome(item.props))}>
            {type === "checkListItem" ? (
              <input
                type="checkbox"
                defaultChecked={item.props.checked === true}
                disabled
                className="mt-1.5 size-4 shrink-0 accent-foreground"
                aria-label={item.props.checked === true ? "Checked" : "Unchecked"}
              />
            ) : type === "bulletListItem" ? (
              <span className="article-marker-bullet" aria-hidden />
            ) : (
              <span className="article-marker">{number}</span>
            )}
            <div className="min-w-0 flex-1">
              <InlineContent content={item.content} />
              <NestedBlocks blocks={item.children} code={code} />
            </div>
          </li>
        );
      })}
    </Tag>
  );
}

function Caption({ caption }: { caption: string | undefined }) {
  if (!caption?.trim()) return null;
  return (
    <figcaption className="mt-2 text-center text-sm text-muted-foreground">
      {caption}
    </figcaption>
  );
}

function PublishedBlockView({
  block,
  code,
}: {
  block: PublishedBlock;
  code: Map<string, HighlightedCode>;
}) {
  const chrome = blockChrome(block.props);
  const children = (
    <NestedBlocks blocks={block.children} code={code} />
  );

  switch (block.type) {
    case "heading": {
      const level =
        typeof block.props.level === "number" ? block.props.level : 1;
      const tag = `h${Math.min(6, Math.max(1, level))}` as
        | "h1"
        | "h2"
        | "h3"
        | "h4"
        | "h5"
        | "h6";
      const HeadingTag = tag;
      const heading = (
        <HeadingTag
          className={cn(
            "article-heading empty:min-h-[1.2em]",
            chrome,
            `article-heading-${Math.min(6, Math.max(1, level))}`,
          )}
        >
          <InlineContent content={block.content} />
        </HeadingTag>
      );
      if (block.props.isToggleable === true) {
        return (
          <details className="my-2" open>
            <summary className="cursor-pointer">{heading}</summary>
            {children}
          </details>
        );
      }
      return (
        <div className="article-block">
          {heading}
          {children}
        </div>
      );
    }
    case "quote":
      return (
        <blockquote
          className={cn(
            "my-3 border-l-2 border-border pl-4 text-muted-foreground",
            chrome,
          )}
        >
          <p className="empty:min-h-[1.625em]">
            <InlineContent content={block.content} />
          </p>
          {children}
        </blockquote>
      );
    case "codeBlock": {
      const highlighted = code.get(block.id);
      const source = inlineToPlainText(block.content);
      return (
        <div className="published-code relative my-3 rounded-md">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            data-copy-code=""
            className="absolute right-1.5 top-1.5 size-7 text-[hsl(var(--code-block-foreground))] opacity-40 hover:bg-transparent hover:opacity-80"
            aria-label="Copy"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-3.5"
              aria-hidden
            >
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
            </svg>
          </Button>
          <pre className="overflow-x-auto p-4 pr-10 font-mono text-sm leading-relaxed">
            <code>{highlighted ? <CodeTokens lines={highlighted.lines} /> : source}</code>
          </pre>
        </div>
      );
    }
    case "image":
    case "video":
    case "audio":
    case "file":
      return (
        <MediaBlock block={block} chrome={chrome}>
          {children}
        </MediaBlock>
      );
    case "table":
      return (
        <div className={cn("my-3 overflow-x-auto", chrome)}>
          <TableBlock content={block.content} />
          {children}
        </div>
      );
    case "alert":
      return (
        <AlertBlock block={block} chrome={chrome}>
          {children}
        </AlertBlock>
      );
    case "toggleListItem":
      return (
        <details className={cn("my-1", chrome)}>
          <summary className="cursor-pointer">
            <InlineContent content={block.content} />
          </summary>
          {children}
        </details>
      );
    case "paragraph":
    default:
      return (
        <div className="article-block">
          <p className={cn("empty:min-h-[1.625em]", chrome)}>
            <InlineContent content={block.content} />
          </p>
          {children}
        </div>
      );
  }
}

function MediaBlock({
  block,
  chrome,
  children,
}: {
  block: PublishedBlock;
  chrome: string;
  children: ReactNode;
}) {
  const url = stringProp(block.props, "url");
  const name = stringProp(block.props, "name");
  const caption = stringProp(block.props, "caption");
  const href = url ? safeMediaUrl(url, block.type) : undefined;
  const width =
    typeof block.props.previewWidth === "number" &&
    Number.isFinite(block.props.previewWidth) &&
    block.props.previewWidth > 0
      ? block.props.previewWidth
      : undefined;

  if (!href) {
    if (block.children.length === 0) return null;
    return <div className={chrome}>{children}</div>;
  }

  if (block.type === "image") {
    return (
      <figure className={cn("my-4", chrome)}>
        {/* Width comes from the published snapshot; height is unknown, so this stays a plain img. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={href}
          alt={name?.trim() ? name : caption?.trim() ? caption : ""}
          width={width}
          loading="lazy"
          decoding="async"
          className="h-auto max-w-full rounded-md"
        />
        <Caption caption={caption} />
        {children}
      </figure>
    );
  }

  if (block.type === "video") {
    return (
      <figure className={cn("my-4", chrome)}>
        <video
          src={href}
          controls
          preload="metadata"
          className="h-auto max-w-full rounded-md"
          width={width}
        />
        <Caption caption={caption} />
        {children}
      </figure>
    );
  }

  if (block.type === "audio") {
    return (
      <figure className={cn("my-4", chrome)}>
        <audio src={href} controls preload="metadata" className="w-full" />
        <Caption caption={caption} />
        {children}
      </figure>
    );
  }

  return (
    <figure className={cn("my-4", chrome)}>
      <a href={href} target="_blank" rel="noopener noreferrer">
        {name?.trim() ? name : caption?.trim() ? caption : href}
      </a>
      <Caption caption={caption} />
      {children}
    </figure>
  );
}

function TableBlock({ content }: { content: unknown }) {
  if (!isRecord(content) || !Array.isArray(content.rows)) return null;
  const headerRows =
    typeof content.headerRows === "number" ? content.headerRows : 0;
  const headerCols =
    typeof content.headerCols === "number" ? content.headerCols : 0;
  const columnWidths = Array.isArray(content.columnWidths)
    ? content.columnWidths
    : [];

  return (
    <table className="w-full border-collapse text-left text-sm">
      {columnWidths.length > 0 ? (
        <colgroup>
          {columnWidths.map((width, index) => (
            <col
              key={index}
              {...(typeof width === "number" && width > 0 ? { width } : {})}
            />
          ))}
        </colgroup>
      ) : null}
      <tbody>
        {content.rows.map((row, rowIndex) => {
          if (!isRecord(row) || !Array.isArray(row.cells)) return null;
          return (
            <tr key={rowIndex}>
              {row.cells.map((cell, cellIndex) => {
                const cellProps = isRecord(cell) ? cell.props : undefined;
                const cellContent = Array.isArray(cell)
                  ? cell
                  : isRecord(cell)
                    ? cell.content
                    : undefined;
                const props = isRecord(cellProps) ? cellProps : {};
                const header = rowIndex < headerRows || cellIndex < headerCols;
                const CellTag = header ? "th" : "td";
                const colSpan =
                  typeof props.colspan === "number" ? props.colspan : undefined;
                const rowSpan =
                  typeof props.rowspan === "number" ? props.rowspan : undefined;
                return (
                  <CellTag
                    key={cellIndex}
                    colSpan={colSpan}
                    rowSpan={rowSpan}
                    className={cn(
                      "border border-border px-3 py-2 align-top",
                      header && "font-semibold",
                      blockChrome(props),
                    )}
                  >
                    <InlineContent content={cellContent} />
                  </CellTag>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function AlertBlock({
  block,
  chrome,
  children,
}: {
  block: PublishedBlock;
  chrome: string;
  children: ReactNode;
}) {
  const note = stringProp(block.props, "text");
  return (
    <div className={chrome}>
      <AlertView type={stringProp(block.props, "type")}>
        {note ? <p>{note}</p> : null}
        <InlineContent content={block.content} />
        {children}
      </AlertView>
    </div>
  );
}

function NestedBlocks({
  blocks,
  code,
}: {
  blocks: PublishedBlock[];
  code: Map<string, HighlightedCode>;
}) {
  if (blocks.length === 0) return null;
  return (
    <div className="article-nested">
      <PublishedSequence blocks={blocks} code={code} />
    </div>
  );
}

export function PublishedSequence({
  blocks,
  code,
}: {
  blocks: PublishedBlock[];
  code: Map<string, HighlightedCode>;
}) {
  const nodes: ReactNode[] = [];
  let index = 0;
  while (index < blocks.length) {
    const block = blocks[index]!;
    if (LIST_TYPES.has(block.type)) {
      const type = block.type;
      const items: PublishedBlock[] = [];
      while (index < blocks.length && blocks[index]!.type === type) {
        items.push(blocks[index]!);
        index += 1;
      }
      nodes.push(
        <PublishedList
          key={items[0]!.id}
          type={type}
          items={items}
          code={code}
        />,
      );
      continue;
    }
    nodes.push(<PublishedBlockView key={block.id} block={block} code={code} />);
    index += 1;
  }
  return nodes;
}
