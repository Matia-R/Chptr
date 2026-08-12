import { z } from "zod";
import { randomUUID } from "~/lib/utils";

/**
 * Shared by the avatar picker, the upload helper, and the tRPC user router.
 * The size and type limits mirror the `avatars` bucket configuration, which
 * enforces them again server-side.
 */

export const AVATAR_BUCKET = "avatars";

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export const AVATAR_MAX_SIZE_LABEL = "2MB";

export const AVATAR_ACCEPTED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

/** `accept` attribute for the file input. */
export const AVATAR_ACCEPT_ATTRIBUTE = AVATAR_ACCEPTED_TYPES.join(",");

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

type AcceptedAvatarType = (typeof AVATAR_ACCEPTED_TYPES)[number];

function isAcceptedType(type: string): type is AcceptedAvatarType {
  return (AVATAR_ACCEPTED_TYPES as readonly string[]).includes(type);
}

/** Returns a user-facing message, or `null` when the file is acceptable. */
export function validateAvatarFile(file: File): string | null {
  if (!isAcceptedType(file.type)) {
    return "Choose a PNG, JPEG, WebP, or GIF image.";
  }

  if (file.size > AVATAR_MAX_BYTES) {
    return `Images must be smaller than ${AVATAR_MAX_SIZE_LABEL}.`;
  }

  return null;
}

/**
 * Avatars live under `<user id>/`, which is what the bucket's RLS policies key
 * on. The random segment makes each upload a new URL, so the public CDN copy of
 * a replaced avatar is never served from cache.
 */
export function buildAvatarPath(userId: string, file: File): string {
  const extension = EXTENSION_BY_TYPE[file.type] ?? "png";
  return `${userId}/${randomUUID()}.${extension}`;
}

/**
 * The client sends the storage path it just wrote rather than a URL, so the
 * server can confirm ownership and derive the public URL itself.
 */
export const avatarPathSchema = z.object({
  path: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .regex(/^[0-9a-fA-F-]{36}\/[0-9a-zA-Z-]+\.(png|jpg|webp|gif)$/, {
      message: "Invalid avatar path",
    })
    .nullable(),
});

export type AvatarPathInput = z.infer<typeof avatarPathSchema>;
