"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
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
import { formSpacing } from "~/lib/form-spacing";
import { cn } from "~/lib/utils";

import { signup } from "./actions";

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

export default function SignUpPage() {
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const form = useForm<SignupValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: SignupValues) {
    setAuthError(null);
    const formData = new FormData();
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

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className={cn("w-full max-w-sm", formSpacing.section)}
        >
          <div
            className={cn("w-full items-start text-left", formSpacing.tight)}
          >
            <h1 className="text-2xl font-bold">Signup</h1>
            <p className="text-sm text-muted-foreground">
              You&apos;ll choose your author name and handle after confirming
              your email.
            </p>
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
              disabled={isLoading}
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
