"use client";

import type { User } from "@supabase/supabase-js";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { authorNameSchema, usernameSchema } from "~/lib/account-schema";
import { publicHandleUrl } from "~/lib/public-url";

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
import { formSpacing } from "~/lib/form-spacing";
import { cn } from "~/lib/utils";

const formSchema = z.object({
  email: z
    .string()
    .min(2, { message: "Email must be at least 2 characters" })
    .max(50)
    .email({ message: "Must be a valid email address" }),
  username: usernameSchema,
  author_name: authorNameSchema,
});

interface AccountFormProps {
  user: User | null;
  initialEmail?: string;
  initialUsername?: string;
  initialAuthorName?: string;
}

export default function AccountForm({
  user: _user,
  initialEmail = "",
  initialUsername = "",
  initialAuthorName = "",
}: AccountFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: initialEmail,
      username: initialUsername,
      author_name: initialAuthorName,
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const formData = new FormData();
      formData.append("email", values.email);
      formData.append("username", values.username);
      formData.append("author_name", values.author_name ?? "");

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
          className={cn("w-full max-w-sm", formSpacing.section)}
        >
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
                    Handle (optional)
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="janemitchell" {...field} />
                  </FormControl>
                  <FormDescription className="text-sm text-gray-500">
                    If set, your public articles live at{" "}
                    <span className="font-mono">
                      {publicHandleUrl("your-handle")}
                    </span>
                    .
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
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
                  <FormDescription className="text-sm text-gray-500">
                    The name displayed on your published articles. You can use a
                    pen name.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <Button type="submit" className="w-full py-2 text-sm font-medium">
            Update Profile
          </Button>
        </form>
      </Form>
    </div>
  );
}
