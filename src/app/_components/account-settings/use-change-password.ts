"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import {
  SAVE_FEEDBACK_SETTLE_MS,
  useSaveFeedback,
} from "~/hooks/use-save-feedback";
import {
  changePasswordSchema,
  type ChangePasswordValues,
} from "~/lib/account-schema";
import { changePasswordWithSupabase } from "~/lib/change-password";

const EMPTY_VALUES: ChangePasswordValues = {
  currentPassword: "",
  password: "",
  confirmPassword: "",
  nonce: "",
};

/**
 * Dedicated password-change form. Talks to Supabase Auth from the browser only.
 */
export function useChangePassword({ onSaved }: { onSaved?: () => void } = {}) {
  const feedback = useSaveFeedback();
  const [reauthRequired, setReauthRequired] = React.useState(false);

  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: EMPTY_VALUES,
  });

  const submit = form.handleSubmit(async (values) => {
    if (reauthRequired && !values.nonce?.trim()) {
      form.setError("nonce", {
        message: "Verification code is required",
      });
      return;
    }

    feedback.start();

    const trimmedNonce = values.nonce?.trim();
    const result = await changePasswordWithSupabase({
      currentPassword: values.currentPassword,
      password: values.password,
      nonce: reauthRequired && trimmedNonce ? trimmedNonce : undefined,
    });

    if (result.status === "reauthentication_required") {
      setReauthRequired(true);
      form.setValue("nonce", "", { shouldDirty: true });
      form.clearErrors();
      form.setError("nonce", {
        message: "Enter the verification code we sent to your email",
      });
      await feedback.settle("failed");
      return;
    }

    if (result.status === "error") {
      if (result.field) {
        form.setError(result.field, { message: result.message });
      } else {
        form.setError("root", { message: result.message });
      }
      await feedback.settle("failed");
      return;
    }

    setReauthRequired(false);
    form.reset(EMPTY_VALUES);
    await feedback.settle("saved");

    if (onSaved) feedback.runAfterResult(onSaved, SAVE_FEEDBACK_SETTLE_MS);
  });

  const isSaving =
    feedback.inFlight ||
    feedback.state === "saving" ||
    form.formState.isSubmitting;
  const isBusy = isSaving || feedback.state === "saved";
  const dirty = form.formState.isDirty;

  return {
    form,
    submit,
    isSaving,
    isBusy,
    saveState: feedback.state,
    reauthRequired,
    canSave: dirty && !isBusy,
    saveDisabled: !dirty || isBusy,
  };
}

export type ChangePasswordFormApi = ReturnType<
  typeof useChangePassword
>["form"];
