"use client";

import * as React from "react";

import { Input } from "~/app/_components/input";
import {
  MOBILE_DRAWER_FIELD_INPUT_CLASS,
  MobileDrawerFieldView,
  useMobileDrawerLeave,
} from "~/app/_components/mobile-drawer";
import { SaveFeedbackLabel } from "~/app/_components/save-feedback-label";
import {
  SAVE_FEEDBACK_SETTLE_MS,
  useSaveFeedback,
} from "~/hooks/use-save-feedback";
import { useToast } from "~/hooks/use-toast";
import type { AccountProfileField } from "~/hooks/use-account-settings";
import { usernameSchema } from "~/lib/account-schema";
import { api } from "~/trpc/react";

import type { AccountSettingsProfile } from "./use-account-settings-form";
import { useUsernameAvailability } from "./use-username-availability";
import { UsernameAvailabilityFeedback } from "./username-availability-feedback";

const FIELD_COPY: Record<
  AccountProfileField,
  { title: string; helperText: string; autoComplete: string }
> = {
  first_name: {
    title: "First name",
    helperText: "Shown on your profile and published documents.",
    autoComplete: "given-name",
  },
  last_name: {
    title: "Last name",
    helperText: "Shown on your profile and published documents.",
    autoComplete: "family-name",
  },
  username: {
    title: "Username",
    helperText: "Optional. Published documents live at /username/document.",
    autoComplete: "username",
  },
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "An unexpected error occurred";
}

function profileFieldValue(
  profile: AccountSettingsProfile,
  field: AccountProfileField,
) {
  return profile[field] ?? "";
}

/** Single-field profile editor for the mobile account drawer. */
export function MobileProfileFieldEdit({
  field,
  profile,
  onBack,
  onSaved,
}: {
  field: AccountProfileField;
  profile: AccountSettingsProfile;
  onBack: () => void;
  onSaved: () => void;
}) {
  const copy = FIELD_COPY[field];
  const initialValue = profileFieldValue(profile, field);
  const [draft, setDraft] = React.useState(initialValue);
  const { toast } = useToast();
  const utils = api.useUtils();
  const feedback = useSaveFeedback();
  const leave = useMobileDrawerLeave();
  const updateProfile = api.user.updateProfile.useMutation();

  const availability = useUsernameAvailability(
    field === "username" ? draft : "",
    profile.username,
  );

  React.useEffect(() => {
    setDraft(initialValue);
  }, [initialValue, field]);

  const trimmed = draft.trim();
  const dirty = trimmed !== initialValue.trim();
  const usernameParse =
    field === "username" && trimmed.length > 0
      ? usernameSchema.safeParse(trimmed)
      : null;
  const usernameInvalid = usernameParse !== null && !usernameParse.success;
  const isBusy =
    feedback.inFlight ||
    feedback.state === "saving" ||
    feedback.state === "saved";
  const saveDisabled =
    !dirty ||
    isBusy ||
    usernameInvalid ||
    (field === "username" && availability.isTaken);

  const save = async () => {
    if (
      !dirty ||
      usernameInvalid ||
      availability.isTaken ||
      feedback.inFlight ||
      feedback.state === "saving"
    ) {
      return;
    }

    feedback.start();

    try {
      await updateProfile.mutateAsync({
        first_name:
          field === "first_name" ? trimmed : (profile.first_name ?? ""),
        last_name: field === "last_name" ? trimmed : (profile.last_name ?? ""),
        username: field === "username" ? trimmed : (profile.username ?? ""),
      });
      await utils.user.getCurrentUserProfile.invalidate();
      await feedback.settle("saved");
      feedback.runAfterResult(() => {
        leave(onSaved);
      }, SAVE_FEEDBACK_SETTLE_MS);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Couldn't update profile",
        description: errorMessage(error),
      });
      await feedback.settle("failed");
    }
  };

  const schemaError = usernameInvalid
    ? usernameParse.error.issues[0]?.message
    : undefined;

  return (
    <MobileDrawerFieldView
      title={copy.title}
      helperText={
        schemaError ||
        (field === "username" && availability.status !== "idle")
          ? undefined
          : copy.helperText
      }
      doneLabel={<SaveFeedbackLabel state={feedback.state} />}
      disabled={feedback.inFlight || feedback.state === "saving"}
      doneDisabled={saveDisabled}
      doneClassName={isBusy ? "disabled:opacity-100" : undefined}
      dismissKeyboardOnDone={false}
      onBack={onBack}
      onDone={() => {
        void save();
      }}
    >
      <Input
        id={`account-settings-${field}`}
        autoComplete={copy.autoComplete}
        autoCapitalize={field === "username" ? "none" : undefined}
        spellCheck={field === "username" ? false : undefined}
        value={draft}
        disabled={feedback.inFlight || feedback.state === "saving"}
        onChange={(event) => setDraft(event.target.value)}
        className={MOBILE_DRAWER_FIELD_INPUT_CLASS}
        aria-invalid={Boolean(schemaError)}
      />
      {schemaError ? (
        <p className="text-[0.8rem] font-medium text-destructive">
          {schemaError}
        </p>
      ) : field === "username" && availability.status !== "idle" ? (
        <UsernameAvailabilityFeedback status={availability.status} />
      ) : null}
    </MobileDrawerFieldView>
  );
}
