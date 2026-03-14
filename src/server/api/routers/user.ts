import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { getCurrentUserProfile } from "~/server/db";

export const userRouter = createTRPCRouter({
    getCurrentUser: publicProcedure.query(async ({ ctx }) => {
        return ctx.user?.email ?? undefined;
    }),
    getCurrentUserProfile: protectedProcedure.query(async ({ ctx }) => {
        return await getCurrentUserProfile({ supabase: ctx.supabase, userId: ctx.user.id });
    }),
});
