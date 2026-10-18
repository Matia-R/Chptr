"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { motion, useReducedMotion } from "framer-motion";
import { Loader2 } from "lucide-react";
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
  useUsernameAvailability,
  type UsernameAvailabilityStatus,
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
import {
  normalizeHandle,
  suggestedHandleFromAuthorName,
  validateHandleFormat,
} from "~/lib/author-handle";
import { formControlClassName } from "~/lib/form-control-styles";
import { formSpacing } from "~/lib/form-spacing";
import { generatedHandleToApply, type OnboardingStep } from "~/lib/onboarding";
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

const STEP_INDEX: Record<OnboardingStep, number> = {
  name: 0,
  handle: 1,
  avatar: 2,
};

const STEP_SLIDE_PX = 24;
const STEP_EASE = [0.22, 1, 0.36, 1] as const;

const STEP_LEAVE = {
  duration: 0.18,
  ease: STEP_EASE,
};

const STEP_ENTER = {
  duration: 0.28,
  delay: 0.16,
  ease: STEP_EASE,
};

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
  const [handleEdited, setHandleEdited] = useState(username.trim().length > 0);
  const [draftAvatar, setDraftAvatar] = useState<string | null>(avatarUrl);
  const availability = useUsernameAvailability(draftHandle, username);
  const unavailable =
    availability.status === "taken" || availability.status === "reserved";
  const alternative = api.user.suggestHandle.useQuery(
    { authorName: draftName.trim() },
    {
      enabled: draftName.trim().length > 0 && unavailable,
      staleTime: 30_000,
    },
  );
  const utils = api.useUtils();
  const linkStatus: UsernameAvailabilityStatus =
    !handleEdited && unavailable && alternative.isFetching
      ? "checking"
      : availability.status;

  const trimmedDraftName = draftName.trim();

  useEffect(() => {
    if (handleEdited) return;
    setDraftHandle(suggestedHandleFromAuthorName(trimmedDraftName));
  }, [handleEdited, trimmedDraftName]);

  useEffect(() => {
    const next = generatedHandleToApply({
      edited: handleEdited,
      authorName: draftName,
      currentHandle: draftHandle,
      unavailable,
      alternative: alternative.data?.handle ?? null,
    });
    if (next) setDraftHandle(next);
  }, [
    alternative.data?.handle,
    draftHandle,
    draftName,
    handleEdited,
    unavailable,
  ]);

  function editHandle(next: string) {
    setHandleEdited(true);
    setDraftHandle(next);
    setAuthError(null);
  }

  async function confirmHandle(handle: string) {
    const own =
      username.trim().length > 0 &&
      normalizeHandle(handle) === normalizeHandle(username);
    if (own) return { ok: true as const };
    try {
      const result = await utils.user.checkUsernameAvailability.fetch({
        username: handle.trim(),
      });
      if (result.available) return { ok: true as const };
      return {
        ok: false as const,
        reason:
          result.reason === "reserved"
            ? ("reserved" as const)
            : ("taken" as const),
      };
    } catch {
      return { ok: false as const, reason: "error" as const };
    }
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const preview = (
    <OnboardingArticlePreview
      authorName={draftName}
      handle={draftHandle}
      avatarUrl={draftAvatar}
      defaultAvatarColor={defaultAvatarColor}
      variant="desktop"
      showPath={step !== "name"}
    />
  );

  return (
    <div className="relative min-h-dvh bg-background lg:grid lg:h-dvh lg:grid-cols-[minmax(20rem,2fr)_minmax(0,3fr)] lg:overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-end px-6 pt-6 sm:px-10 lg:px-12">
        <div className="pointer-events-auto flex h-7 items-center">
          <button
            type="button"
            className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            onClick={() => {
              void signOut();
            }}
          >
            Sign out
          </button>
        </div>
      </div>
      <section className="flex min-h-dvh flex-col lg:h-dvh lg:min-h-0">
        <header className="flex items-center px-6 pt-6 sm:px-10 lg:px-12">
          <p className="font-lora text-2xl font-medium tracking-tight">Chptr</p>
        </header>

        <div className="flex flex-1 overflow-y-auto px-6 py-8 sm:px-10 lg:px-12">
          <div className="relative m-auto grid w-full max-w-sm items-start overflow-x-clip">
            <StepPane step="name" active={step}>
              <div className={formSpacing.section}>
                <StepIntro step="name" />
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
                      authorName={draftName}
                      handle={draftHandle}
                      avatarUrl={draftAvatar}
                      defaultAvatarColor={defaultAvatarColor}
                    />
                  }
                />
              </div>
            </StepPane>

            <StepPane step="handle" active={step}>
              <div className={formSpacing.section}>
                <StepIntro step="handle" />
                <HandleStep
                  handle={draftHandle}
                  edited={handleEdited}
                  savedHandle={username}
                  status={linkStatus}
                  alternative={
                    handleEdited &&
                    unavailable &&
                    alternative.data?.handle &&
                    normalizeHandle(alternative.data.handle) !==
                      normalizeHandle(draftHandle)
                      ? alternative.data.handle
                      : null
                  }
                  error={authError}
                  onError={setAuthError}
                  onEdit={editHandle}
                  onRetry={() => {
                    void availability.refetch();
                  }}
                  onUseAlternative={(next) => {
                    editHandle(next);
                  }}
                  onConfirm={confirmHandle}
                  onBack={() => setStep("name")}
                  onContinue={(handle) => {
                    setDraftHandle(handle);
                    setAuthError(null);
                    setStep("avatar");
                  }}
                />
              </div>
            </StepPane>

            <StepPane step="avatar" active={step}>
              <div className={formSpacing.section}>
                <StepIntro step="avatar" />
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
                      authorName={draftName}
                      handle={draftHandle}
                      avatarUrl={draftAvatar}
                      defaultAvatarColor={defaultAvatarColor}
                    />
                  }
                />
              </div>
            </StepPane>
          </div>
        </div>
      </section>

      <section className="hidden h-full min-h-0 overflow-hidden lg:block">
        {preview}
      </section>
    </div>
  );
}

function StepIntro({ step }: { step: OnboardingStep }) {
  const copy = STEP_COPY[step];

  return (
    <div className={formSpacing.tight}>
      <p className="text-sm text-muted-foreground">Step {copy.index} of 3</p>
      <h1 className="font-lora text-3xl font-medium tracking-tight">
        {copy.heading}
      </h1>
      <p className="text-sm text-muted-foreground">{copy.description}</p>
    </div>
  );
}

function StepPane({
  step,
  active,
  children,
}: {
  step: OnboardingStep;
  active: OnboardingStep;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const delta = STEP_INDEX[step] - STEP_INDEX[active];
  const inactive = delta !== 0;

  return (
    <motion.div
      initial={false}
      animate={{
        opacity: inactive ? 0 : 1,
        x: reduceMotion || !inactive ? 0 : delta * STEP_SLIDE_PX,
      }}
      transition={
        reduceMotion ? { duration: 0 } : inactive ? STEP_LEAVE : STEP_ENTER
      }
      className={cn(
        "col-start-1 row-start-1 w-full",
        inactive ? "pointer-events-none z-20" : "z-10",
      )}
      aria-hidden={inactive}
      inert={inactive}
    >
      {children}
    </motion.div>
  );
}

function CompactPreview(props: {
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
  handle,
  edited,
  savedHandle,
  status,
  alternative,
  error,
  onError,
  onEdit,
  onRetry,
  onUseAlternative,
  onConfirm,
  onBack,
  onContinue,
}: {
  handle: string;
  edited: boolean;
  /** Profile handle already stored. Availability treats that as "yours". */
  savedHandle: string;
  status: UsernameAvailabilityStatus;
  alternative: string | null;
  error: string | null;
  onError: (message: string | null) => void;
  onEdit: (value: string) => void;
  onRetry: () => void;
  onUseAlternative: (handle: string) => void;
  onConfirm: (
    handle: string,
  ) => Promise<
    { ok: true } | { ok: false; reason: "taken" | "reserved" | "error" }
  >;
  onBack: () => void;
  onContinue: (handle: string) => void;
}) {
  const [resolving, setResolving] = useState(false);
  const form = useForm<z.infer<typeof handleSchema>>({
    resolver: zodResolver(handleSchema),
    defaultValues: { username: handle },
  });
  const gateRef = useRef({ handle, status, resolving });
  gateRef.current = { handle, status, resolving };

  useEffect(() => {
    if (edited) return;
    if (form.getValues("username") === handle) return;
    form.setValue("username", handle, { shouldValidate: true });
  }, [edited, form, handle]);

  const trimmedHandle = handle.trim();
  const parsedHandle = handleSchema.shape.username.safeParse(trimmedHandle);
  const formatError =
    trimmedHandle.length > 0 && !parsedHandle.success
      ? parsedHandle.error.issues[0]?.message
      : undefined;
  const knownTaken = status === "taken" || status === "reserved";
  const continueBlocked =
    resolving ||
    trimmedHandle.length === 0 ||
    Boolean(formatError) ||
    knownTaken;

  async function continueForward() {
    const current = gateRef.current;
    if (current.resolving) return;
    const value = current.handle.trim();
    const parsed = handleSchema.shape.username.safeParse(value);
    if (!parsed.success) return;
    if (current.status === "taken" || current.status === "reserved") return;
    const confirmed =
      current.status === "available" ||
      (savedHandle.trim().length > 0 &&
        value.toLowerCase() === savedHandle.trim().toLowerCase());
    if (confirmed) {
      onContinue(parsed.data);
      return;
    }
    setResolving(true);
    const result = await onConfirm(value);
    setResolving(false);
    if (result.ok) {
      onContinue(parsed.data);
      return;
    }
    onError(
      result.reason === "reserved"
        ? "This link isn't available"
        : result.reason === "error"
          ? "Couldn't check availability. Try again."
          : "This link is already taken",
    );
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
                        field.onChange(event);
                        onEdit(event.target.value);
                      }}
                    />
                  </FormControl>
                </div>
                <div className="min-h-5">
                  {formatError ? (
                    <p className="text-[0.8rem] font-medium text-destructive">
                      {formatError}
                    </p>
                  ) : status === "idle" ? null : (
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <UsernameAvailabilityFeedback
                        status={status}
                        animate={false}
                        labels={{
                          checking: "Checking availability…",
                          available: "Available",
                          taken: "This link is already taken",
                          reserved: "This link isn't available",
                          error: "Couldn't check availability",
                        }}
                      />
                      {status === "error" ? (
                        <button
                          type="button"
                          className="text-[0.8rem] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                          onClick={onRetry}
                        >
                          Try again
                        </button>
                      ) : null}
                      {alternative ? (
                        <button
                          type="button"
                          className="text-[0.8rem] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                          onClick={() => onUseAlternative(alternative)}
                        >
                          Use {alternative}
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>
              </FormItem>
            )}
          />
          {error && !knownTaken && status !== "error" ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
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
              continueBlocked &&
                !resolving &&
                "cursor-not-allowed opacity-50 disabled:pointer-events-auto disabled:cursor-not-allowed disabled:opacity-50",
              resolving && "disabled:opacity-100",
            )}
            disabled={continueBlocked}
            aria-disabled={continueBlocked}
          >
            {resolving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking
              </>
            ) : (
              "Continue"
            )}
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

  async function finish() {
    if (!nameSchema.safeParse({ author_name: authorName }).success) {
      onIncomplete("name");
      return;
    }
    if (!handleSchema.safeParse({ username }).success) {
      onIncomplete("handle");
      return;
    }

    onError(null);
    feedback.start();
    try {
      const committed = await avatar.commit();
      if (committed.changed) {
        await updateAvatar.mutateAsync({ path: committed.path });
      } else if (suggestedSelected && suggestedAvatarUrl) {
        await acceptPhoto.mutateAsync();
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
            void finish();
          }}
        >
          <SaveFeedbackLabel
            state={feedback.state}
            idleLabel="Finish"
            savingLabel="Finishing"
            savedLabel="Done"
          />
        </Button>
      </div>
    </div>
  );
}
