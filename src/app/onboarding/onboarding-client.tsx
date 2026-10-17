"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { AvatarField } from "~/app/_components/account-settings/avatar-field";
import {
  useAvatarDraft,
  type AvatarDraft,
} from "~/app/_components/account-settings/use-avatar-draft";
import {
  useHandleSuggestion,
  useUsernameAvailability,
} from "~/app/_components/account-settings/use-username-availability";
import { UsernameAvailabilityFeedback } from "~/app/_components/account-settings/username-availability-feedback";
import { Button } from "~/app/_components/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "~/app/_components/form";
import { Input } from "~/app/_components/input";
import { SaveFeedbackLabel } from "~/app/_components/save-feedback-label";
import { UserAvatar } from "~/app/_components/user-avatar";
import {
  SAVE_FEEDBACK_SETTLE_MS,
  useSaveFeedback,
} from "~/hooks/use-save-feedback";
import { signupProfileSchema } from "~/lib/account-schema";
import { validateHandleFormat } from "~/lib/author-handle";
import { formControlClassName } from "~/lib/form-control-styles";
import { formSpacing } from "~/lib/form-spacing";
import type { OnboardingStep } from "~/lib/onboarding";
import { PUBLIC_SITE_HOST } from "~/lib/public-url";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { createClient } from "~/utils/supabase/client";

import { OnboardingArticlePreview } from "./onboarding-preview";

const nameSchema = z.object({
  author_name: signupProfileSchema.shape.author_name,
});

const handleSchema = z.object({
  username: z
    .string()
    .trim()
    .superRefine((value, ctx) => {
      const result = validateHandleFormat(value);
      if (result.ok) return;
      const trimmed = value.trim();
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          result.reason === "reserved"
            ? "This link isn't available"
            : trimmed.length < 2
              ? "Use at least 2 characters"
              : trimmed.length > 50
                ? "Use at most 50 characters"
                : "Use only letters, numbers, hyphens, and underscores",
      });
    }),
});

const STEP_COPY: Record<
  OnboardingStep,
  { index: number; heading: string; description: string }
> = {
  name: {
    index: 1,
    heading: "What should we call you?",
    description:
      "This is how your name will appear on published articles. You can use a pen name.",
  },
  handle: {
    index: 2,
    heading: "Your public profile",
    description:
      "We've created a unique link for your articles based on your name. You can customize it if you'd like.",
  },
  avatar: {
    index: 3,
    heading: "Add a personal touch",
    description:
      "Optional. A photo appears beside your name. You can skip this and add one later.",
  },
};

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Try again.";
}

function linkSaveError(error: unknown): string {
  const message = errorMessage(error);
  if (/already taken/i.test(message)) return "This link is already taken";
  if (/reserved|not allowed/i.test(message)) return "This link isn't available";
  if (/invalid|letters, numbers/i.test(message)) {
    return "Use only letters, numbers, hyphens, and underscores";
  }
  return message;
}

export function OnboardingClient({
  step: initialStep,
  authorName,
  username,
  suggestedAuthorName,
  suggestedAvatarUrl,
  avatarUrl,
  defaultAvatarColor,
}: {
  step: OnboardingStep;
  authorName: string;
  username: string;
  suggestedAuthorName: string | null;
  suggestedAvatarUrl: string | null;
  avatarUrl: string | null;
  defaultAvatarColor: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(initialStep);
  const [authError, setAuthError] = useState<string | null>(null);
  const [draftName, setDraftName] = useState(
    authorName.trim() || suggestedAuthorName || "",
  );
  const [draftHandle, setDraftHandle] = useState(username);
  const [draftAvatar, setDraftAvatar] = useState<string | null>(avatarUrl);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const copy = STEP_COPY[step];
  const preview = (
    <OnboardingArticlePreview
      step={step}
      authorName={draftName}
      handle={draftHandle}
      avatarUrl={draftAvatar}
      defaultAvatarColor={defaultAvatarColor}
      variant="desktop"
    />
  );

  return (
    <div className="min-h-dvh bg-background lg:grid lg:h-dvh lg:grid-cols-[minmax(20rem,2fr)_minmax(0,3fr)] lg:overflow-hidden">
      <section className="flex min-h-dvh flex-col lg:h-dvh lg:min-h-0 lg:border-r lg:border-border/60">
        <header className="flex items-center justify-between px-6 pt-6 sm:px-10 lg:px-12">
          <p className="font-lora text-xl font-medium tracking-tight">Chptr</p>
          <button
            type="button"
            className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            onClick={() => {
              void signOut();
            }}
          >
            Sign out
          </button>
        </header>

        <div className="flex flex-1 overflow-y-auto px-6 py-8 sm:px-10 lg:px-12">
          <div className={cn("m-auto w-full max-w-sm", formSpacing.section)}>
            <div
              key={step}
              className={cn(
                formSpacing.tight,
                "motion-safe:duration-200 motion-safe:animate-in motion-safe:fade-in",
              )}
            >
              <p className="text-sm text-muted-foreground">
                Step {copy.index} of 3
              </p>
              <h1 className="font-lora text-3xl font-medium tracking-tight">
                {copy.heading}
              </h1>
              <p className="text-sm text-muted-foreground">
                {copy.description}
              </p>
            </div>

            <div hidden={step !== "name"}>
              <NameStep
                initialName={draftName}
                onDraftChange={setDraftName}
                onContinue={(name) => {
                  setDraftName(name);
                  setAuthError(null);
                  setStep("handle");
                }}
                preview={
                  <CompactPreview
                    step="name"
                    authorName={draftName}
                    handle={draftHandle}
                    avatarUrl={draftAvatar}
                    defaultAvatarColor={defaultAvatarColor}
                  />
                }
              />
            </div>

            <div hidden={step !== "handle"}>
              <HandleStep
                authorName={step === "handle" ? draftName : ""}
                initialHandle={draftHandle}
                savedHandle={username}
                error={authError}
                onError={setAuthError}
                onDraftChange={setDraftHandle}
                onBack={() => setStep("name")}
                onContinue={(handle) => {
                  setDraftHandle(handle);
                  setAuthError(null);
                  setStep("avatar");
                }}
              />
            </div>

            <div hidden={step !== "avatar"}>
              <AvatarStep
                authorName={draftName}
                username={draftHandle}
                avatarUrl={avatarUrl}
                suggestedAvatarUrl={suggestedAvatarUrl}
                defaultAvatarColor={defaultAvatarColor}
                error={authError}
                onError={setAuthError}
                onAvatarChange={setDraftAvatar}
                onBack={() => setStep("handle")}
                onIncomplete={setStep}
                preview={
                  <CompactPreview
                    step="avatar"
                    authorName={draftName}
                    handle={draftHandle}
                    avatarUrl={draftAvatar}
                    defaultAvatarColor={defaultAvatarColor}
                  />
                }
              />
            </div>
          </div>
        </div>
      </section>

      <section className="hidden min-h-0 lg:block">{preview}</section>
    </div>
  );
}

function CompactPreview(props: {
  step: OnboardingStep;
  authorName: string;
  handle: string;
  avatarUrl: string | null;
  defaultAvatarColor: string;
}) {
  return (
    <div className="overflow-hidden border-y border-border/60 lg:hidden">
      <OnboardingArticlePreview {...props} variant="compact" />
    </div>
  );
}

function NameStep({
  initialName,
  onDraftChange,
  onContinue,
  preview,
}: {
  initialName: string;
  onDraftChange: (value: string) => void;
  onContinue: (name: string) => void;
  preview: ReactNode;
}) {
  const form = useForm<z.infer<typeof nameSchema>>({
    resolver: zodResolver(nameSchema),
    defaultValues: { author_name: initialName },
  });
  const name = form.watch("author_name");
  const parsedName = nameSchema.shape.author_name.safeParse(name);
  const nameError =
    name.trim().length > 0 && !parsedName.success
      ? parsedName.error.issues[0]?.message
      : undefined;

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => {
          onContinue(values.author_name);
        })}
        className={formSpacing.section}
      >
        <div className={formSpacing.stack}>
          <FormField
            control={form.control}
            name="author_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Author name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Jane Mitchell"
                    autoComplete="name"
                    {...field}
                    onChange={(event) => {
                      field.onChange(event);
                      onDraftChange(event.target.value);
                    }}
                  />
                </FormControl>
                <div className="min-h-5">
                  {nameError ? (
                    <p className="text-[0.8rem] font-medium text-destructive">
                      {nameError}
                    </p>
                  ) : null}
                </div>
              </FormItem>
            )}
          />
          {preview}
        </div>
        <Button type="submit" className="w-full" disabled={!parsedName.success}>
          Continue
        </Button>
      </form>
    </Form>
  );
}

function HandleStep({
  authorName,
  initialHandle,
  savedHandle,
  error,
  onError,
  onDraftChange,
  onBack,
  onContinue,
}: {
  authorName: string;
  initialHandle: string;
  /** Profile handle already stored. Not the live draft — availability treats that as "yours". */
  savedHandle: string;
  error: string | null;
  onError: (message: string | null) => void;
  onDraftChange: (value: string) => void;
  onBack: () => void;
  onContinue: (handle: string) => void;
}) {
  const [handleTouched, setHandleTouched] = useState(
    initialHandle.trim().length > 0,
  );
  const form = useForm<z.infer<typeof handleSchema>>({
    resolver: zodResolver(handleSchema),
    defaultValues: { username: initialHandle },
  });
  const handle = form.watch("username");
  const suggestion = useHandleSuggestion(
    authorName,
    // A touched empty field must not look blank to the suggestion query, or
    // clearing the input fetches the default and writes it back.
    handleTouched ? handle.trim() || "-" : "",
  );
  const availability = useUsernameAvailability(handle, savedHandle);

  useEffect(() => {
    if (handleTouched) return;
    if (!suggestion) return;
    form.setValue("username", suggestion, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }, [form, handleTouched, suggestion]);

  useEffect(() => {
    onDraftChange(handle);
  }, [handle, onDraftChange]);

  const trimmedHandle = handle.trim();
  const parsedHandle = handleSchema.shape.username.safeParse(trimmedHandle);
  const formatError =
    trimmedHandle.length > 0 && !parsedHandle.success
      ? parsedHandle.error.issues[0]?.message
      : undefined;
  const ownsSavedHandle =
    trimmedHandle.length > 0 &&
    trimmedHandle.toLowerCase() === savedHandle.trim().toLowerCase();
  const linkConfirmed = ownsSavedHandle || availability.status === "available";
  const linkBlocked =
    trimmedHandle.length === 0 ||
    Boolean(formatError) ||
    availability.status === "checking" ||
    availability.status === "taken" ||
    availability.status === "reserved" ||
    !linkConfirmed;
  const linkBlockedRef = useRef(linkBlocked);
  linkBlockedRef.current = linkBlocked;

  function continueForward() {
    if (linkBlockedRef.current) return;
    void form.handleSubmit((values) => {
      if (linkBlockedRef.current) return;
      onContinue(values.username);
    })();
  }

  return (
    <Form {...form}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          continueForward();
        }}
        className={formSpacing.section}
      >
        <div className={formSpacing.stack}>
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Your link</FormLabel>
                <div
                  className={cn(
                    "flex h-9 w-full items-center rounded-md px-3",
                    formControlClassName,
                    "focus-within:border-foreground/40 focus-within:outline-none focus-within:ring-1 focus-within:ring-foreground/10",
                  )}
                  onMouseDown={(event) => {
                    if (event.target instanceof HTMLInputElement) return;
                    event.preventDefault();
                    event.currentTarget.querySelector("input")?.focus();
                  }}
                >
                  <span
                    className="shrink-0 select-none text-base text-muted-foreground md:text-sm"
                    aria-hidden
                  >
                    {PUBLIC_SITE_HOST}/
                  </span>
                  <FormControl>
                    <input
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      className="h-full min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground/65 md:text-sm"
                      {...field}
                      onChange={(event) => {
                        setHandleTouched(true);
                        field.onChange(event);
                        onError(null);
                      }}
                    />
                  </FormControl>
                </div>
                <div className="min-h-5">
                  {formatError ? (
                    <p className="text-[0.8rem] font-medium text-destructive">
                      {formatError}
                    </p>
                  ) : availability.status === "idle" ? null : (
                    <UsernameAvailabilityFeedback
                      status={availability.status}
                      animate={false}
                      labels={{
                        available: "Available",
                        taken: "This link is already taken",
                        reserved: "This link isn't available",
                      }}
                    />
                  )}
                </div>
              </FormItem>
            )}
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <div className={cn("flex", formSpacing.stackGap)}>
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onBack}
          >
            Back
          </Button>
          <Button
            type="submit"
            className={cn(
              "flex-1",
              linkBlocked &&
                "cursor-not-allowed opacity-50 disabled:pointer-events-auto disabled:cursor-not-allowed disabled:opacity-50",
            )}
            disabled={linkBlocked}
            aria-disabled={linkBlocked}
            onClick={(event) => {
              if (!linkBlockedRef.current) return;
              event.preventDefault();
            }}
          >
            Continue
          </Button>
        </div>
      </form>
    </Form>
  );
}

function AvatarStep({
  authorName,
  username,
  avatarUrl,
  suggestedAvatarUrl,
  defaultAvatarColor,
  error,
  onError,
  onAvatarChange,
  onBack,
  onIncomplete,
  preview,
}: {
  authorName: string;
  username: string;
  avatarUrl: string | null;
  suggestedAvatarUrl: string | null;
  defaultAvatarColor: string;
  error: string | null;
  onError: (message: string | null) => void;
  onAvatarChange: (url: string | null) => void;
  onBack: () => void;
  onIncomplete: (step: "name" | "handle") => void;
  preview: ReactNode;
}) {
  const router = useRouter();
  const feedback = useSaveFeedback();
  const avatar = useAvatarDraft(avatarUrl);
  const updateAvatar = api.user.updateAvatar.useMutation();
  const acceptPhoto = api.user.acceptSuggestedAvatar.useMutation();
  const complete = api.user.completeOnboarding.useMutation();
  const [suggestedSelected, setSuggestedSelected] = useState(false);
  const [pendingAction, setPendingAction] = useState<"finish" | "skip" | null>(
    null,
  );
  const busy =
    feedback.inFlight ||
    feedback.state === "saving" ||
    feedback.state === "saved";
  const displayUrl =
    suggestedSelected && !avatar.isDirty
      ? suggestedAvatarUrl
      : avatar.displayUrl;
  const showSuggestion =
    suggestedAvatarUrl != null && displayUrl !== suggestedAvatarUrl;

  const photo: AvatarDraft = {
    ...avatar,
    displayUrl,
    hasImage: Boolean(displayUrl),
    select: (file) => {
      setSuggestedSelected(false);
      avatar.select(file);
    },
    clear: () => {
      setSuggestedSelected(false);
      avatar.clear();
    },
  };

  useEffect(() => {
    onAvatarChange(displayUrl);
  }, [displayUrl, onAvatarChange]);

  async function finish(skipAvatar: boolean) {
    if (!nameSchema.safeParse({ author_name: authorName }).success) {
      onIncomplete("name");
      return;
    }
    if (!handleSchema.safeParse({ username }).success) {
      onIncomplete("handle");
      return;
    }

    onError(null);
    setPendingAction(skipAvatar ? "skip" : "finish");
    feedback.start();
    try {
      if (!skipAvatar) {
        const committed = await avatar.commit();
        if (committed.changed) {
          await updateAvatar.mutateAsync({ path: committed.path });
        } else if (suggestedSelected && suggestedAvatarUrl) {
          await acceptPhoto.mutateAsync();
        }
      }
      await complete.mutateAsync({
        author_name: authorName,
        username,
      });
      await feedback.settle("saved");
      feedback.runAfterResult(() => {
        router.push("/welcome");
        router.refresh();
      }, SAVE_FEEDBACK_SETTLE_MS);
    } catch (caught) {
      onError(linkSaveError(caught));
      await feedback.settle("failed");
    }
  }

  function useSuggestedPhoto() {
    avatar.reset();
    setSuggestedSelected(true);
    onError(null);
  }

  return (
    <div className={formSpacing.section}>
      <div className={formSpacing.stack}>
        <div className={formSpacing.tight}>
          <p className="text-sm font-medium leading-none">Profile photo</p>
          <AvatarField
            draft={photo}
            name={authorName}
            defaultAvatarColor={defaultAvatarColor}
            disabled={busy}
          />
        </div>
        {showSuggestion ? (
          <div className={cn("flex items-center", formSpacing.stackGap)}>
            <UserAvatar
              name={authorName}
              avatar_url={suggestedAvatarUrl}
              default_avatar_background_color={defaultAvatarColor}
              className="h-10 w-10"
            />
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={useSuggestedPhoto}
            >
              Use this photo
            </Button>
          </div>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {preview}
      </div>
      <div className={formSpacing.stack}>
        <div className={cn("flex", formSpacing.stackGap)}>
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={busy}
            onClick={onBack}
          >
            Back
          </Button>
          <Button
            type="button"
            className="flex-1 disabled:opacity-100"
            disabled={busy}
            onClick={() => {
              void finish(false);
            }}
          >
            <SaveFeedbackLabel
              state={pendingAction === "finish" ? feedback.state : "idle"}
              idleLabel="Finish"
              savingLabel="Finishing"
              savedLabel="Done"
            />
          </Button>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="w-full disabled:opacity-100"
          disabled={busy}
          onClick={() => {
            void finish(true);
          }}
        >
          <SaveFeedbackLabel
            state={pendingAction === "skip" ? feedback.state : "idle"}
            idleLabel="Skip for now"
            savingLabel="Finishing"
            savedLabel="Done"
          />
        </Button>
      </div>
    </div>
  );
}
