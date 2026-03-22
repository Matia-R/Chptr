"use client";

import type { BlockNoteEditor } from "@blocknote/core";

/** Editor uses custom block specs; treat as untyped for publish export. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- schema matches at runtime
type PublishEditor = BlockNoteEditor<any, any, any>;
import { Globe, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "~/app/_components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/app/_components/dialog";
import { Input } from "~/app/_components/input";
import { Label } from "~/app/_components/label";
import { useToast } from "~/hooks/use-toast";
import { useNewDocumentFlag } from "~/hooks/use-new-document-flag";
import { slugifyTitle } from "~/lib/slug";
import { api } from "~/trpc/react";

interface DocumentPublishBarProps {
  documentId: string;
  editor: PublishEditor;
}

export function DocumentPublishBar({
  documentId,
  editor,
}: DocumentPublishBarProps) {
  const { isNew } = useNewDocumentFlag();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [slugOverride, setSlugOverride] = useState("");

  const { data: docMeta } = api.document.getDocumentById.useQuery(documentId, {
    enabled: !!documentId && !isNew,
  });

  const { data: publication, isLoading: publicationLoading } =
    api.document.getPublicationByDocumentId.useQuery(documentId, {
      enabled: !!documentId && !isNew,
    });

  const { data: ownerPathData } =
    api.document.getPublicationOwnerPathSegment.useQuery(documentId, {
      enabled: !!documentId && !isNew && !publication,
    });

  const utils = api.useUtils();

  const publishMutation = api.document.publishDocument.useMutation({
    onSuccess: (result) => {
      void utils.document.getPublicationByDocumentId.invalidate(documentId);
      toast({
        title: "Published",
        description: (
          <span>
            Live at{" "}
            <Link
              href={result.publicPath}
              className="font-medium underline underline-offset-2"
            >
              {result.publicPath}
            </Link>
          </span>
        ),
      });
      setOpen(false);
    },
    onError: (err) => {
      toast({
        variant: "destructive",
        title: "Publish failed",
        description: err.message,
      });
    },
  });

  const unpublishMutation = api.document.unpublishDocument.useMutation({
    onSuccess: () => {
      void utils.document.getPublicationByDocumentId.invalidate(documentId);
      toast({ title: "Removed public page" });
      setOpen(false);
    },
    onError: (err) => {
      toast({
        variant: "destructive",
        title: "Unpublish failed",
        description: err.message,
      });
    },
  });

  if (isNew || !documentId) return null;

  const nameTrim = docMeta?.document?.name?.trim();
  const title =
    nameTrim && nameTrim.length > 0 ? nameTrim : "Untitled";
  const baseSlug = slugOverride.trim()
    ? slugifyTitle(slugOverride)
    : slugifyTitle(title);

  const ownerPreview =
    publication?.owner_username ?? ownerPathData?.ownerSegment ?? null;
  const previewPath = ownerPreview
    ? `/${ownerPreview}/${publication && !slugOverride.trim() ? publication.slug : baseSlug}`
    : `(owner needs username or name in Account)/${baseSlug}`;

  const handlePublish = async () => {
    try {
      const bodyHtml = await editor.blocksToFullHTML(editor.document);
      const blocksJson = JSON.stringify(editor.document);
      publishMutation.mutate({
        documentId,
        title,
        bodyHtml,
        blocksJson,
        slug: slugOverride.trim() || undefined,
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not export document",
        description: e instanceof Error ? e.message : "Unknown error",
      });
    }
  };

  const busy = publishMutation.isPending || unpublishMutation.isPending;

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => {
            setSlugOverride("");
            setOpen(true);
          }}
        >
          <Globe className="h-3.5 w-3.5" />
          {publication ? "Sharing" : "Publish"}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Publish to the web</DialogTitle>
            <DialogDescription>
              Creates a read-only page with a public URL. You can update it any
              time by publishing again.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="publish-slug">Title in URL (optional)</Label>
              <Input
                id="publish-slug"
                placeholder={slugifyTitle(title)}
                value={slugOverride}
                onChange={(e) => setSlugOverride(e.target.value)}
                disabled={busy}
              />
              <p className="text-xs text-muted-foreground">
                Preview{" "}
                <span className="text-muted-foreground/80">
                  ([username] or [firstname][lastname]) / [title]
                </span>
                :{" "}
                <span className="font-mono text-foreground/80">{previewPath}</span>
              </p>
            </div>

            {publication && (
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Currently live: </span>
                <Link
                  href={`/${publication.owner_username}/${publication.slug}`}
                  className="font-medium text-foreground underline underline-offset-2"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  /{publication.owner_username}/{publication.slug}
                </Link>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {publication && (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={busy || publicationLoading}
                onClick={() => unpublishMutation.mutate(documentId)}
              >
                {unpublishMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Unpublish"
                )}
              </Button>
            )}
            <Button type="button" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={busy} onClick={handlePublish}>
              {publishMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : publication ? (
                "Update publish"
              ) : (
                "Publish"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
