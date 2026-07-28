import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure, rateLimitMiddleware } from "~/server/api/trpc";
import {
    getCurrentUserProfile,
    isUsernameAvailable,
    updateUserAvatar,
    updateUserPassword,
    updateUserProfile,
} from "~/server/db";
import { passwordSchema, profileSchema } from "~/lib/account-schema";
import { avatarPathSchema } from "~/lib/avatar-schema";

/** Credential changes are sensitive: 10 attempts per minute per user. */
const credentialRateLimit = rateLimitMiddleware(10, 60_000);

/** Username checks are cheap but spam-prone. */
const usernameCheckRateLimit = rateLimitMiddleware(30, 60_000);

/** Empty strings from the settings forms are stored as NULL. */
const nullIfEmpty = (value: string) => (value.length > 0 ? value : null);

export const userRouter = createTRPCRouter({
    getCurrentUser: publicProcedure.query(async ({ ctx }) => {
        return ctx.user?.email ?? undefined;
    }),
    getCurrentUserProfile: protectedProcedure.query(async ({ ctx }) => {
        return await getCurrentUserProfile({ supabase: ctx.supabase, userId: ctx.user.id });
    }),
    checkUsernameAvailability: protectedProcedure
        .use(usernameCheckRateLimit)
        .input(z.object({
            username: z.string().trim().min(1).max(50),
        }))
        .query(async ({ ctx, input }) => {
            const available = await isUsernameAvailable(
                { supabase: ctx.supabase, userId: ctx.user.id },
                input.username,
            );
            return { available };
        }),
    updateProfile: protectedProcedure
        .input(profileSchema)
        .mutation(async ({ ctx, input }) => {
            return await updateUserProfile(
                { supabase: ctx.supabase, userId: ctx.user.id },
                {
                    first_name: nullIfEmpty(input.first_name),
                    last_name: nullIfEmpty(input.last_name),
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
    updatePassword: protectedProcedure
        .use(credentialRateLimit)
        .input(passwordSchema)
        .mutation(async ({ ctx, input }) => {
            await updateUserPassword(
                { supabase: ctx.supabase, userId: ctx.user.id },
                input.password,
            );
            return { success: true };
        }),
});
