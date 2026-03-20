"use client";

import { signup } from "./actions";
import { Button } from "../_components/button";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
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

const formSchema = z
  .object({
    firstName: z.string().min(1, { message: "First name is required" }),
    lastName: z.string().min(1, { message: "Last name is required" }),
    username: z
      .string()
      .trim()
      .max(50, { message: "Username must be at most 50 characters" })
      .refine((s) => s.length === 0 || s.length >= 2, {
        message: "Username must be at least 2 characters when provided",
      }),
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

export default function SignUpPage() {
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setAuthError(null);
    const formData = new FormData();
    formData.append("firstName", values.firstName);
    formData.append("lastName", values.lastName);
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

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="w-full max-w-sm space-y-6"
        >
          <div className="mb-6 w-full items-start text-left">
            <h1 className="text-2xl font-bold">Signup</h1>
          </div>
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="block text-sm font-medium">
                  First Name
                </FormLabel>
                <FormControl>
                  <Input placeholder="First Name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="block text-sm font-medium">
                  Last Name
                </FormLabel>
                <FormControl>
                  <Input placeholder="Last Name" {...field} />
                </FormControl>
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
                  Username (optional)
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="Username"
                    autoComplete="username"
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      setAuthError(null);
                    }}
                  />
                </FormControl>
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

          <Button
            type="submit"
            className="w-full py-2 text-sm font-medium"
            disabled={isLoading}
          >
            Submit
          </Button>

          <div className="mt-6 w-full items-start text-left text-sm text-muted-foreground">
            Already have an account?{" "}
            <a href="/login" className="text-primary hover:underline">
              Login
            </a>
          </div>
        </form>
      </Form>
    </div>
  );
}
