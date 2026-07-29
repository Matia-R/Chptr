"use client";

import * as React from "react";

import { Input } from "~/app/_components/input";
import { Label } from "~/app/_components/label";
import { PasswordInput } from "~/app/_components/password-input";
import { cn } from "~/lib/utils";

import { AvatarField } from "./avatar-field";
import type { AccountSettingsFormApi } from "./use-account-settings-form";
import type { AvatarDraft } from "./use-avatar-draft";
import type { UsernameAvailabilityStatus } from "./use-username-availability";
import { UsernameAvailabilityFeedback } from "./username-availability-feedback";

/** Desktop stacks every group; mobile shows one drilled-into screen at a time. */
export type AccountSettingsSurface = "dialog" | "drawer";

const DRAWER_INPUT_CLASS = cn(
  "h-10 w-full rounded-lg border border-sidebar-border/70 bg-background/50 px-3 text-base shadow-inner",
  "dark:border-white/[0.12] dark:bg-black/35",
  "focus-visible:ring-1 focus-visible:ring-ring",
);

function inputClassName(surface: AccountSettingsSurface) {
  return surface === "drawer" ? DRAWER_INPUT_CLASS : undefined;
}

function SettingsField({
  id,
  label,
  description,
  error,
  status,
  children,
}: {
  id: string;
  label: string;
  description?: React.ReactNode;
  error?: string;
  status?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className={cn(error && "text-destructive")}>
        {label}
      </Label>
      {children}
      {error ? (
        <p className="text-[0.8rem] font-medium text-destructive">{error}</p>
      ) : status ? (
        status
      ) : description ? (
        <p className="text-[0.8rem] text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}

export type AccountSettingsFieldsProps = {
  form: AccountSettingsFormApi;
  surface: AccountSettingsSurface;
};

export type ProfileFieldsProps = AccountSettingsFieldsProps & {
  avatar: AvatarDraft;
  defaultAvatarColor: string | null;
  isSaving?: boolean;
  usernameAvailabilityStatus?: UsernameAvailabilityStatus;
};

export function ProfileFields({
  form,
  surface,
  avatar,
  defaultAvatarColor,
  isSaving,
  usernameAvailabilityStatus = "idle",
}: ProfileFieldsProps) {
  const errors = form.formState.errors;
  const className = inputClassName(surface);

  // Watched so the fallback initials track what is being typed.
  const firstName = form.watch("first_name");
  const lastName = form.watch("last_name");

  return (
    <div className="space-y-4">
      <AvatarField
        draft={avatar}
        firstName={firstName}
        lastName={lastName}
        defaultAvatarColor={defaultAvatarColor}
        disabled={isSaving}
      />
      <div className={cn(surface === "dialog" && "grid grid-cols-2 gap-4")}>
        <SettingsField
          id="account-settings-first-name"
          label="First name"
          error={errors.first_name?.message}
        >
          <Input
            id="account-settings-first-name"
            autoComplete="given-name"
            className={className}
            {...form.register("first_name")}
          />
        </SettingsField>
        <SettingsField
          id="account-settings-last-name"
          label="Last name"
          error={errors.last_name?.message}
        >
          <Input
            id="account-settings-last-name"
            autoComplete="family-name"
            className={className}
            {...form.register("last_name")}
          />
        </SettingsField>
      </div>
      <SettingsField
        id="account-settings-username"
        label="Username"
        description="Optional. Published documents live at /username/document."
        error={errors.username?.message}
        status={
          usernameAvailabilityStatus === "idle" ? null : (
            <UsernameAvailabilityFeedback
              status={usernameAvailabilityStatus}
            />
          )
        }
      >
        <Input
          id="account-settings-username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          className={className}
          {...form.register("username")}
        />
      </SettingsField>
    </div>
  );
}

export function PasswordFields({ form, surface }: AccountSettingsFieldsProps) {
  const errors = form.formState.errors;
  const className = inputClassName(surface);

  return (
    <div className="space-y-4">
      <SettingsField
        id="account-settings-password"
        label="New password"
        description="Leave blank to keep your current password."
        error={errors.password?.message}
      >
        <PasswordInput
          id="account-settings-password"
          autoComplete="new-password"
          className={className}
          {...form.register("password")}
        />
      </SettingsField>
      <SettingsField
        id="account-settings-confirm-password"
        label="Confirm new password"
        error={errors.confirmPassword?.message}
      >
        <PasswordInput
          id="account-settings-confirm-password"
          autoComplete="new-password"
          className={className}
          {...form.register("confirmPassword")}
        />
      </SettingsField>
    </div>
  );
}
