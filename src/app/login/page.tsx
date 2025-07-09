"use client"

import { login } from './actions'
import { Button } from '../_components/button'
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from 'zod'
import { useState } from 'react'
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "../_components/form"
import { Input } from "../_components/input"
import { PasswordInput } from "../_components/password-input"
import { useRouter } from 'next/navigation'

const formSchema = z.object({
    email: z
        .string()
        .min(2, { message: "Email must be at least 2 characters" })
        .max(50)
        .email({ message: "Must be a valid email address" }),
    password: z.string().min(8, { message: "Password must be at least 8 characters" }),
})

export default function LoginPage() {
    const [authError, setAuthError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const router = useRouter()
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            email: "",
            password: "",
        },
    })

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setAuthError(null) // Clear any previous errors

        const formData = new FormData();
        formData.append('email', values.email);
        formData.append('password', values.password);

        setIsLoading(true)

        const result = await login(formData);

        setIsLoading(false)

        if (result?.error) {
            setAuthError(result.error)
        } else {
            router.push(result.redirectTo!)
        }
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen px-4">
            <Form {...form}>
                <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-6 w-full max-w-sm"
                    autoComplete="on"
                    method="POST"
                >
                    <div className="items-start w-full text-left mb-6">
                        <h1 className="text-2xl font-bold">Login</h1>
                    </div>
                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel htmlFor="email" className="block text-sm font-medium">
                                    Email
                                </FormLabel>
                                <FormControl>
                                    <Input
                                        placeholder="Email"
                                        {...field}
                                        onChange={(e) => {
                                            field.onChange(e);
                                            setAuthError(null);
                                        }}
                                        type="email"
                                        name="email"
                                        autoComplete="username"
                                    />
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
                                <FormLabel htmlFor="password" className="block text-sm font-medium">
                                    Password
                                </FormLabel>
                                <FormControl>
                                    <PasswordInput
                                        placeholder="Password"
                                        {...field}
                                        onChange={(e) => {
                                            field.onChange(e);
                                            setAuthError(null);
                                        }}
                                        name="password"
                                        id="password"
                                        autoComplete="current-password"
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    {authError && (
                        <div className="text-sm text-red-600">
                            {authError}
                        </div>
                    )}
                    <Button
                        type="submit"
                        className="w-full py-2 text-sm font-medium"
                        disabled={isLoading}
                    >
                        Login
                    </Button>
                    <div className="items-start w-full mt-6 text-left text-sm text-muted-foreground">
                        Don&apos;t have an account?{" "}
                        <a href="/signup" className="text-primary hover:underline">
                            Sign up
                        </a>
                    </div>
                </form>
            </Form>
            {/* <div className="flex flex-col items-start">
                <div className="items-start w-full mt-6 text-left text-sm text-muted-foreground">
                    Don&apos;t have an account?{" "}
                    <a href="/signup" className="text-primary hover:underline">
                        Sign up
                    </a>
                </div>
            </div> */}
        </div>

    );
}
