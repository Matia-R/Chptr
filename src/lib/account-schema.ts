import { z } from "zod";

/** Shared by the account settings form and the tRPC user router. */

const USERNAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 72;

/** Empty means "no username" — the profiles row stores `null` instead. */
export const usernameSchema = z
  .string()
  .trim()
  .max(50, { message: "Username must be at most 50 characters" })
  .refine((value) => value.length === 0 || value.length >= 2, {
    message: "Username must be at least 2 characters",
  })
  .refine((value) => value.length === 0 || USERNAME_PATTERN.test(value), {
    message: "Use only letters, numbers, hyphens, and underscores",
  });

export const profileSchema = z.object({
  first_name: z
    .string()
    .trim()
    .max(100, { message: "First name must be at most 100 characters" }),
  last_name: z
    .string()
    .trim()
    .max(100, { message: "Last name must be at most 100 characters" }),
  username: usernameSchema,
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
    currentPassword: z.string().min(1, { message: "Current password is required" }),
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
export const accountSettingsSchema = profileSchema;

export type ProfileValues = z.infer<typeof profileSchema>;
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
export type AccountSettingsValues = z.infer<typeof accountSettingsSchema>;
