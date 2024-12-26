'use client'

import { updateProfile } from './actions'
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
import { PasswordInput } from "../_components/password-input"
import { User } from '@supabase/supabase-js'

const formSchema = z.object({
    email: z
        .string()
        .min(2, { message: "Email must be at least 2 characters" })
        .max(50)
        .email({ message: "Must be a valid email address" }),
    password: z.string().min(8, { message: "Password must be at least 8 characters" }),
    username: z.string().min(2, { message: "Username must be at least 2 characters" }).max(50),
})

interface AccountFormProps {
    user: User | null
}

export default function AccountForm({ user }: AccountFormProps) {
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            email: "",
            password: "",
            username: "",
        },
    })

    async function onSubmit(values: z.infer<typeof formSchema>) {
        try {
            const formData = new FormData()
            formData.append('email', values.email)
            formData.append('password', values.password)
            formData.append('username', values.username)

            await updateProfile(formData)
            console.log("Profile updated successfully")
        } catch (error) {
            console.error("Profile update failed:", error)
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
                                    Username
                                </FormLabel>
                                <FormControl>
                                    <Input placeholder="Username" {...field} />
                                </FormControl>
                                <FormDescription className="text-sm text-gray-500">
                                    Your public display name.
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
                                    <PasswordInput placeholder="Password" {...field} />
                                </FormControl>
                                <FormDescription className="text-sm text-gray-500">
                                    Your new password.
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <Button
                        type="submit"
                        className="w-full py-2 text-sm font-medium"
                    >
                        Update Profile
                    </Button>
                </form>
            </Form>
        </div>
    )
}