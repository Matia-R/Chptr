"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "../_components/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../_components/form";
import { Input } from "../_components/input";
import { PasswordInput } from "../_components/password-input";
import { UsernameAvailabilityFeedback } from "~/app/_components/account-settings/username-availability-feedback";
import { signupProfileSchema } from "~/lib/account-schema";
import { formSpacing } from "~/lib/form-spacing";
import { publicHandleUrl } from "~/lib/public-url";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

import { signup } from "./actions";

const HANDLE_PLACEHOLDER = "janemitchell";

const formSchema = signupProfileSchema
  .extend({
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

export default function SignUpPage() {
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [handleTouched, setHandleTouched] = useState(false);
  const form = useForm<SignupValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      author_name: "",
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const authorName = form.watch("author_name");
  const handle = form.watch("username");
  const [debouncedAuthorName, setDebouncedAuthorName] = useState(authorName);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebouncedAuthorName(authorName);
    }, 400);
    return () => window.clearTimeout(id);
  }, [authorName]);

  const suggestion = api.user.suggestSignupHandle.useQuery(
    { authorName: debouncedAuthorName.trim() },
    {
      enabled: debouncedAuthorName.trim().length > 0 && !handleTouched,
      staleTime: 30_000,
    },
  );

  useEffect(() => {
    if (handleTouched) return;
    if (debouncedAuthorName.trim().length === 0) {
      form.setValue("username", "", {
        shouldDirty: false,
        shouldValidate: false,
      });
      return;
    }
    const next = suggestion.data?.handle;
    if (!next) return;
    form.setValue("username", next, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }, [debouncedAuthorName, form, handleTouched, suggestion.data?.handle]);

  const trimmedHandle = handle.trim();
  const shouldCheckHandle = /^[a-zA-Z0-9_-]{2,50}$/.test(trimmedHandle);
  const debouncedMatches = debouncedAuthorName === authorName;
  const availability = api.user.checkSignupHandle.useQuery(
    { username: trimmedHandle },
    {
      enabled: shouldCheckHandle,
      staleTime: 30_000,
    },
  );
  const availabilityStatus = !shouldCheckHandle
    ? "idle"
    : availability.isFetching || availability.isPending
      ? "checking"
      : availability.isSuccess
        ? availability.data.available
          ? "available"
          : availability.data.reason === "reserved"
            ? "reserved"
            : "taken"
        : "idle";
  const handleBlocked =
    availabilityStatus === "checking" ||
    availabilityStatus === "taken" ||
    availabilityStatus === "reserved";
  const suggestionPending =
    !handleTouched &&
    authorName.trim().length > 0 &&
    trimmedHandle.length === 0 &&
    (!debouncedMatches || suggestion.isFetching);

  async function onSubmit(values: SignupValues) {
    if (handleBlocked || suggestionPending) return;

    setAuthError(null);
    const formData = new FormData();
    formData.append("authorName", values.author_name);
    formData.append("username", values.username);
    formData.append("email", values.email);
    formData.append("password", values.password);

    setIsLoading(true);
    try {
      const result = await signup(formData);
      if (result?.error) {
        setAuthError(result.error);
      }
    } finally {
      setIsLoading(false);
    }
  }

  const urlPreview = publicHandleUrl(
    trimmedHandle.length > 0 ? trimmedHandle : HANDLE_PLACEHOLDER,
  );

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className={cn("w-full max-w-sm", formSpacing.section)}
        >
          <div className="w-full items-start text-left">
            <h1 className="text-2xl font-bold">Signup</h1>
          </div>
          <div className={formSpacing.stack}>
            <FormField
              control={form.control}
              name="author_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="block text-sm font-medium">
                    Author name
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Jane Mitchell"
                      autoComplete="name"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    The name displayed on your published articles. You can use a
                    pen name.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="block text-sm font-medium">
                    Handle
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder={HANDLE_PLACEHOLDER}
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      {...field}
                      onChange={(event) => {
                        const next = event.target.value;
                        setHandleTouched(next.trim().length > 0);
                        field.onChange(event);
                        setAuthError(null);
                      }}
                    />
                  </FormControl>
                  <FormDescription className="font-mono">
                    {urlPreview}
                  </FormDescription>
                  {availabilityStatus === "idle" ? null : (
                    <UsernameAvailabilityFeedback status={availabilityStatus} />
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="block text-sm font-medium">
                    Email
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="Email" {...field} />
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
                    <PasswordInput placeholder="Confirm Password" {...field} />
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
              className="w-full py-2 text-sm font-medium"
              disabled={isLoading || handleBlocked || suggestionPending}
            >
              Submit
            </Button>
            <div className="w-full items-start text-left text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="text-primary hover:underline">
                Login
              </Link>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
