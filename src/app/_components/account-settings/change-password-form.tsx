"use client";

import type { FormEventHandler } from "react";

import {
  MobileDrawerFieldView,
  useMobileDrawerLeave,
} from "~/app/_components/mobile-drawer";
import { SaveFeedbackLabel } from "~/app/_components/save-feedback-label";

import { ChangePasswordFields } from "./account-settings-fields";
import {
  useChangePassword,
  type ChangePasswordFormApi,
} from "./use-change-password";

/** Desktop password fields — submit is owned by the dialog footer. */
export function ChangePasswordSection({
  form,
  formId,
  onSubmit,
  reauthRequired,
  successMessage,
}: {
  form: ChangePasswordFormApi;
  formId: string;
  onSubmit: FormEventHandler<HTMLFormElement>;
  reauthRequired: boolean;
  successMessage?: string | null;
}) {
  return (
    <form id={formId} onSubmit={onSubmit} className="space-y-4">
      <ChangePasswordFields
        form={form}
        surface="dialog"
        reauthRequired={reauthRequired}
        successMessage={successMessage}
      />
    </form>
  );
}

/** Mobile drawer password screen — isolated from the profile form. */
export function MobileChangePassword({
  onBack,
  onSaved,
}: {
  onBack: () => void;
  onSaved: () => void;
}) {
  const leave = useMobileDrawerLeave();
  const {
    form,
    submit,
    isSaving,
    isBusy,
    saveDisabled,
    saveState,
    reauthRequired,
  } = useChangePassword({
    onSaved: () => leave(onSaved),
  });

  return (
    <MobileDrawerFieldView
      title="Password"
      doneLabel={<SaveFeedbackLabel state={saveState} idleLabel="Update" />}
      disabled={isSaving}
      doneDisabled={saveDisabled}
      doneClassName={isBusy ? "disabled:opacity-100" : undefined}
      dismissKeyboardOnDone={false}
      onBack={onBack}
      onDone={() => {
        void submit();
      }}
    >
      <ChangePasswordFields
        form={form}
        surface="drawer"
        reauthRequired={reauthRequired}
      />
    </MobileDrawerFieldView>
  );
}
