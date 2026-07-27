"use client";

import * as React from "react";

import { Button } from "~/app/_components/button";
import { UserAvatar } from "~/app/_components/user-avatar";
import { AVATAR_ACCEPT_ATTRIBUTE, AVATAR_MAX_SIZE_LABEL } from "~/lib/avatar-schema";

import type { AvatarDraft } from "./use-avatar-draft";

export function AvatarField({
  draft,
  firstName,
  lastName,
  defaultAvatarColor,
  disabled,
}: {
  draft: AvatarDraft;
  firstName: string;
  lastName: string;
  defaultAvatarColor: string | null;
  disabled?: boolean;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) draft.select(file);
    // Clear the value so re-picking the same file still fires a change event.
    event.target.value = "";
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4">
        <UserAvatar
          first_name={firstName}
          last_name={lastName}
          avatar_url={draft.displayUrl}
          default_avatar_background_color={defaultAvatarColor}
          className="h-16 w-16 text-lg"
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            {draft.hasImage ? "Change photo" : "Upload photo"}
          </Button>
          {draft.hasImage ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={draft.clear}
            >
              Remove
            </Button>
          ) : null}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={AVATAR_ACCEPT_ATTRIBUTE}
          className="hidden"
          aria-hidden
          tabIndex={-1}
          onChange={handleChange}
        />
      </div>

      {draft.error ? (
        <p className="text-[0.8rem] font-medium text-destructive">
          {draft.error}
        </p>
      ) : (
        <p className="text-[0.8rem] text-muted-foreground">
          PNG, JPEG, WebP, or GIF up to {AVATAR_MAX_SIZE_LABEL}.
        </p>
      )}
    </div>
  );
}
