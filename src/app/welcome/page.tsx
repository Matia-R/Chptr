import { redirect } from "next/navigation";
import { authorDisplayName } from "~/lib/published-author";
import { getTrpcCaller } from "~/utils/trpc-utils";
import { WelcomeClient } from "../_components/welcome-client";

export default async function WelcomePage() {
  const caller = await getTrpcCaller();

  // TODO: Find a better way to handle this
  try {
    const userProfile = await caller.user.getCurrentUserProfile();
    const displayName = authorDisplayName(userProfile);
    const firstWord = displayName?.split(/\s+/)[0] ?? "";
    const welcomeName = firstWord.length > 0 ? firstWord : "there";

    return <WelcomeClient userName={welcomeName} />;
  } catch {
    // If user is not authenticated, redirect to login
    redirect("/login");
  }
}
