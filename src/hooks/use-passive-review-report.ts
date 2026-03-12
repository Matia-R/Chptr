"use client";

import { useEffect, useRef } from "react";
import { api } from "~/trpc/react";
import { sha256Hex } from "~/lib/content-hash";
import type { PositionEntry } from "~/app/_components/block-positions-context";

const REPORT_INTERVAL_MS = 90_000; // 90 seconds
const DEBOUNCE_MS = 5_000; // wait 5s after positions change before reporting

/**
 * When document is open and we have positions, periodically report blocks to the server
 * so passive review can run (batched, throttled). Only one run per document per cooldown.
 */
export function usePassiveReviewReport(
  documentId: string | null,
  positions: PositionEntry[]
) {
  const lastReportAtRef = useRef<number>(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const report = api.aiPrompt.reportBlocksAndMaybeReview.useMutation();

  useEffect(() => {
    if (!documentId || positions.length === 0) return;

    const runReport = async () => {
      const blocks = await Promise.all(
        positions.map(async (p) => {
          const md = p.markdown?.trim() ?? "";
          const contentHash = md ? await sha256Hex(md) : "";
          return { contentHash, markdown: md, index: p.index };
        })
      );
      const withContent = blocks.filter((b) => b.contentHash !== "");
      if (withContent.length === 0) return;
      report.mutate({ documentId, blocks: withContent });
      lastReportAtRef.current = Date.now();
    };

    const scheduleReport = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        void runReport();
      }, DEBOUNCE_MS);
    };

    const now = Date.now();
    if (now - lastReportAtRef.current >= REPORT_INTERVAL_MS) {
      void runReport();
    } else {
      scheduleReport();
    }

    const intervalId = setInterval(() => {
      void runReport();
    }, REPORT_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- report.mutate stable; positions identity used for schedule
  }, [documentId, positions]);
}
