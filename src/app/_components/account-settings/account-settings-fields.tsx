"use client";

import * as React from "react";

import { Input } from "~/app/_components/input";
import { Label } from "~/app/_components/label";
import { PasswordInput } from "~/app/_components/password-input";
import { MIN_PASSWORD_LENGTH } from "~/lib/account-schema";
import { formSpacing } from "~/lib/form-spacing";
import { cn } from "~/lib/utils";

import { AvatarField } from "./avatar-field";
import type { AccountSettingsFormApi } from "./use-account-settings-form";
import type { ChangePasswordFormApi } from "./use-change-password";
import type { AvatarDraft } from "./use-avatar-draft";
import type { UsernameAvailabilityStatus } from "./use-username-availability";
import { UsernameAvailabilityFeedback } from "./username-availability-feedback";

/** Desktop stacks every group; mobile shows one drilled-into screen at a time. */
export type AccountSettingsSurface = "dialog" | "drawer";

/** Mobile uses taller touch targets; surface styling comes from `Input`. */
function inputClassName(surface: AccountSettingsSurface) {
  return surface === "drawer" ? "h-10 rounded-lg text-base" : undefined;
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
    <div className={formSpacing.tight}>
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
    <div className={formSpacing.section}>
      <AvatarField
        draft={avatar}
        firstName={firstName}
        lastName={lastName}
        defaultAvatarColor={defaultAvatarColor}
        disabled={isSaving}
      />
      <div className={formSpacing.stack}>
        <div
          className={cn(
            surface === "dialog" && "grid grid-cols-2",
            surface === "dialog" && formSpacing.stackGap,
            surface === "drawer" && formSpacing.stack,
          )}
        >
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
    </div>
  );
}

export type ChangePasswordFieldsProps = {
  form: ChangePasswordFormApi;
  surface: AccountSettingsSurface;
  reauthRequired?: boolean;
  /** Shown after a successful update on surfaces that keep the form mounted. */
  successMessage?: string | null;
};

export function ChangePasswordFields({
  form,
  surface,
  reauthRequired = false,
  successMessage,
}: ChangePasswordFieldsProps) {
  const errors = form.formState.errors;
  const className = inputClassName(surface);
  const rootError = errors.root?.message;

  return (
    <div className={formSpacing.stack}>
      <SettingsField
        id="account-settings-current-password"
        label="Current password"
        error={errors.currentPassword?.message}
      >
        <PasswordInput
          id="account-settings-current-password"
          autoComplete="current-password"
          className={className}
          {...form.register("currentPassword")}
        />
      </SettingsField>
      <SettingsField
        id="account-settings-password"
        label="New password"
        description={`At least ${MIN_PASSWORD_LENGTH} characters.`}
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
      {reauthRequired ? (
        <SettingsField
          id="account-settings-password-nonce"
          label="Verification code"
          description="We sent a code to your email. Enter it to confirm this change."
          error={errors.nonce?.message}
        >
          <Input
            id="account-settings-password-nonce"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoCapitalize="none"
            spellCheck={false}
            className={className}
            {...form.register("nonce")}
          />
        </SettingsField>
      ) : null}
      {rootError ? (
        <p className="text-[0.8rem] font-medium text-destructive">{rootError}</p>
      ) : successMessage ? (
        <p className="text-[0.8rem] font-medium text-emerald-600 dark:text-emerald-400">
          {successMessage}
        </p>
      ) : null}
    </div>
  );
}
