import { publicProcedure, createTRPCRouter } from '../trpc'
import { getCurrentUserFirstName, getCurrentUserProfile } from '~/server/db'

export const userRouter = createTRPCRouter({
    getFirstName: publicProcedure.query(async () => {
        return await getCurrentUserFirstName();
    }),
    getUserProfile: publicProcedure.query(async () => {
        return await getCurrentUserProfile();
    })
});
