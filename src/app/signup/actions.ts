'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '../../utils/supabase/server'
import { getRandomAvatarColor } from '../../lib/avatar-colors'

/** Postgres / PostgREST messages when `profiles_username_*` unique index fires (e.g. from `handle_new_user`). */
function isProfilesUsernameUniqueViolation(message: string): boolean {
    const m = message.toLowerCase()
    return (
        m.includes('profiles_username_lower_unique') ||
        m.includes('profiles_username') ||
        (m.includes('duplicate key') && m.includes('username')) ||
        (m.includes('unique constraint') && m.includes('username')) ||
        (m.includes('violates unique constraint') && m.includes('username'))
    )
}

export async function signup(formData: FormData) {
    const supabase = await createClient()

    const username = ((formData.get('username') as string) ?? '').trim()
    const userMeta: Record<string, string> = {
        first_name: formData.get('firstName') as string,
        last_name: formData.get('lastName') as string,
        default_avatar_background_color: getRandomAvatarColor(),
    }
    if (username) {
        userMeta.username = username
    }

    const data = {
        email: formData.get('email') as string,
        password: formData.get('password') as string,
        options: {
            data: userMeta,
        },
    }

    const { data: signUpData, error } = await supabase.auth.signUp(data)

    if (error) {
        const authErr = error.message ?? ''
        if (isProfilesUsernameUniqueViolation(authErr)) {
            return { error: 'This username is already taken. Try a different one.' }
        }
        return { error: authErr || 'Sign up failed' }
    }

    if (signUpData.user && signUpData.session) {
        const { error: profileError } = await supabase.from('profiles').upsert({
            id: signUpData.user.id,
            username: username || null,
            updated_at: new Date().toISOString(),
        })
        if (profileError) {
            const pe = profileError.message ?? ''
            if (isProfilesUsernameUniqueViolation(pe)) {
                return { error: 'This username is already taken. Try a different one.' }
            }
            console.log(profileError)
            return { error: pe || 'Could not update profile' }
        }
    }

    revalidatePath('/', 'layout')
    redirect('/confirm-signup')
}