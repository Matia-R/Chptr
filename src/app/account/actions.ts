"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "~/utils/supabase/server";

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Not authenticated");

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const username = ((formData.get("username") as string) ?? "").trim();
  const first_name = (formData.get("first_name") as string) ?? "";
  const last_name = (formData.get("last_name") as string) ?? "";

  try {
    if (email !== user.email) {
      const { error } = await supabase.auth.updateUser({ email });
      if (error) throw error;
    }

    if (password) {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
    }

    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      username: username.length > 0 ? username : null,
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      updated_at: new Date().toISOString(),
    });

    if (error) throw error;

    revalidatePath("/account");
    return { success: true };
  } catch {
    return { error: "Error updating profile" };
  }
}
