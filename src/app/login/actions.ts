"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isOnboardingComplete } from "~/lib/onboarding";
import { getCurrentUserProfile } from "~/server/db";
import { createClient } from "../../utils/supabase/server";
import { getTrpcCaller } from "~/utils/trpc-utils";

export async function login(formData: FormData) {
  const supabase = await createClient();

  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const { data: signInData, error } =
    await supabase.auth.signInWithPassword(data);

  if (error) {
    switch (error.message) {
      case "Invalid login credentials":
        return { error: "Invalid email or password" };
      default:
        return { error: error.message };
    }
  }

  revalidatePath("/", "layout");

  const userId = signInData.user?.id;
  if (!userId) {
    return { redirectTo: "/onboarding" };
  }

  let onboarded = false;
  try {
    const profile = await getCurrentUserProfile({ supabase, userId });
    onboarded = isOnboardingComplete(profile);
  } catch {
    onboarded = false;
  }

  if (!onboarded) {
    return { redirectTo: "/onboarding" };
  }

  const caller = await getTrpcCaller();
  const result = await caller.document.getDocumentIdsForAuthenticatedUser();

  if (result.success && result.documents?.[0]?.id) {
    return { redirectTo: `/documents/${result.documents[0].id}` };
  } else {
    return { redirectTo: "/documents" };
  }
}

export async function signup(formData: FormData) {
  const supabase = await createClient();

  // type-casting here for convenience
  // in practice, you should validate your inputs
  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const { error } = await supabase.auth.signUp(data);

  if (error) {
    redirect("/error");
  }

  revalidatePath("/", "layout");
  redirect("/confirm-signup");
}
