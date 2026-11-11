import { z } from "zod";

/**
 * Trimmed and lowercased so one address cannot join twice under different
 * casing. The same schema validates the form and the server action.
 */
export const waitlistEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, { message: "Enter your email address" })
  .max(254, { message: "That email address is too long" })
  .email({ message: "Enter a valid email address" });

export type JoinWaitlistResult =
  | { status: "joined" | "already_joined" }
  | { error: string };
