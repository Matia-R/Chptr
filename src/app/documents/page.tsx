"use client";

import { ArrowRight } from "lucide-react";
import { Button } from "~/app/_components/ui/button";
import { useRouter } from "next/navigation";
import { MotionFade } from "~/app/_components/motion-fade";
import { useCallback } from "react";
import { markDocumentAsNew } from "~/hooks/use-new-document-flag";

export default function DocumentsPage() {
  const router = useRouter();

  // Instant document creation - navigate immediately with a new UUID
  const handleCreateDocument = useCallback(() => {
    const newId = crypto.randomUUID();
    markDocumentAsNew(newId);
    router.push(`/documents/${newId}`);
  }, [router]);

  return (
    <MotionFade>
      <div className="flex h-full min-h-[50vh] flex-col items-center justify-center">
        <div className="space-y-4">
          <p className="text-muted-foreground">Start by opening a note or</p>
          <Button onClick={handleCreateDocument} variant="link">
            Create a new one
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </MotionFade>
  );
}
