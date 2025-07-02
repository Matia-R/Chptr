import { redirect } from "next/navigation"
import { getTrpcCaller } from "~/utils/trpc-utils"
import { WelcomeClient } from "../_components/welcome-client"

export default async function WelcomePage() {
    const caller = await getTrpcCaller();

    try {
        const userProfile = await caller.user.getCurrentUserProfile();
        const { first_name } = userProfile!;

        return (
            <WelcomeClient userName={first_name} />
        )
    } catch (error) {
        // If user is not authenticated, redirect to login
        redirect('/login')
    }
} 