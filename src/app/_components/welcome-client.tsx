"use client";

import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { useCallback } from "react";
import { markDocumentAsNew } from "~/hooks/use-new-document-flag";

interface WelcomeClientProps {
  userName: string;
}

export function WelcomeClient({ userName }: WelcomeClientProps) {
  const router = useRouter();

  // Instant document creation - navigate immediately with a new UUID
  const handleGetStarted = useCallback(() => {
    const newId = crypto.randomUUID();
    markDocumentAsNew(newId);
    router.push(`/documents/${newId}`);
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="mb-4 text-2xl font-bold">Welcome to Chptr!</h1>
        <p className="mb-8 text-muted-foreground">
          Hi {userName} 👋 Your workspace is ready. Click the button below to
          create your first note and start writing.
        </p>
        <Button
          onClick={handleGetStarted}
          className="w-full py-2 text-sm font-medium"
        >
          Get Started
        </Button>
      </div>
    </div>
  );
}
