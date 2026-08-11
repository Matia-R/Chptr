"use client";

import * as React from "react";
import { AtSign, ChevronRight, Lock, User } from "lucide-react";

import { Button } from "~/app/_components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/app/_components/dialog";
import {
  MobileActionButtonRow,
  MobileActionGroup,
} from "~/app/_components/mobile-action-rows";
import {
  MobileDrawerNavHeader,
  MobileDrawerScreenHeader,
  MobileDrawerViewStack,
  MobileMenuDrawer,
  useMobileDrawerStage,
} from "~/app/_components/mobile-drawer";
import { PanelHeader } from "~/app/_components/panel-header";
import { SaveFeedbackLabel } from "~/app/_components/save-feedback-label";
import { Skeleton } from "~/app/_components/skeleton";
import {
  useAccountSettingsStore,
  type AccountProfileField,
  type AccountSettingsView,
} from "~/hooks/use-account-settings";
import { useIsMobile } from "~/hooks/use-mobile";
import { useUserProfile } from "~/hooks/use-user-profile";
import { formSpacing } from "~/lib/form-spacing";
import { cn } from "~/lib/utils";

import { ProfileFields } from "./account-settings-fields";
import { AvatarField } from "./avatar-field";
import {
  ChangePasswordSection,
  MobileChangePassword,
} from "./change-password-form";
import { MobileProfileFieldEdit } from "./mobile-profile-field-edit";
import {
  useAccountSettingsForm,
  type AccountSettingsProfile,
} from "./use-account-settings-form";
import { useChangePassword } from "./use-change-password";

/** Field editors and password open the keyboard; the profile list does not. */
const KEYBOARD_VIEWS: readonly AccountSettingsView[] = [
  "first_name",
  "last_name",
  "username",
  "password",
];

const PROFILE_FIELDS: readonly AccountProfileField[] = [
  "first_name",
  "last_name",
  "username",
];

function isProfileField(
  view: AccountSettingsView,
): view is AccountProfileField {
  return (PROFILE_FIELDS as readonly string[]).includes(view);
}

type DialogSectionId = "profile" | "password";

const DIALOG_SECTIONS: readonly {
  id: DialogSectionId;
  label: string;
  icon: typeof User;
}[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "password", label: "Password", icon: Lock },
];

const PROFILE_FORM_ID = "account-settings-profile-form";
const PASSWORD_FORM_ID = "account-settings-password-form";

/** Fixed shell — header/nav/footer stay put; only the content pane scrolls. */
const DIALOG_SHELL_CLASS =
  "flex h-[min(81vh,30.6rem)] w-full max-w-2xl flex-col gap-0 overflow-hidden border-0 bg-white p-0 shadow-2xl dark:bg-sidebar";

const DIALOG_HEADER_CLASS = "shrink-0 py-5 pl-6 pr-12";

const DIALOG_FOOTER_CLASS =
  "flex shrink-0 items-center justify-end gap-2 px-6 py-4";

function LoadingFields({ rows }: { rows: number }) {
  return (
    <div className="space-y-4 px-6 py-6">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
    </div>
  );
}

function UnavailableBody() {
  return (
    <p className="px-6 py-8 text-center text-sm text-muted-foreground">
      We couldn&apos;t load your account details. Try again in a moment.
    </p>
  );
}

function DialogSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className={formSpacing.stack}>
      <div className={formSpacing.tight}>
        <h3 className="text-base font-semibold tracking-tight text-sidebar-foreground">
          {title}
        </h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function AccountSettingsDialogNav({
  section,
  onSectionChange,
}: {
  section: DialogSectionId;
  onSectionChange: (section: DialogSectionId) => void;
}) {
  return (
    <nav
      aria-label="Account sections"
      className="flex w-44 shrink-0 flex-col gap-1 p-3"
    >
      {DIALOG_SECTIONS.map(({ id, label, icon: Icon }) => {
        const isActive = section === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSectionChange(id)}
            className={cn(
              "flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
              "outline-none focus-visible:ring-1 focus-visible:ring-ring",
              isActive
                ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {label}
          </button>
        );
      })}
    </nav>
  );
}

function AccountSettingsDialogBody({
  profile,
}: {
  profile: AccountSettingsProfile;
}) {
  const [section, setSection] = React.useState<DialogSectionId>("profile");

  const profileForm = useAccountSettingsForm({ profile });
  const passwordForm = useChangePassword();

  const active =
    section === "profile"
      ? {
          formId: PROFILE_FORM_ID,
          saveDisabled: profileForm.saveDisabled,
          isBusy: profileForm.isBusy,
          saveState: profileForm.saveState,
          idleLabel: "Save Profile",
          savingLabel: "Saving…",
          savedLabel: "Saved",
        }
      : {
          formId: PASSWORD_FORM_ID,
          saveDisabled: passwordForm.saveDisabled,
          isBusy: passwordForm.isBusy,
          saveState: passwordForm.saveState,
          idleLabel: "Update Password",
          savingLabel: "Updating…",
          savedLabel: "Updated",
        };

  return (
    <>
      <PanelHeader
        titleAs={DialogTitle}
        title="Account"
        className={DIALOG_HEADER_CLASS}
      />

      <div className="flex min-h-0 flex-1">
        <AccountSettingsDialogNav
          section={section}
          onSectionChange={setSection}
        />
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-3">
          {/* Keep both mounted so in-progress edits survive section switches. */}
          <div hidden={section !== "profile"}>
            <form
              id={PROFILE_FORM_ID}
              onSubmit={profileForm.submit}
            >
              <DialogSection
                title="Profile"
                description="Your photo, name, and the handle used in your public document URLs."
              >
                <ProfileFields
                  form={profileForm.form}
                  surface="dialog"
                  avatar={profileForm.avatar}
                  defaultAvatarColor={profile.default_avatar_background_color}
                  isSaving={profileForm.isSaving}
                  usernameAvailabilityStatus={
                    profileForm.usernameAvailabilityStatus
                  }
                />
              </DialogSection>
            </form>
          </div>
          <div hidden={section !== "password"}>
            <DialogSection
              title="Password"
              description="Confirm your current password, then choose a new one of at least 8 characters."
            >
              <ChangePasswordSection
                form={passwordForm.form}
                formId={PASSWORD_FORM_ID}
                onSubmit={passwordForm.submit}
                reauthRequired={passwordForm.reauthRequired}
                successMessage={
                  passwordForm.saveState === "saved" ? "Password updated" : null
                }
              />
            </DialogSection>
          </div>
        </div>
      </div>

      <div className={DIALOG_FOOTER_CLASS}>
        <Button
          type="submit"
          form={active.formId}
          size="sm"
          className={cn(
            "active:scale-[0.98]",
            // Animate only during save feedback — not when section switches
            // flip enabled/disabled or the idle label.
            active.isBusy &&
              "transition-[transform,background-color,color,opacity] duration-200 ease-out disabled:opacity-100",
          )}
          disabled={active.saveDisabled}
        >
          <SaveFeedbackLabel
            state={active.saveState}
            idleLabel={active.idleLabel}
            savingLabel={active.savingLabel}
            savedLabel={active.savedLabel}
          />
        </Button>
      </div>
    </>
  );
}

function AccountSettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: profile, isLoading } = useUserProfile();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={DIALOG_SHELL_CLASS}>
        <DialogDescription className="sr-only">
          Manage your profile and password.
        </DialogDescription>

        {profile ? (
          <AccountSettingsDialogBody profile={profile} />
        ) : (
          <>
            <PanelHeader
              titleAs={DialogTitle}
              title="Account"
              className={DIALOG_HEADER_CLASS}
            />
            <div className="min-h-0 flex-1">
              {isLoading ? <LoadingFields rows={3} /> : <UnavailableBody />}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RowTrailing({ value }: { value?: string }) {
  return (
    <span className="flex items-center gap-1.5">
      {value ? (
        <span className="max-w-[9rem] truncate text-[15px]">{value}</span>
      ) : null}
      <ChevronRight className="size-5 shrink-0" aria-hidden />
    </span>
  );
}

function AccountSettingsDrawerBody({
  profile,
}: {
  profile: AccountSettingsProfile;
}) {
  const view = useAccountSettingsStore((state) => state.view);
  const setView = useAccountSettingsStore((state) => state.setView);

  const stage = useMobileDrawerStage<AccountSettingsView>({
    view,
    setView,
    mainView: "main",
    keyboardView: KEYBOARD_VIEWS,
    measureDeps: [profile],
  });

  const { avatar, submit, isSaving, isBusy, saveDisabled, saveState } =
    useAccountSettingsForm({
      profile,
    });

  const openSubView = React.useCallback(
    (next: AccountSettingsView) => {
      stage.measureMainStage();
      stage.goToView(next, 1);
    },
    [stage],
  );

  const returnToProfile = React.useCallback(() => {
    stage.returnToView("profile");
  }, [stage]);

  const returnToMain = React.useCallback(() => {
    stage.returnToMainView();
  }, [stage]);

  const fullName = [profile.first_name, profile.last_name]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(" ");

  const renderMainView = () => (
    <div className="pb-6">
      <MobileDrawerScreenHeader
        title="Account"
        description="Manage your profile and password."
      />
      <div className="px-4">
        <MobileActionGroup>
          <MobileActionButtonRow
            icon={User}
            label="Profile"
            trailing={<RowTrailing value={fullName} />}
            onClick={() => openSubView("profile")}
          />
          <MobileActionButtonRow
            icon={Lock}
            label="Password"
            trailing={<RowTrailing />}
            onClick={() => openSubView("password")}
          />
        </MobileActionGroup>
      </div>
    </div>
  );

  const renderProfileView = () => (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <MobileDrawerNavHeader
        title="Profile"
        backLabel="Back"
        doneLabel={<SaveFeedbackLabel state={saveState} />}
        disabled={isSaving}
        // Save is only for avatar changes on this screen.
        doneDisabled={saveDisabled || isBusy || !avatar.isDirty}
        doneClassName={isBusy ? "disabled:opacity-100" : undefined}
        onBack={stage.returnToMainView}
        onDone={() => {
          void submit();
        }}
      />
      <div className="flex flex-col gap-6 px-4 pb-8 pt-2">
        <AvatarField
          draft={avatar}
          firstName={profile.first_name ?? ""}
          lastName={profile.last_name ?? ""}
          defaultAvatarColor={profile.default_avatar_background_color}
          disabled={isSaving}
        />
        <MobileActionGroup>
          <MobileActionButtonRow
            icon={User}
            label="First name"
            trailing={<RowTrailing value={profile.first_name ?? undefined} />}
            onClick={() => openSubView("first_name")}
          />
          <MobileActionButtonRow
            icon={User}
            label="Last name"
            trailing={<RowTrailing value={profile.last_name ?? undefined} />}
            onClick={() => openSubView("last_name")}
          />
          <MobileActionButtonRow
            icon={AtSign}
            label="Username"
            trailing={
              <RowTrailing
                value={profile.username ? `@${profile.username}` : undefined}
              />
            }
            onClick={() => openSubView("username")}
          />
        </MobileActionGroup>
      </div>
    </form>
  );

  return (
    <MobileDrawerViewStack
      view={view}
      direction={stage.direction}
      stageMinHeight={stage.stageMinHeight}
      stageIsMeasured={stage.stageIsMeasured}
      stageRef={stage.stageRef}
      getMotionRef={stage.getMotionRef}
      renderView={(currentView) => {
        if (currentView === "profile") {
          return renderProfileView();
        }

        if (isProfileField(currentView)) {
          return (
            <MobileProfileFieldEdit
              field={currentView}
              profile={profile}
              onBack={returnToProfile}
              onSaved={returnToProfile}
            />
          );
        }

        if (currentView === "password") {
          return (
            <MobileChangePassword
              onBack={returnToMain}
              onSaved={returnToMain}
            />
          );
        }

        return renderMainView();
      }}
    />
  );
}

function AccountSettingsDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: profile, isLoading } = useUserProfile();

  return (
    <MobileMenuDrawer open={open} onOpenChange={onOpenChange}>
      {profile ? (
        <AccountSettingsDrawerBody profile={profile} />
      ) : (
        <div className="pb-6">
          <MobileDrawerScreenHeader
            title="Account"
            description="Manage your profile and password."
          />
          {isLoading ? <LoadingFields rows={2} /> : <UnavailableBody />}
        </div>
      )}
    </MobileMenuDrawer>
  );
}

/** Account settings: a centered modal on desktop, a bottom drawer on mobile. */
export function AccountSettings() {
  const isOpen = useAccountSettingsStore((state) => state.isOpen);
  const setOpen = useAccountSettingsStore((state) => state.setOpen);
  const isMobile = useIsMobile();

  if (isMobile) {
    return <AccountSettingsDrawer open={isOpen} onOpenChange={setOpen} />;
  }

  return <AccountSettingsDialog open={isOpen} onOpenChange={setOpen} />;
}
