"use client"

import { signup } from './actions'
import { ThemeToggle } from '../_components/theme-toggle'
import { Button } from '../_components/button'
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from 'zod'
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "../_components/form"
import { Input } from "../_components/input"

const formSchema = z.object({
    email: z
        .string()
        .min(2, { message: "Email must be at least 2 characters" })
        .max(50)
        .email({ message: "Must be a valid email address" }),
    password: z.string().min(8, { message: "Password must be at least 8 characters" }),
    confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
});

export default function SignUpPage() {

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            email: "",
            password: "",
            confirmPassword: "",
        },
    })

    async function onSubmit(values: z.infer<typeof formSchema>) {
        // Do something with the form values.
        // ✅ This will be type-safe and validated.
        console.log(values)

        try {
            // Convert plain object to FormData
            const formData = new FormData();
            formData.append('email', values.email);
            formData.append('password', values.password);

            // Call the login server action with FormData
            await signup(formData);

            console.log("Signup successful");
        } catch (error) {
            console.error("Signup failed:", error);
        }
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen px-4">
            <Form {...form}>
                <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-6 w-full max-w-sm"
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
                                    This is your public display name.
                                </FormDescription>
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
                                    <Input type="password" placeholder="Password" {...field} />
                                </FormControl>
                                <FormDescription className="text-sm text-gray-500">
                                    Your password.
                                </FormDescription>
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
                                    <Input type="password" placeholder="Confirm Password" {...field} />
                                </FormControl>
                                <FormDescription className="text-sm text-gray-500">
                                    Please confirm your password.
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <Button
                        type="submit"
                        className="w-full py-2 text-sm font-medium"
                    >
                        Submit
                    </Button>
                </form>
            </Form>
            <div className="mt-6">
                <ThemeToggle />
            </div>
        </div>

    );
}
