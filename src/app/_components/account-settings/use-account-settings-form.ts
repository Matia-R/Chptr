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
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "An unexpected error occurred";
}

/**
 * Profile + avatar form for account settings. Password changes use
 * `useChangePassword` and never pass through this hook or tRPC.
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
  const updateAvatar = api.user.updateAvatar.useMutation();

  const submit = form.handleSubmit(async (values) => {
    if (usernameAvailability.isTaken || usernameAvailability.isChecking) return;

    const defaults = form.formState.defaultValues;
    const profileChanged =
      values.first_name !== (defaults?.first_name ?? "") ||
      values.last_name !== (defaults?.last_name ?? "") ||
      values.username !== (defaults?.username ?? "");
    const avatarChanged = avatar.isDirty;

    if (!profileChanged && !avatarChanged) return;

    feedback.start();

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
        if (avatarSaved) {
          await utils.user.getCurrentUserProfile.invalidate();
          avatar.reset();
        }
        await feedback.settle("failed");
        return;
      }
    }

    if (profileChanged || avatarSaved) {
      await utils.user.getCurrentUserProfile.invalidate();
    }

    avatar.reset();
    form.reset(savedProfile);

    await feedback.settle("saved");

    if (onSaved) feedback.runAfterResult(onSaved, SAVE_FEEDBACK_SETTLE_MS);
  });

  const dirty = form.formState.isDirty || avatar.isDirty;
  const isSaving =
    feedback.inFlight ||
    feedback.state === "saving" ||
    form.formState.isSubmitting ||
    updateProfile.isPending ||
    updateAvatar.isPending;
  const isBusy = isSaving || feedback.state === "saved";
  const isUsernameTaken = usernameAvailability.isTaken;
  const isUsernameUnresolved =
    usernameAvailability.isChecking || isUsernameTaken;

  return {
    form,
    avatar,
    submit,
    isSaving,
    isBusy,
    isUsernameTaken,
    usernameAvailabilityStatus: usernameAvailability.status,
    saveState: feedback.state,
    canSave: dirty && !isBusy && !isUsernameUnresolved,
    saveDisabled: (!dirty && !isBusy) || isUsernameUnresolved,
  };
}

export type AccountSettingsFormApi = ReturnType<
  typeof useAccountSettingsForm
>["form"];
