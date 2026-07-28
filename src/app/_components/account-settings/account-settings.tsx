"use client";

import * as React from "react";
import { ChevronRight, Lock, User } from "lucide-react";

import { Button } from "~/app/_components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/app/_components/dialog";
import { Drawer, DrawerContent } from "~/app/_components/drawer";
import {
  MobileActionButtonRow,
  MobileActionGroup,
} from "~/app/_components/mobile-action-rows";
import {
  MOBILE_DRAWER_SHELL_CLASS,
  MobileDrawerEditBody,
  MobileDrawerNavHeader,
  MobileDrawerScreenHeader,
  MobileDrawerViewStack,
  useMobileDrawerKeyboardOffset,
  useMobileDrawerStage,
} from "~/app/_components/mobile-drawer";
import { PanelHeader } from "~/app/_components/panel-header";
import { SaveFeedbackLabel } from "~/app/_components/save-feedback-label";
import { Skeleton } from "~/app/_components/skeleton";
import {
  useAccountSettingsStore,
  type AccountSettingsView,
} from "~/hooks/use-account-settings";
import { useIsMobile } from "~/hooks/use-mobile";
import { useUserProfile } from "~/hooks/use-user-profile";
import { cn } from "~/lib/utils";

import { PasswordFields, ProfileFields } from "./account-settings-fields";
import {
  useAccountSettingsForm,
  type AccountSettingsProfile,
} from "./use-account-settings-form";

/** Both sub-screens hold text fields, so either can open the keyboard. */
const KEYBOARD_VIEWS: readonly AccountSettingsView[] = ["profile", "password"];

/** Lets the header's Save button submit the form it sits outside of. */
const DIALOG_FORM_ID = "account-settings-form";

const DIALOG_HEADER_CLASS =
  "shrink-0 border-b border-sidebar-border/70 px-6 pb-5 pt-6 dark:border-white/10";

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
    <section>
      <div className="mb-4 space-y-0.5">
        <h3 className="text-sm font-semibold text-sidebar-foreground">
          {title}
        </h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function AccountSettingsDialogBody({
  profile,
}: {
  profile: AccountSettingsProfile;
}) {
  const {
    form,
    avatar,
    submit,
    isSaving,
    isBusy,
    saveDisabled,
    saveState,
    usernameAvailabilityStatus,
  } = useAccountSettingsForm({ profile });

  return (
    <>
      <PanelHeader
        titleAs={DialogTitle}
        title="Account"
        className={DIALOG_HEADER_CLASS}
        action={
          <div className="flex items-center gap-2">
            <DialogClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isSaving}
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              form={DIALOG_FORM_ID}
              size="sm"
              className={cn(
                "transition-[transform,background-color,color,opacity] duration-200 ease-out active:scale-[0.98]",
                // Busy/success stay undimmed so the feedback reads at full contrast.
                isBusy && "disabled:opacity-100",
              )}
              disabled={saveDisabled || isBusy}
            >
              <SaveFeedbackLabel state={saveState} />
            </Button>
          </div>
        }
      />

      <form
        id={DIALOG_FORM_ID}
        onSubmit={submit}
        className="min-h-0 flex-1 space-y-8 overflow-y-auto overscroll-contain px-6 py-6"
      >
        <DialogSection
          title="Profile"
          description="Your photo, name, and the handle used in your public document URLs."
        >
          <ProfileFields
            form={form}
            surface="dialog"
            avatar={avatar}
            defaultAvatarColor={profile.default_avatar_background_color}
            isSaving={isSaving}
            usernameAvailabilityStatus={usernameAvailabilityStatus}
          />
        </DialogSection>

        <DialogSection
          title="Password"
          description="Set a new password of at least 8 characters."
        >
          <PasswordFields form={form} surface="dialog" />
        </DialogSection>
      </form>
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
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[min(90vh,52rem)] flex-col gap-0 overflow-hidden border-white/20 bg-white p-0 shadow-2xl dark:border-white/10 dark:bg-sidebar"
      >
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
            {isLoading ? <LoadingFields rows={3} /> : <UnavailableBody />}
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

  const {
    form,
    avatar,
    submit,
    isSaving,
    isBusy,
    saveDisabled,
    saveState,
    usernameAvailabilityStatus,
  } = useAccountSettingsForm({
      profile,
      onSaved: stage.returnToMainView,
    });

  const openSubView = React.useCallback(
    (next: AccountSettingsView) => {
      stage.measureMainStage();
      stage.goToView(next, 1);
    },
    [stage],
  );

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

  const renderSubView = (title: string, fields: React.ReactNode) => (
    <form onSubmit={submit}>
      <MobileDrawerNavHeader
        title={title}
        backLabel="Back"
        doneLabel={<SaveFeedbackLabel state={saveState} />}
        // Back only locks during the request; Save matches the desktop rules.
        disabled={isSaving}
        doneDisabled={saveDisabled || isBusy}
        doneClassName={isBusy ? "disabled:opacity-100" : undefined}
        onBack={stage.returnToMainView}
        onDone={() => {
          void submit();
        }}
      />
      <MobileDrawerEditBody>{fields}</MobileDrawerEditBody>
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
          return renderSubView(
            "Profile",
            <ProfileFields
              form={form}
              surface="drawer"
              avatar={avatar}
              defaultAvatarColor={profile.default_avatar_background_color}
              isSaving={isSaving}
              usernameAvailabilityStatus={usernameAvailabilityStatus}
            />,
          );
        }

        if (currentView === "password") {
          return renderSubView(
            "Password",
            <PasswordFields form={form} surface="drawer" />,
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
  const { keyboardOffset, drawerStyle } = useMobileDrawerKeyboardOffset(open);

  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent
        bottomUnderlay={keyboardOffset > 0}
        bottomUnderlayHeight={keyboardOffset}
        style={drawerStyle}
        className={MOBILE_DRAWER_SHELL_CLASS}
      >
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
      </DrawerContent>
    </Drawer>
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
