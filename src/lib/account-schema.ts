import { z } from "zod";

import { AUTHOR_NAME_MAX_LENGTH, isReservedHandle } from "~/lib/author-handle";

/** Shared by the account settings form and the tRPC user router. */

const USERNAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 72;

/**
 * Empty is only valid while a profile is still onboarding. Account settings
 * and publication require both an author name and a handle.
 */
export const usernameSchema = z
  .string()
  .trim()
  .max(50, { message: "Handle must be at most 50 characters" })
  .refine((value) => value.length === 0 || value.length >= 2, {
    message: "Handle must be at least 2 characters",
  })
  .refine((value) => value.length === 0 || USERNAME_PATTERN.test(value), {
    message: "Use only letters, numbers, hyphens, and underscores",
  })
  .refine((value) => value.length === 0 || !isReservedHandle(value), {
    message: "That handle is reserved",
  });

/** Public byline. Empty is allowed only before onboarding is complete. */
export const authorNameSchema = z.string().trim().max(AUTHOR_NAME_MAX_LENGTH, {
  message: "Author name must be at most 100 characters",
});

export const profileSchema = z.object({
  author_name: authorNameSchema,
  username: usernameSchema,
});

/** Signup used to collect both before the account existed. Onboarding uses this too. */
export const signupProfileSchema = z.object({
  author_name: z
    .string()
    .trim()
    .min(1, { message: "Author name is required" })
    .max(AUTHOR_NAME_MAX_LENGTH, {
      message: "Author name must be at most 100 characters",
    }),
  username: z
    .string()
    .trim()
    .min(2, { message: "Handle must be at least 2 characters" })
    .max(50, { message: "Handle must be at most 50 characters" })
    .regex(USERNAME_PATTERN, {
      message: "Use only letters, numbers, hyphens, and underscores",
    })
    .refine((value) => !isReservedHandle(value), {
      message: "That handle is reserved",
    }),
});

const newPasswordField = z
  .string()
  .min(MIN_PASSWORD_LENGTH, {
    message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
  })
  .max(MAX_PASSWORD_LENGTH, {
    message: `Password must be at most ${MAX_PASSWORD_LENGTH} characters`,
  });

/**
 * Signed-in password change. Passwords never leave the browser — this schema
 * is validated client-side only before calling Supabase Auth.
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, { message: "Current password is required" }),
    password: newPasswordField,
    confirmPassword: z.string(),
    /** Present only when Secure password change requires a reauth nonce. */
    nonce: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.password !== values.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Passwords do not match",
      });
    }

    if (
      values.currentPassword.length > 0 &&
      values.password === values.currentPassword
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["password"],
        message: "New password must be different from your current password",
      });
    }
  });

/** Profile fields only — password changes use `changePasswordSchema` separately. */
export const accountSettingsSchema = signupProfileSchema;

export type ProfileValues = z.infer<typeof profileSchema>;
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
export type AccountSettingsValues = z.infer<typeof accountSettingsSchema>;
