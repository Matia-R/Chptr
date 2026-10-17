import "server-only";

import { redirect } from "next/navigation";

import {
  isOnboardingComplete,
  onboardingStepHref,
  onboardingStepMatchesRequest,
  resumeOnboardingStep,
  suggestedAuthorNameFromAuthMetadata,
  suggestedAvatarUrlFromAuthMetadata,
  type OnboardingStep,
} from "~/lib/onboarding";
import { getCurrentUserProfile, type UserProfile } from "~/server/db";
import { createClient } from "~/utils/supabase/server";

async function loadSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return { supabase, user: null, profile: null as UserProfile | null };

  try {
    const profile = await getCurrentUserProfile({
      supabase,
      userId: user.id,
    });
    return { supabase, user, profile: profile ?? null };
  } catch {
    return { supabase, user, profile: null };
  }
}

/** Private pages. Redirects before any private data is read. */
export async function requireOnboardedUser() {
  const session = await loadSession();
  if (!session.user) redirect("/login");
  if (!isOnboardingComplete(session.profile)) redirect("/onboarding");
  return {
    supabase: session.supabase,
    user: session.user,
    profile: session.profile,
  };
}

/** Onboarding page. Completed authors go straight to the app. */
export async function requireOnboardingUser(requestedStep: string | null) {
  const session = await loadSession();
  if (!session.user) redirect("/login");
  if (isOnboardingComplete(session.profile)) redirect("/documents");

  const step: OnboardingStep = resumeOnboardingStep(
    session.profile,
    requestedStep,
  );
  if (!onboardingStepMatchesRequest(requestedStep, step)) {
    redirect(onboardingStepHref(step));
  }

  return {
    supabase: session.supabase,
    user: session.user,
    profile: session.profile,
    step,
    suggestedAuthorName: suggestedAuthorNameFromAuthMetadata(
      session.user.user_metadata,
    ),
    suggestedAvatarUrl: suggestedAvatarUrlFromAuthMetadata(
      session.user.user_metadata,
    ),
  };
}
