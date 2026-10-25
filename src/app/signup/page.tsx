import { redirect } from "next/navigation";

import { isOnboardingComplete } from "~/lib/onboarding";
import { getCurrentUserProfile } from "~/server/db";
import { createClient } from "~/utils/supabase/server";

import { readPendingSignupCookie } from "./pending-signup-cookie";
import { SignUpClient } from "./signup-client";

export default async function SignUpPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    let onboarded = false;
    try {
      const profile = await getCurrentUserProfile({
        supabase,
        userId: user.id,
      });
      onboarded = isOnboardingComplete(profile);
    } catch {
      onboarded = false;
    }
    redirect(onboarded ? "/documents" : "/onboarding");
  }

  const pending = await readPendingSignupCookie();

  return (
    <SignUpClient
      initialEmail={pending?.email ?? ""}
      initialStage={pending?.stage === "verify" ? "verify" : "credentials"}
    />
  );
}
