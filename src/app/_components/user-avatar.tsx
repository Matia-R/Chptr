"use client";

import * as React from "react";

import { Avatar, AvatarFallback, AvatarImage } from "~/app/_components/avatar";
import { Skeleton } from "~/app/_components/skeleton";
import {
  getAvatarColorHex,
  getAvatarColorTailwindClass,
} from "~/lib/avatar-colors";
import { cn } from "~/lib/utils";

export type UserAvatarProps = {
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  default_avatar_background_color: string | null;
  /**
   * If omitted, uses first letter of first name + first letter of last name, then "?".
   * (NavUser omits this; published pages may pass a richer fallback.)
   */
  initials?: string;
  /** Defaults to trimmed `first_name` + `last_name`, else `"User"`. */
  alt?: string;
  /** Passed to `Avatar` root; default matches NavUser (`h-8 w-8 rounded-full`). */
  className?: string;
};

type ImageLoadingStatus = "idle" | "loading" | "loaded" | "error";

export function UserAvatar({
  first_name,
  last_name,
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
      first_name={first_name}
      last_name={last_name}
      src={src}
      default_avatar_background_color={default_avatar_background_color}
      initials={initialsProp}
      alt={alt}
      className={className}
    />
  );
}

function UserAvatarInner({
  first_name,
  last_name,
  src,
  default_avatar_background_color,
  initials: initialsProp,
  alt,
  className,
}: Omit<UserAvatarProps, "avatar_url"> & { src: string }) {
  const [imageStatus, setImageStatus] = React.useState<ImageLoadingStatus>(
    src ? "loading" : "idle",
  );

  const initials =
    initialsProp ??
    (`${first_name?.[0] ?? ""}${last_name?.[0] ?? ""}`.toUpperCase() || "?");

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

  const altText =
    alt ??
    (() => {
      const t = `${first_name ?? ""} ${last_name ?? ""}`.trim();
      return t.length > 0 ? t : "User";
    })();

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
