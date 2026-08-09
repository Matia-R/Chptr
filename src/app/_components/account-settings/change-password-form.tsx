"use client";

import { Button } from "~/app/_components/button";
import {
  MobileDrawerFieldView,
  useMobileDrawerLeave,
} from "~/app/_components/mobile-drawer";
import { SaveFeedbackLabel } from "~/app/_components/save-feedback-label";
import { cn } from "~/lib/utils";

import { ChangePasswordFields } from "./account-settings-fields";
import { useChangePassword } from "./use-change-password";

/** Desktop Change Password section with its own submit control. */
export function ChangePasswordSection() {
  const { form, submit, isBusy, saveDisabled, saveState, reauthRequired } =
    useChangePassword();

  return (
    <form onSubmit={submit} className="space-y-4">
      <ChangePasswordFields
        form={form}
        surface="dialog"
        reauthRequired={reauthRequired}
        successMessage={saveState === "saved" ? "Password updated" : null}
      />
      <Button
        type="submit"
        size="sm"
        className={cn(
          "transition-[transform,background-color,color,opacity] duration-200 ease-out active:scale-[0.98]",
          isBusy && "disabled:opacity-100",
        )}
        disabled={saveDisabled}
      >
        <SaveFeedbackLabel
          state={saveState}
          idleLabel="Update Password"
          savingLabel="Updating…"
          savedLabel="Updated"
        />
      </Button>
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
