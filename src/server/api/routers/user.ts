import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
  rateLimitMiddleware,
} from "~/server/api/trpc";
import {
  getCurrentUserProfile,
  getHandleAvailability,
  suggestAvailableHandle,
  updateUserAvatar,
  updateUserProfile,
} from "~/server/db";
import { profileSchema } from "~/lib/account-schema";
import { avatarPathSchema } from "~/lib/avatar-schema";

/** Username checks are cheap but spam-prone. */
const usernameCheckRateLimit = rateLimitMiddleware(30, 60_000);

/** No account yet, so availability cannot match "your" handle. */
const ANONYMOUS_PROFILE_ID = "00000000-0000-0000-0000-000000000000";

const publicHandleChecks = new Map<
  string,
  { count: number; resetAt: number }
>();

function assertPublicHandleRateLimit(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = headers.get("x-real-ip")?.trim();
  const key = forwarded ? forwarded : realIp ? realIp : "anonymous";
  const now = Date.now();
  for (const [entryKey, value] of publicHandleChecks) {
    if (value.resetAt <= now) publicHandleChecks.delete(entryKey);
  }
  let entry = publicHandleChecks.get(key);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + 60_000 };
    publicHandleChecks.set(key, entry);
  }
  entry.count += 1;
  if (entry.count > 30) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Rate limit exceeded. Try again later.",
    });
  }
}

/** Empty strings from the settings forms are stored as NULL. */
const nullIfEmpty = (value: string) => (value.length > 0 ? value : null);

export const userRouter = createTRPCRouter({
  getCurrentUser: publicProcedure.query(async ({ ctx }) => {
    return ctx.user?.email ?? undefined;
  }),
  getCurrentUserProfile: protectedProcedure.query(async ({ ctx }) => {
    return await getCurrentUserProfile({
      supabase: ctx.supabase,
      userId: ctx.user.id,
    });
  }),
  checkUsernameAvailability: protectedProcedure
    .use(usernameCheckRateLimit)
    .input(
      z.object({
        username: z.string().trim().min(1).max(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const reason = await getHandleAvailability(
        { supabase: ctx.supabase, userId: ctx.user.id },
        input.username,
      );
      const available = reason === "available" || reason === "own";
      return {
        available,
        reason: available ? null : reason,
      };
    }),
  suggestHandle: protectedProcedure
    .use(usernameCheckRateLimit)
    .input(
      z.object({
        authorName: z.string().trim().min(1).max(100),
      }),
    )
    .query(async ({ ctx, input }) => {
      const handle = await suggestAvailableHandle(
        { supabase: ctx.supabase, userId: ctx.user.id },
        input.authorName,
      );
      return { handle };
    }),
  checkSignupHandle: publicProcedure
    .input(
      z.object({
        username: z.string().trim().min(1).max(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      assertPublicHandleRateLimit(ctx.headers);
      const reason = await getHandleAvailability(
        { supabase: ctx.supabase, userId: ANONYMOUS_PROFILE_ID },
        input.username,
      );
      const available = reason === "available";
      return {
        available,
        reason: available ? null : reason,
      };
    }),
  suggestSignupHandle: publicProcedure
    .input(
      z.object({
        authorName: z.string().trim().min(1).max(100),
      }),
    )
    .query(async ({ ctx, input }) => {
      assertPublicHandleRateLimit(ctx.headers);
      const handle = await suggestAvailableHandle(
        { supabase: ctx.supabase, userId: ANONYMOUS_PROFILE_ID },
        input.authorName,
      );
      return { handle };
    }),
  updateProfile: protectedProcedure
    .input(profileSchema)
    .mutation(async ({ ctx, input }) => {
      return await updateUserProfile(
        { supabase: ctx.supabase, userId: ctx.user.id },
        {
          author_name: nullIfEmpty(input.author_name),
          username: nullIfEmpty(input.username),
        },
      );
    }),
  updateAvatar: protectedProcedure
    .input(avatarPathSchema)
    .mutation(async ({ ctx, input }) => {
      return await updateUserAvatar(
        { supabase: ctx.supabase, userId: ctx.user.id },
        input.path,
      );
    }),
});
