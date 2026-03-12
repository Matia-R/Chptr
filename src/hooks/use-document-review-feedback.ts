"use client";

import { useEffect, useState } from "react";
import { createClient } from "~/utils/supabase/client";

export type ReviewFeedbackRow = {
  id: string;
  document_id: string;
  content_hash: string;
  suggestions: string[];
  created_at: string;
  updated_at: string;
};

export function useDocumentReviewFeedback(documentId: string | null) {
  const [feedbackRows, setFeedbackRows] = useState<ReviewFeedbackRow[]>([]);
  const [isLoading, setIsLoading] = useState(!!documentId);
  const [realtimeStatus, setRealtimeStatus] = useState<
    "idle" | "subscribed" | "error"
  >("idle");

  useEffect(() => {
    if (!documentId) {
      setFeedbackRows([]);
      setIsLoading(false);
      setRealtimeStatus("idle");
      return;
    }

    const supabase = createClient();
    setIsLoading(true);
    setRealtimeStatus("idle");

    const fetchFeedback = async () => {
      const { data, error } = await supabase
        .from("document_review_feedback")
        .select("id, document_id, content_hash, suggestions, created_at, updated_at")
        .eq("document_id", documentId)
        .order("updated_at", { ascending: false });

      if (error) {
        console.error("Failed to fetch review feedback:", error);
        setFeedbackRows([]);
        setIsLoading(false);
        return;
      }
      const rows = (data ?? []) as ReviewFeedbackRow[];
      setFeedbackRows(rows);
      setIsLoading(false);
    };

    void fetchFeedback();

    const channel = supabase
      .channel(`review_feedback:${documentId}`, {
        config: { broadcast: { self: false } },
      })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "document_review_feedback",
          filter: `document_id=eq.${documentId}`,
        },
        () => {
          void fetchFeedback();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setRealtimeStatus("subscribed");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setRealtimeStatus("error");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [documentId]);

  return { feedbackRows, isLoading, realtimeStatus };
}
