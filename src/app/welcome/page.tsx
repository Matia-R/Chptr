import { redirect } from "next/navigation";
import { authorDisplayName } from "~/lib/published-author";
import { requireOnboardedUser } from "~/server/auth/onboarding-gate";
import { getTrpcCaller } from "~/utils/trpc-utils";
import { WelcomeClient } from "../_components/welcome-client";

export default async function WelcomePage() {
  await requireOnboardedUser();
  const caller = await getTrpcCaller();

  try {
    const userProfile = await caller.user.getCurrentUserProfile();
    const displayName = authorDisplayName(userProfile);
    const firstWord = displayName?.split(/\s+/)[0] ?? "";
    const welcomeName = firstWord.length > 0 ? firstWord : "there";

    return <WelcomeClient userName={welcomeName} />;
  } catch {
    redirect("/login");
  }
}
