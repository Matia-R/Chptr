import type { Metadata } from "next";

import { requireOnboardingUser } from "~/server/auth/onboarding-gate";

import { OnboardingClient } from "./onboarding-client";

export const metadata: Metadata = {
  title: "Set up your profile",
};

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string | string[] }>;
}) {
  const params = await searchParams;
  const requested = Array.isArray(params.step) ? params.step[0] : params.step;
  const session = await requireOnboardingUser(requested ?? null);

  return (
    <OnboardingClient
      key={`${session.step}:${session.profile?.author_name ?? ""}:${session.profile?.username ?? ""}:${session.profile?.avatar_url ?? ""}`}
      step={session.step}
      authorName={session.profile?.author_name ?? ""}
      username={session.profile?.username ?? ""}
      suggestedAuthorName={session.suggestedAuthorName}
      suggestedAvatarUrl={session.suggestedAvatarUrl}
      avatarUrl={session.profile?.avatar_url ?? null}
      defaultAvatarColor={
        session.profile?.default_avatar_background_color ?? "blue"
      }
    />
  );
}
