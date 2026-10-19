"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "../../utils/supabase/server";
import { getRandomAvatarColor } from "../../lib/avatar-colors";

export async function signup(formData: FormData) {
  const supabase = await createClient();

  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    options: {
      data: {
        default_avatar_background_color: getRandomAvatarColor(),
      },
    },
  };

  const { data: signUpData, error } = await supabase.auth.signUp(data);

  if (error) {
    return { error: error.message || "Sign up failed" };
  }

  revalidatePath("/", "layout");

  if (signUpData.session) {
    redirect("/onboarding");
  }

  redirect("/confirm-signup");
}
