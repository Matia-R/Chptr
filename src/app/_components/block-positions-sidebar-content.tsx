"use client";
/* eslint-disable @typescript-eslint/no-unsafe-assignment -- positions from BlockPositionsContext; review feedback from Supabase Realtime */

import { SquareArrowOutUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  useBlockPositions,
  type PositionEntry,
} from "~/app/_components/block-positions-context";
import { useDocumentReviewFeedback } from "~/hooks/use-document-review-feedback";
import { usePassiveReviewReport } from "~/hooks/use-passive-review-report";
import { Spinner } from "~/app/_components/spinner";
import { sha256Hex } from "~/lib/content-hash";
import { api } from "~/trpc/react";
import type { ReviewFeedbackRow } from "~/hooks/use-document-review-feedback";

function useDocumentIdFromPath(): string | null {
  const pathname = usePathname();
  const re = /^\/documents\/([^/]+)$/;
  const result = re.exec(pathname ?? "");
  return result?.[1] ?? null;
}

/** Map content_hash -> position entry for "Go to block". */
function useContentHashToPosition(positions: PositionEntry[]) {
  const [hashToPosition, setHashToPosition] = useState<
    Map<string, { index: number; blockId: string }>
  >(new Map());

  useEffect(() => {
    if (positions.length === 0) {
      setHashToPosition(new Map());
      return;
    }
    let cancelled = false;
    const next = new Map<string, { index: number; blockId: string }>();
    const run = async () => {
      for (const entry of positions) {
        if (cancelled) return;
        const md = entry.markdown?.trim();
        if (!md) continue;
        const hash = await sha256Hex(md);
        if (cancelled) return;
        next.set(hash, { index: entry.index, blockId: entry.blockId });
      }
      if (!cancelled) setHashToPosition(next);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [positions]);

  return hashToPosition;
}

export function BlockPositionsSidebarContent() {
  const { positions, requestCursorMove } = useBlockPositions();
  const documentId = useDocumentIdFromPath();
  const { feedbackRows, isLoading, realtimeStatus } =
    useDocumentReviewFeedback(documentId);
  const hashToPosition = useContentHashToPosition(positions);
  const [activeTab, setActiveTab] = useState<"feedback" | "criteria">(
    "feedback",
  );

  usePassiveReviewReport(documentId, positions);

  return (
    <div className="flex flex-col gap-3 px-3 pb-10 text-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex rounded-md border border-border bg-muted/40 p-0.5 text-sm">
          <button
            type="button"
            onClick={() => setActiveTab("feedback")}
            className={`rounded-sm px-2 py-1 ${
              activeTab === "feedback"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Feedback
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("criteria")}
            className={`rounded-sm px-2 py-1 ${
              activeTab === "criteria"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Goals
          </button>
        </div>
        {documentId &&
          activeTab === "feedback" &&
          realtimeStatus === "error" && (
            <span className="text-xs text-destructive">
              Error retrieving suggestions
            </span>
          )}
      </div>

      {activeTab === "feedback" ? (
        <>
          {!documentId ? (
            <p className="text-sm text-muted-foreground">
              Open a document to see review feedback.
            </p>
          ) : isLoading && feedbackRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading feedback…</p>
          ) : feedbackRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No review feedback yet. Feedback is generated automatically as you
              edit (synced in realtime).
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {feedbackRows.map((row) => (
                <FeedbackRowCard
                  key={row.id}
                  row={row}
                  position={hashToPosition.get(row.content_hash)}
                  requestCursorMove={requestCursorMove}
                />
              ))}
            </ul>
          )}
        </>
      ) : (
        <ReviewCriteriaEditor documentId={documentId} />
      )}
    </div>
  );
}

function ReviewCriteriaEditor({ documentId }: { documentId: string | null }) {
  const enabled = !!documentId;
  const { data, isLoading } = api.aiPrompt.getReviewCriteria.useQuery(
    { documentId: documentId ?? "" },
    {
      enabled,
    },
  );
  const utils = api.useUtils();
  const [value, setValue] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!isLoading && data && !dirty) {
      setValue(data.criteria ?? "");
    }
  }, [data, isLoading, dirty]);

  const save = api.aiPrompt.setReviewCriteria.useMutation({
    onSuccess: async () => {
      setDirty(false);
      await utils.aiPrompt.getReviewCriteria.invalidate();
    },
  });

  if (!documentId) {
    return (
      <p className="text-sm text-muted-foreground">
        Open a document to configure reviewing criteria.
      </p>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        Describe how you want this document to be reviewed. For example:
        &quot;Focus on clarity and conciseness&quot; or &quot;Ensure references
        and sources are present and properly formatted&quot;.
      </p>
      <textarea
        className="resize-vertical min-h-[120px] w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none ring-0 focus-visible:ring-1 focus-visible:ring-ring"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setDirty(true);
        }}
        placeholder="Example: Focus on clarity, professional tone, and ensure any claims are backed by references where appropriate."
      />
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          {save.isPending ? (
            <>
              <Spinner className="size-3" />
              <span>Saving</span>
            </>
          ) : dirty ? (
            "Unsaved changes"
          ) : (
            "Saved"
          )}
        </span>
        <button
          type="button"
          disabled={!dirty || save.isPending}
          onClick={() => {
            if (!documentId) return;
            save.mutate({ documentId, criteria: value });
          }}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function FeedbackRowCard({
  row,
  position,
  requestCursorMove,
}: {
  row: ReviewFeedbackRow;
  position: { index: number; blockId: string } | undefined;
  requestCursorMove: (blockId: string) => void;
}) {
  const [dismissed, setDismissed] = useState<Set<number>>(() => new Set());

  return (
    <div className="overflow-hidden rounded-md border border-border bg-muted/30">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5">
        <span className="text-sm font-semibold text-foreground">
          Suggestion
        </span>
        {position && (
          <button
            type="button"
            onClick={() => requestCursorMove(position.blockId)}
            className="shrink-0 text-primary hover:text-primary/80"
          >
            <span className="sr-only">Go to block</span>
            <SquareArrowOutUpRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="border-t border-border px-4 py-2.5">
        <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-muted-foreground">
          {row.suggestions.map((s, i) =>
            dismissed.has(i) ? null : (
              <li key={i} className="flex items-center justify-between gap-1">
                <span className="leading-snug">{s}</span>
                <button
                  type="button"
                  onClick={() => setDismissed((prev) => new Set(prev).add(i))}
                  className="shrink-0 text-[10px] text-muted-foreground hover:text-foreground"
                >
                  Dismiss
                </button>
              </li>
            ),
          )}
        </ul>
      </div>
    </div>
  );
}
