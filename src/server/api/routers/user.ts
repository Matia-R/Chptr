import { publicProcedure, createTRPCRouter } from '../trpc'
import { getCurrentUser as getCurrentUser, getCurrentUserProfile } from '~/server/db'

export const userRouter = createTRPCRouter({
    getCurrentUser: publicProcedure.query(async () => {
        return await getCurrentUser();
    }),
    getUserProfile: publicProcedure.query(async () => {
        return await getCurrentUserProfile();
    })
});
