"use client";

import * as React from "react";

import { Avatar, AvatarFallback, AvatarImage } from "~/app/_components/avatar";
import { Skeleton } from "~/app/_components/skeleton";
import {
  getAvatarColorHex,
  getAvatarColorTailwindClass,
} from "~/lib/avatar-colors";
import { authorInitials } from "~/lib/published-author";
import { cn } from "~/lib/utils";

export type UserAvatarProps = {
  /** Author name, used for initials and the image alt text. */
  name: string | null;
  avatar_url: string | null;
  default_avatar_background_color: string | null;
  /** If omitted, derived from `name`. */
  initials?: string;
  /** Defaults to trimmed `name`, else `"User"`. */
  alt?: string;
  /** Passed to `Avatar` root; default matches NavUser (`h-8 w-8 rounded-full`). */
  className?: string;
};

type ImageLoadingStatus = "idle" | "loading" | "loaded" | "error";

export function UserAvatar({
  name,
  avatar_url,
  default_avatar_background_color,
  initials: initialsProp,
  alt,
  className,
}: UserAvatarProps) {
  const src = avatar_url?.trim() ?? "";
  // Remount when the image is cleared/replaced so loading status resets.
  return (
    <UserAvatarInner
      key={src || "fallback"}
      name={name}
      src={src}
      default_avatar_background_color={default_avatar_background_color}
      initials={initialsProp}
      alt={alt}
      className={className}
    />
  );
}

function UserAvatarInner({
  name,
  src,
  default_avatar_background_color,
  initials: initialsProp,
  alt,
  className,
}: Omit<UserAvatarProps, "avatar_url"> & { src: string }) {
  const [imageStatus, setImageStatus] = React.useState<ImageLoadingStatus>(
    src ? "loading" : "idle",
  );

  const initials = initialsProp ?? authorInitials(name);

  const fallbackAvatarBackgroundClass = getAvatarColorTailwindClass(
    default_avatar_background_color,
  );
  const fallbackAvatarBackgroundColor = getAvatarColorHex(
    default_avatar_background_color,
  );

  const avatarFallbackClassName = cn(
    "rounded-full text-black",
    fallbackAvatarBackgroundClass,
  );
  const avatarFallbackStyle = {
    backgroundColor: fallbackAvatarBackgroundColor,
  };

  const trimmedName = name?.trim() ?? "";
  const altText = alt ?? (trimmedName.length > 0 ? trimmedName : "User");

  const isImagePending =
    Boolean(src) && imageStatus !== "loaded" && imageStatus !== "error";
  const showFallback = !src || imageStatus === "error";

  return (
    <Avatar className={cn("h-8 w-8 rounded-full", className)}>
      {src ? (
        <AvatarImage
          src={src}
          alt={altText}
          onLoadingStatusChange={setImageStatus}
        />
      ) : null}
      {isImagePending ? (
        <Skeleton
          aria-hidden
          className="absolute inset-0 h-full w-full rounded-full"
        />
      ) : null}
      {showFallback ? (
        <AvatarFallback
          className={avatarFallbackClassName}
          style={avatarFallbackStyle}
        >
          {initials}
        </AvatarFallback>
      ) : null}
    </Avatar>
  );
}
