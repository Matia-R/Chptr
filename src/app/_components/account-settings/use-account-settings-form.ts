"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import {
  SAVE_FEEDBACK_SETTLE_MS,
  useSaveFeedback,
} from "~/hooks/use-save-feedback";
import { useToast } from "~/hooks/use-toast";
import {
  accountSettingsSchema,
  type AccountSettingsValues,
} from "~/lib/account-schema";
import { api } from "~/trpc/react";

import { useAvatarDraft } from "./use-avatar-draft";
import { useUsernameAvailability } from "./use-username-availability";

export type AccountSettingsProfile = {
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  avatar_url: string | null;
  default_avatar_background_color: string | null;
};

function toFormValues(
  profile: AccountSettingsProfile,
): AccountSettingsValues {
  return {
    first_name: profile.first_name ?? "",
    last_name: profile.last_name ?? "",
    username: profile.username ?? "",
    password: "",
    confirmPassword: "",
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "An unexpected error occurred";
}


/**
 * One form across every account field, so a single Save can commit the whole
 * surface. Profile, avatar, and password are separate mutations, so only the
 * groups that actually changed are sent.
 */
export function useAccountSettingsForm({
  profile,
  onSaved,
}: {
  profile: AccountSettingsProfile;
  onSaved?: () => void;
}) {
  const { toast } = useToast();
  const utils = api.useUtils();

  const form = useForm<AccountSettingsValues>({
    resolver: zodResolver(accountSettingsSchema),
    defaultValues: toFormValues(profile),
  });

  const avatar = useAvatarDraft(profile.avatar_url);
  const feedback = useSaveFeedback();
  const watchedUsername = form.watch("username");
  const usernameAvailability = useUsernameAvailability(
    watchedUsername,
    profile.username,
  );

  const updateProfile = api.user.updateProfile.useMutation();
  const updatePassword = api.user.updatePassword.useMutation();
  const updateAvatar = api.user.updateAvatar.useMutation();

  const submit = form.handleSubmit(async (values) => {
    if (usernameAvailability.isTaken) return;

    const defaults = form.formState.defaultValues;
    const profileChanged =
      values.first_name !== (defaults?.first_name ?? "") ||
      values.last_name !== (defaults?.last_name ?? "") ||
      values.username !== (defaults?.username ?? "");
    const passwordChanged = values.password.length > 0;
    const avatarChanged = avatar.isDirty;

    if (!profileChanged && !passwordChanged && !avatarChanged) return;

    feedback.start();

    // Reflects what is actually persisted, so a partial failure still resets
    // the fields that did save.
    let savedProfile = {
      first_name: values.first_name,
      last_name: values.last_name,
      username: values.username,
    };
    let avatarSaved = false;

    if (avatarChanged) {
      try {
        const result = await avatar.commit();
        if (result.changed) {
          await updateAvatar.mutateAsync({ path: result.path });
          avatarSaved = true;
        }
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Couldn't update photo",
          description: errorMessage(error),
        });
        await feedback.settle("failed");
        return;
      }
    }

    if (profileChanged) {
      try {
        const updated = await updateProfile.mutateAsync(savedProfile);
        savedProfile = {
          first_name: updated.first_name ?? "",
          last_name: updated.last_name ?? "",
          username: updated.username ?? "",
        };
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Couldn't update profile",
          description: errorMessage(error),
        });
        await feedback.settle("failed");
        return;
      }
    }

    // Awaited so the refetched profile carries the new avatar URL before the
    // draft stops overriding it, which would otherwise flash the old image.
    if (profileChanged || avatarSaved) {
      await utils.user.getCurrentUserProfile.invalidate();
    }

    if (passwordChanged) {
      try {
        await updatePassword.mutateAsync({
          password: values.password,
          confirmPassword: values.confirmPassword,
        });
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Couldn't update password",
          description: errorMessage(error),
        });
        avatar.reset();
        form.reset({
          ...savedProfile,
          password: values.password,
          confirmPassword: values.confirmPassword,
        });
        await feedback.settle("failed");
        return;
      }
    }

    avatar.reset();
    form.reset({ ...savedProfile, password: "", confirmPassword: "" });

    await feedback.settle("saved");

    // Deferred so the "Saved" state is visible before a surface that navigates
    // away on success (the mobile drawer) leaves the screen.
    if (onSaved) feedback.runAfterResult(onSaved, SAVE_FEEDBACK_SETTLE_MS);
  });

  const dirty = form.formState.isDirty || avatar.isDirty;
  const isSaving =
    feedback.inFlight ||
    feedback.state === "saving" ||
    form.formState.isSubmitting ||
    updateProfile.isPending ||
    updatePassword.isPending ||
    updateAvatar.isPending;
  // Includes the success beat so the control stays non-interactive while
  // "Saved" is on screen, without forcing disabled:opacity-50.
  const isBusy = isSaving || feedback.state === "saved";
  const isUsernameTaken = usernameAvailability.isTaken;

  return {
    form,
    avatar,
    submit,
    isSaving,
    isBusy,
    isUsernameTaken,
    usernameAvailabilityStatus: usernameAvailability.status,
    /** Drives the Save control's spinner / checkmark. */
    saveState: feedback.state,
    /** Whether a click should commit — distinct from the visual disabled state. */
    canSave: dirty && !isBusy && !isUsernameTaken,
    /**
     * Resting with nothing to save, or blocked because the username is taken.
     * Busy/success stay undimmed via the caller's disabled:opacity-100.
     */
    saveDisabled: (!dirty && !isBusy) || isUsernameTaken,
  };
}

export type AccountSettingsFormApi = ReturnType<
  typeof useAccountSettingsForm
>["form"];
