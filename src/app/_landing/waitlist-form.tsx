"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "~/app/_components/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/app/_components/form";
import { Input } from "~/app/_components/input";
import {
  SAVE_FEEDBACK_CONTENT_TRANSITION,
  SaveFeedbackLabel,
} from "~/app/_components/save-feedback-label";
import {
  SAVE_FEEDBACK_SETTLE_MS,
  useSaveFeedback,
} from "~/hooks/use-save-feedback";
import { formSpacing } from "~/lib/form-spacing";
import { cn } from "~/lib/utils";
import { waitlistEmailSchema } from "~/lib/waitlist";

import { joinWaitlist } from "./waitlist-actions";

const formSchema = z.object({ email: waitlistEmailSchema });

type WaitlistValues = z.infer<typeof formSchema>;

type Confirmation = { email: string; alreadyJoined: boolean };

const SUBMIT_FAILED = "Couldn't add you to the list. Try again.";

export function WaitlistForm() {
  const feedback = useSaveFeedback();
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const honeypotRef = useRef<HTMLInputElement>(null);
  const form = useForm<WaitlistValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: WaitlistValues) {
    feedback.start();
    try {
      const result = await joinWaitlist({
        email: values.email,
        subject: honeypotRef.current?.value ?? "",
      });

      if ("error" in result) {
        form.setError("email", { message: result.error });
        await feedback.settle("failed");
        return;
      }

      await feedback.settle("saved");
      feedback.runAfterResult(() => {
        setConfirmation({
          email: values.email,
          alreadyJoined: result.status === "already_joined",
        });
      }, SAVE_FEEDBACK_SETTLE_MS);
    } catch {
      form.setError("email", { message: SUBMIT_FAILED });
      await feedback.settle("failed");
    }
  }

  return (
    // Tall enough for the form plus an error line, so the swap does not move the page.
    <div className="min-h-[6.5rem]">
      <AnimatePresence mode="wait" initial={false}>
        {confirmation ? (
          <motion.div
            key="confirmation"
            role="status"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={SAVE_FEEDBACK_CONTENT_TRANSITION}
            className={formSpacing.tight}
          >
            <p className="flex items-center gap-2 text-lg font-medium">
              <Check className="size-5 shrink-0" aria-hidden />
              {confirmation.alreadyJoined
                ? "You're already on the list."
                : "You're on the list."}
            </p>
            <p className="text-muted-foreground">
              We&apos;ll email{" "}
              <span className="break-all text-foreground">
                {confirmation.email}
              </span>{" "}
              when early access opens.
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            exit={{ opacity: 0 }}
            transition={SAVE_FEEDBACK_CONTENT_TRANSITION}
            className={formSpacing.stack}
          >
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="sr-only">Email address</FormLabel>
                      <div
                        className={cn(
                          "flex flex-col sm:flex-row",
                          formSpacing.tightGap,
                        )}
                      >
                        <FormControl>
                          <Input
                            {...field}
                            type="email"
                            inputMode="email"
                            autoComplete="email"
                            autoCapitalize="none"
                            spellCheck={false}
                            placeholder="you@example.com"
                            className="h-11 min-w-0 px-3.5 sm:flex-1 md:text-base"
                          />
                        </FormControl>
                        <Button
                          type="submit"
                          className="h-11 shrink-0 px-5 disabled:opacity-100 sm:w-44"
                          disabled={feedback.state !== "idle"}
                        >
                          <SaveFeedbackLabel
                            state={feedback.state}
                            idleLabel="Join the waitlist"
                            savingLabel="Joining"
                            savedLabel="You're in"
                          />
                        </Button>
                      </div>
                      <FormMessage role="alert" />
                    </FormItem>
                  )}
                />
                {/* Honeypot. Hidden from people and assistive tech; bots fill it. */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute -left-[9999px] h-0 w-0 overflow-hidden"
                >
                  <label>
                    Leave this field empty
                    <input
                      ref={honeypotRef}
                      type="text"
                      name="subject"
                      tabIndex={-1}
                      autoComplete="off"
                    />
                  </label>
                </div>
              </form>
            </Form>
            <p className="text-sm text-muted-foreground">
              Early access coming soon.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
