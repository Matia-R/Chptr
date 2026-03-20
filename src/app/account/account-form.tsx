"use client";

import type { User } from "@supabase/supabase-js";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { updateProfile } from "./actions";
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

const formSchema = z.object({
  email: z
    .string()
    .min(2, { message: "Email must be at least 2 characters" })
    .max(50)
    .email({ message: "Must be a valid email address" }),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" }),
  username: z
    .string()
    .trim()
    .max(50, { message: "Username must be at most 50 characters" })
    .refine((s) => s.length === 0 || s.length >= 2, {
      message: "Username must be at least 2 characters when provided",
    }),
  first_name: z.string().max(100).optional().default(""),
  last_name: z.string().max(100).optional().default(""),
});

interface AccountFormProps {
  user: User | null;
  initialEmail?: string;
  initialUsername?: string;
  initialFirstName?: string;
  initialLastName?: string;
}

export default function AccountForm({
  user: _user,
  initialEmail = "",
  initialUsername = "",
  initialFirstName = "",
  initialLastName = "",
}: AccountFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: initialEmail,
      password: "",
      username: initialUsername,
      first_name: initialFirstName,
      last_name: initialLastName,
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const formData = new FormData();
      formData.append("email", values.email);
      formData.append("password", values.password);
      formData.append("username", values.username);
      formData.append("first_name", values.first_name ?? "");
      formData.append("last_name", values.last_name ?? "");

      await updateProfile(formData);
      console.log("Profile updated successfully");
    } catch (error) {
      console.error("Profile update failed:", error);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="w-full max-w-sm space-y-6"
        >
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
                <FormDescription className="text-sm text-gray-500">
                  Your email address.
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
                  Username (optional)
                </FormLabel>
                <FormControl>
                  <Input placeholder="Username" {...field} />
                </FormControl>
                <FormDescription className="text-sm text-gray-500">
                  If set, your public docs use <span className="font-mono">/[username]/…</span>.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="first_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="block text-sm font-medium">
                  First name
                </FormLabel>
                <FormControl>
                  <Input placeholder="First name" {...field} />
                </FormControl>
                <FormDescription className="text-sm text-gray-500">
                  Used for public URLs when username is not set (with last name).
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="last_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="block text-sm font-medium">
                  Last name
                </FormLabel>
                <FormControl>
                  <Input placeholder="Last name" {...field} />
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
                <FormDescription className="text-sm text-gray-500">
                  Your new password.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full py-2 text-sm font-medium">
            Update Profile
          </Button>
        </form>
      </Form>
    </div>
  );
}
