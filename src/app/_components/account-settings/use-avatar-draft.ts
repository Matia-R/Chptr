"use client";

import * as React from "react";

import {
  AVATAR_BUCKET,
  buildAvatarPath,
  validateAvatarFile,
} from "~/lib/avatar-schema";
import { createClient } from "~/utils/supabase/client";

type AvatarCommit =
  | { changed: false }
  | { changed: true; path: string | null };

/**
 * Holds a pending avatar choice locally so it commits with the rest of the
 * account form's Save and is discarded by Cancel. Nothing reaches storage until
 * `commit` runs.
 */
export function useAvatarDraft(currentUrl: string | null) {
  const [file, setFile] = React.useState<File | null>(null);
  const [isCleared, setIsCleared] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const select = React.useCallback((nextFile: File) => {
    const validationError = validateAvatarFile(nextFile);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsCleared(false);
    setFile(nextFile);
  }, []);

  const clear = React.useCallback(() => {
    setError(null);
    setFile(null);
    setPreviewUrl(null);
    setIsCleared(true);
  }, []);

  const reset = React.useCallback(() => {
    setError(null);
    setFile(null);
    setIsCleared(false);
  }, []);

  /** Uploads the staged file, if any, and reports the path to persist. */
  const commit = React.useCallback(async (): Promise<AvatarCommit> => {
    if (file) {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Your session expired. Sign in again.");

      const path = buildAvatarPath(user.id, file);
      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, file, { contentType: file.type });

      if (uploadError) throw new Error(uploadError.message);

      return { changed: true, path };
    }

    if (isCleared && currentUrl) return { changed: true, path: null };

    return { changed: false };
  }, [currentUrl, file, isCleared]);

  return {
    /** Staged image if picked, else the saved one, else nothing. */
    displayUrl: previewUrl ?? (isCleared ? null : currentUrl),
    hasImage: Boolean(previewUrl ?? (isCleared ? null : currentUrl)),
    error,
    isDirty: file !== null || (isCleared && Boolean(currentUrl)),
    select,
    clear,
    reset,
    commit,
  };
}

export type AvatarDraft = ReturnType<typeof useAvatarDraft>;
