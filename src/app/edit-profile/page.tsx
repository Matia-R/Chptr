'use client'

import { editProfile, skipProfileEdit } from './actions'
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
import { Textarea } from "../_components/textarea"
import { type User } from '@supabase/supabase-js'

const formSchema = z.object({
    username: z
        .string()
        .min(2, { message: "Username must be at least 2 characters" })
        .max(50)
        .regex(/^[a-zA-Z0-9_]+$/, {
            message: "Username can only contain letters, numbers and underscores",
        }),
    bio: z
        .string()
        .max(160, { message: "Bio must be less than 160 characters" })
        .optional(),
})

type FormValues = z.infer<typeof formSchema>

interface EditProfilePageProps {
    user?: User | null;
    profile?: {
        username?: string;
        bio?: string;
    };
}

export default function EditProfilePage({ user, profile }: EditProfilePageProps) {
    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            username: profile?.username ?? "",
            bio: profile?.bio ?? "",
        },
    })

    async function onSubmit(data: FormValues) {
        const formData = new FormData()
        formData.append('username', data.username)
        if (data.bio) formData.append('bio', data.bio)
        await editProfile(formData)
    }

    return (
        <div className="container max-w-2xl mx-auto p-6">
            <div className="mb-8">
                <h1 className="text-2xl font-bold mb-2">Edit your profile</h1>
                <p className="text-muted-foreground">
                    Customize how others see you on the platform
                </p>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                        control={form.control}
                        name="username"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Username</FormLabel>
                                <FormControl>
                                    <Input placeholder="johndoe" {...field} />
                                </FormControl>
                                <FormDescription>
                                    This is your public username
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="bio"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Bio</FormLabel>
                                <FormControl>
                                    <Textarea
                                        placeholder="Tell us about yourself"
                                        className="resize-none"
                                        {...field}
                                    />
                                </FormControl>
                                <FormDescription>
                                    Brief description for your profile
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <div className="flex gap-4">
                        <Button type="submit">Save profile</Button>
                        <Button
                            type="button"
                            variant="outline"
                            formAction={skipProfileEdit}
                        >
                            Skip for now
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    )
} 