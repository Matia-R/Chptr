"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { waitlistEmailSchema, type JoinWaitlistResult } from "~/lib/waitlist";
// Imported directly: the `~/server/db` index pulls in the document stack.
import { addWaitlistSignup } from "~/server/db/waitlist";

const inputSchema = z.object({
  email: waitlistEmailSchema,
  /** Honeypot. The field is hidden, so a person leaves it empty. */
  subject: z.string().max(500).optional(),
});

/** Per address, per server instance. Enough to stop a script hammering the form. */
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60_000;
const attempts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  for (const [entryKey, value] of attempts) {
    if (value.resetAt <= now) attempts.delete(entryKey);
  }
  let entry = attempts.get(key);
  if (!entry) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
    attempts.set(key, entry);
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

async function clientAddress(): Promise<string> {
  const requestHeaders = await headers();
  const forwarded = requestHeaders
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const realIp = requestHeaders.get("x-real-ip")?.trim();
  return forwarded ? forwarded : realIp ? realIp : "anonymous";
}

export async function joinWaitlist(input: unknown): Promise<JoinWaitlistResult> {
  if (isRateLimited(await clientAddress())) {
    return { error: "Too many attempts. Try again in a few minutes." };
  }

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Enter a valid email address" };
  }

  // Looks like success to a bot; nothing is stored.
  if (parsed.data.subject?.trim()) {
    return { status: "joined" };
  }

  try {
    return { status: await addWaitlistSignup(parsed.data.email) };
  } catch (error) {
    console.error("[waitlist] Signup failed:", error);
    return { error: "Couldn't add you to the list. Try again." };
  }
}
