import { redirect } from "next/navigation"
import { getTrpcCaller } from "~/utils/trpc-utils"
import { WelcomeClient } from "../_components/welcome-client"

export default async function WelcomePage() {
    const caller = await getTrpcCaller();

    // TODO: Find a better way to handle this
    try {
        const userProfile = await caller.user.getCurrentUserProfile();
        const { first_name } = userProfile!;
        const firstNameTrim = first_name?.trim() ?? "";
        const welcomeName = firstNameTrim.length > 0 ? firstNameTrim : "there";

        return <WelcomeClient userName={welcomeName} />;
    } catch (error) {
        // If user is not authenticated, redirect to login
        redirect('/login')
    }
} 