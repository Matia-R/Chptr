"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { motion, useReducedMotion } from "framer-motion";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "../_components/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../_components/form";
import { Input } from "../_components/input";
import { PasswordInput } from "../_components/password-input";
import { SaveFeedbackLabel } from "../_components/save-feedback-label";
import {
  STEP_ENTER,
  STEP_LEAVE,
  STEP_SLIDE_PX,
} from "~/app/onboarding/onboarding-motion";
import {
  SAVE_FEEDBACK_SETTLE_MS,
  useSaveFeedback,
} from "~/hooks/use-save-feedback";
import { formSpacing } from "~/lib/form-spacing";
import type { PendingSignupStage } from "~/lib/pending-signup";
import { cn } from "~/lib/utils";

import {
  resendSignupCode,
  returnToSignupForm,
  signup,
  verifySignupCode,
} from "./actions";
import { VerificationCodeInput } from "./verification-code-input";

const formSchema = z
  .object({
    email: z
      .string()
      .min(2, { message: "Email must be at least 2 characters" })
      .max(50)
      .email({ message: "Must be a valid email address" }),
    password: z
      .string()
      .min(8, { message: "Password must be at least 8 characters" }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type SignupValues = z.infer<typeof formSchema>;

const STAGE_INDEX: Record<PendingSignupStage, number> = {
  credentials: 0,
  verify: 1,
};

export function SignUpClient({
  initialEmail,
  initialStage,
}: {
  initialEmail: string;
  initialStage: PendingSignupStage;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<PendingSignupStage>(initialStage);
  const [pendingEmail, setPendingEmail] = useState(initialEmail);
  const [authError, setAuthError] = useState<string | null>(null);
  const signupFeedback = useSaveFeedback();
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  const submittedCode = useRef<string | null>(null);
  const requestId = useRef(0);
  const resendRequest = useRef(0);
  const resendFeedback = useSaveFeedback();
  const form = useForm<SignupValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: initialEmail,
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    return () => {
      resendRequest.current += 1;
    };
  }, []);

  useEffect(() => {
    if (stage !== "verify") return;
    if (code.length < 6) {
      submittedCode.current = null;
      return;
    }
    if (submittedCode.current === code) return;

    submittedCode.current = code;
    const currentRequest = ++requestId.current;
    setVerifying(true);
    setVerifyError(null);

    void (async () => {
      try {
        const result = await verifySignupCode(pendingEmail, code);
        if (currentRequest !== requestId.current) return;
        if ("error" in result) {
          setVerifyError(result.error);
          return;
        }
        router.push(result.redirectTo);
        router.refresh();
      } catch {
        if (currentRequest !== requestId.current) return;
        setVerifyError("Couldn't verify that code. Try again.");
      } finally {
        if (currentRequest === requestId.current) setVerifying(false);
      }
    })();
  }, [code, pendingEmail, router, stage]);

  async function onSubmit(values: SignupValues) {
    if (signupFeedback.state !== "idle") return;
    setAuthError(null);
    const formData = new FormData();
    formData.append("email", values.email);
    formData.append("password", values.password);

    signupFeedback.start();
    try {
      const result = await signup(formData);
      if ("error" in result) {
        setAuthError(
          result.error === "{}"
            ? "Couldn't send the verification email. Try again."
            : result.error,
        );
        await signupFeedback.settle("failed");
        return;
      }
      await signupFeedback.settle("saved");
      window.setTimeout(() => {
        if ("verify" in result) {
          submittedCode.current = null;
          requestId.current += 1;
          setPendingEmail(result.email);
          setCode("");
          setVerifyError(null);
          setResendError(null);
          setStage("verify");
          return;
        }
        router.push(result.redirectTo);
        router.refresh();
      }, SAVE_FEEDBACK_SETTLE_MS);
    } catch {
      setAuthError("Couldn't send the verification email. Try again.");
      await signupFeedback.settle("failed");
    }
  }

  async function resend() {
    if (!pendingEmail || resendFeedback.state !== "idle") return;

    const request = ++resendRequest.current;
    setResendError(null);
    resendFeedback.start();
    try {
      const result = await resendUntilAccepted(pendingEmail, () => {
        return request === resendRequest.current;
      });
      if (request !== resendRequest.current) return;
      if (!result.ok) {
        setResendError(result.error);
        await resendFeedback.settle("failed");
        return;
      }
      submittedCode.current = null;
      requestId.current += 1;
      setCode("");
      setVerifyError(null);
      await resendFeedback.settle("saved");
    } catch {
      if (request !== resendRequest.current) return;
      setResendError("Couldn't send a new code. Try again.");
      await resendFeedback.settle("failed");
    }
  }

  function goBack() {
    setStage("credentials");
    setVerifyError(null);
    void returnToSignupForm(pendingEmail || form.getValues("email"));
  }

  const resendDisabled = resendFeedback.state !== "idle" || verifying;

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex shrink-0 items-center px-6 pt-6 sm:px-10 lg:px-12">
        <p className="font-lora text-2xl font-medium tracking-tight">Chptr</p>
      </header>
      <div className="flex min-h-0 flex-1 overflow-y-auto px-6 py-8 sm:px-10 lg:px-12">
        <div className="relative m-auto grid w-full max-w-sm items-start overflow-x-clip">
          <SignupStage stage="credentials" active={stage}>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className={cn("w-full", formSpacing.section)}
              >
                <div className="w-full items-start text-left">
                  <h1 className="font-lora text-3xl font-medium tracking-tight">
                    Sign up
                  </h1>
                </div>
                <div className={formSpacing.stack}>
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="block text-sm font-medium">
                          Email
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="Email" type="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="block text-sm font-medium">
                          Password
                        </FormLabel>
                        <FormControl>
                          <PasswordInput placeholder="Password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="block text-sm font-medium">
                          Confirm Password
                        </FormLabel>
                        <FormControl>
                          <PasswordInput
                            placeholder="Confirm Password"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {authError ? (
                    <div className="text-sm text-red-600">{authError}</div>
                  ) : null}
                </div>
                <div className={formSpacing.stack}>
                  <Button
                    type="submit"
                    className="w-full py-2 text-sm font-medium disabled:opacity-100"
                    disabled={signupFeedback.state !== "idle"}
                  >
                    <SaveFeedbackLabel
                      state={signupFeedback.state}
                      idleLabel="Create account"
                      savingLabel="Creating account"
                      savedLabel="Account created"
                    />
                  </Button>
                  <div className="w-full items-start text-left text-sm text-muted-foreground">
                    Already have an account?{" "}
                    <Link
                      href="/login"
                      className="text-primary hover:underline"
                    >
                      Log in
                    </Link>
                  </div>
                </div>
              </form>
            </Form>
          </SignupStage>

          <SignupStage stage="verify" active={stage}>
            <div className="w-full space-y-8 text-left">
              <div className="space-y-4">
                <h1 className="font-lora text-3xl font-medium tracking-tight">
                  Check your email
                </h1>
                <p className="break-words text-base leading-6 text-muted-foreground">
                  {[
                    "We've sent a six-digit verification code to ",
                    <span key="email" className="font-medium text-foreground">
                      {pendingEmail}
                    </span>,
                    ".",
                  ]}
                </p>
              </div>
              <div className="space-y-3">
                <VerificationCodeInput
                  value={code}
                  onChange={setCode}
                  disabled={verifying}
                  invalid={Boolean(verifyError)}
                  errorId={verifyError ? "signup-code-error" : undefined}
                  autoFocus={stage === "verify"}
                />
                {verifying ? (
                  <p
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                    aria-live="polite"
                  >
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Checking code
                  </p>
                ) : null}
                {verifyError ? (
                  <p
                    id="signup-code-error"
                    role="alert"
                    className="text-sm text-destructive"
                  >
                    {verifyError}
                  </p>
                ) : null}
              </div>
              <div className="space-y-5">
                <div className="space-y-2">
                  <p className="text-sm leading-5 text-muted-foreground">
                    Didn&apos;t receive the code?
                  </p>
                  <Button
                    type="button"
                    variant="ghostText"
                    className="h-auto w-fit justify-start py-0 text-sm font-medium leading-5 text-foreground underline-offset-4 hover:underline focus-visible:ring-offset-2 disabled:opacity-100"
                    disabled={resendDisabled}
                    onClick={() => {
                      void resend();
                    }}
                  >
                    <SaveFeedbackLabel
                      state={resendFeedback.state}
                      idleLabel="Resend code"
                      savingLabel="Sending"
                      savedLabel="Sent"
                    />
                  </Button>
                  {resendError ? (
                    <p role="alert" className="text-sm text-destructive">
                      {resendError}
                    </p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="ghostText"
                  className="h-auto w-fit justify-start py-0 text-sm font-medium leading-5 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-offset-2"
                  disabled={verifying}
                  onClick={goBack}
                >
                  Back
                </Button>
              </div>
            </div>
          </SignupStage>
        </div>
      </div>
    </div>
  );
}

/** Supabase often refuses a resend for a few seconds. Wait that out and try again without leaving the spinner. */
const RESEND_ATTEMPTS = 3;

type ResendCodeResult =
  | { ok: true }
  | { ok: false; error: string; retryAfterSeconds: number | null };

async function resendUntilAccepted(
  email: string,
  isCurrent: () => boolean,
): Promise<ResendCodeResult> {
  let result = await requestResendCode(email);
  for (let attempt = 1; attempt < RESEND_ATTEMPTS; attempt++) {
    if (result.ok || !result.retryAfterSeconds || !isCurrent()) return result;
    const waitMs = result.retryAfterSeconds * 1000;
    await new Promise((resolve) => window.setTimeout(resolve, waitMs));
    if (!isCurrent()) return result;
    result = await requestResendCode(email);
  }
  return result;
}

async function requestResendCode(email: string): Promise<ResendCodeResult> {
  const raw: unknown = await resendSignupCode(email);
  if (
    !raw ||
    typeof raw !== "object" ||
    !("ok" in raw) ||
    (raw.ok !== true && raw.ok !== false)
  ) {
    return {
      ok: false,
      error: "Couldn't send a new code. Try again.",
      retryAfterSeconds: null,
    };
  }
  if (raw.ok === true) return { ok: true };
  return {
    ok: false,
    error:
      "error" in raw && typeof raw.error === "string"
        ? raw.error
        : "Couldn't send a new code. Try again.",
    retryAfterSeconds:
      "retryAfterSeconds" in raw &&
      (raw.retryAfterSeconds === null ||
        typeof raw.retryAfterSeconds === "number")
        ? raw.retryAfterSeconds
        : null,
  };
}

function SignupStage({
  stage,
  active,
  children,
}: {
  stage: PendingSignupStage;
  active: PendingSignupStage;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const delta = STAGE_INDEX[stage] - STAGE_INDEX[active];
  const inactive = delta !== 0;
  const transition = (
    reduceMotion ? { duration: 0 } : inactive ? STEP_LEAVE : STEP_ENTER
  ) as {
    duration: number;
    delay?: number;
    ease?: [number, number, number, number];
  };

  return (
    <motion.div
      initial={false}
      animate={{
        opacity: inactive ? 0 : 1,
        x: reduceMotion || !inactive ? 0 : delta * STEP_SLIDE_PX,
        y: 0,
      }}
      transition={transition}
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
