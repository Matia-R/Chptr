import { z } from "zod";

/** Shared by the account settings form and the tRPC user router. */

const USERNAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72;

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

export const passwordSchema = z
  .object({
    password: z
      .string()
      .min(MIN_PASSWORD_LENGTH, {
        message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      })
      .max(MAX_PASSWORD_LENGTH, {
        message: `Password must be at most ${MAX_PASSWORD_LENGTH} characters`,
      }),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

/**
 * Every editable account field in one shape, so a single Save can cover the
 * whole surface. Blank password fields mean "leave the password unchanged".
 */
export const accountSettingsSchema = profileSchema
  .extend({
    password: z.string(),
    confirmPassword: z.string(),
  })
  .superRefine((values, ctx) => {
    if (values.password.length === 0 && values.confirmPassword.length === 0) {
      return;
    }

    if (values.password.length < MIN_PASSWORD_LENGTH) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["password"],
        message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      });
    }

    if (values.password.length > MAX_PASSWORD_LENGTH) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["password"],
        message: `Password must be at most ${MAX_PASSWORD_LENGTH} characters`,
      });
    }

    if (values.password !== values.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Passwords do not match",
      });
    }
  });

export type ProfileValues = z.infer<typeof profileSchema>;
export type PasswordValues = z.infer<typeof passwordSchema>;
export type AccountSettingsValues = z.infer<typeof accountSettingsSchema>;
