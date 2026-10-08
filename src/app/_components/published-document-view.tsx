import type { ReactNode } from "react";

import { documentFontStyle, resolveDocumentFontId } from "~/lib/document-fonts";
import type { PublishedAuthorProfileRow } from "~/lib/published-author";
import { cn } from "~/lib/utils";

import { PublishedDocumentTitleSection } from "./published-document-title-section";

/**
 * The public article chrome: path, title, author, and body.
 * The published route and the editor preview both render this.
 */
export function PublishedDocumentView({
  title,
  authorProfile,
  ownerUsername,
  publishedAt,
  font,
  children,
  className,
  headerClassName,
  compact = false,
  embedded = false,
}: {
  title: string;
  authorProfile: PublishedAuthorProfileRow | null;
  ownerUsername: string;
  publishedAt: string;
  /** Stable font id from the publish snapshot. Missing values are Inter. */
  font?: string | null;
  children: ReactNode;
  className?: string;
  /** Extra classes on the path row, e.g. room for the preview close control. */
  headerClassName?: string;
  /** Phone-width preview: keep mobile title sizing on a wide screen. */
  compact?: boolean;
  /** Inside a rounded preview frame. An opaque header keeps the corner clip clean. */
  embedded?: boolean;
}) {
  const fontId = resolveDocumentFontId(font);

  return (
    <div
      className={cn("min-h-screen bg-background text-foreground", className)}
    >
      {ownerUsername ? (
        <header
          className={cn(
            "border-b border-border/60",
            embedded
              ? "bg-background"
              : "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
          )}
        >
          <div
            className={cn(
              "mx-auto flex max-w-3xl items-center px-4 py-4",
              headerClassName,
            )}
          >
            <p className="min-w-0 truncate text-left text-sm text-muted-foreground">
              <span className="text-foreground/90">{ownerUsername}</span>
              <span className="mx-1.5 text-border">/</span>
              <span>{title}</span>
            </p>
          </div>
        </header>
      ) : null}

      <div
        className="document-type"
        data-document-font={fontId}
        style={documentFontStyle(fontId)}
      >
        <PublishedDocumentTitleSection
          title={title}
          authorProfile={authorProfile}
          ownerUsername={ownerUsername}
          publishedAt={publishedAt}
          compact={compact}
        />

        <main className="mx-auto max-w-3xl px-4 pb-24">
          <article>{children}</article>
        </main>
      </div>
    </div>
  );
}
