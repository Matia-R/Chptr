"use server";

import { revalidatePath } from "next/cache";
import { TRPCError } from "@trpc/server";

import { profileSchema } from "~/lib/account-schema";
import { updateUserProfile } from "~/server/db";
import { createClient } from "~/utils/supabase/server";

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Not authenticated");

  const email = formData.get("email") as string;
  const parsed = profileSchema.safeParse({
    author_name: (formData.get("author_name") as string) ?? "",
    username: (formData.get("username") as string) ?? "",
  });
  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ??
        "Check your author name and username.",
    };
  }

  try {
    if (email !== user.email) {
      const { error } = await supabase.auth.updateUser({ email });
      if (error) throw error;
    }

    await updateUserProfile(
      { supabase, userId: user.id },
      {
        author_name:
          parsed.data.author_name.length > 0 ? parsed.data.author_name : null,
        username: parsed.data.username.length > 0 ? parsed.data.username : null,
      },
    );

    revalidatePath("/account");
    return { success: true };
  } catch (error) {
    if (error instanceof TRPCError) {
      return { error: error.message };
    }
    return { error: "Error updating profile" };
  }
}
