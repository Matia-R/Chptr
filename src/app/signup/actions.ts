'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '../../utils/supabase/server'
import { getRandomAvatarColor } from '../../lib/avatar-colors'

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
        console.log(error)
        redirect('/error')
    }

    if (signUpData.user && signUpData.session) {
        const { error: profileError } = await supabase.from('profiles').upsert({
            id: signUpData.user.id,
            username: username || null,
            updated_at: new Date().toISOString(),
        })
        if (profileError) {
            console.log(profileError)
        }
    }

    revalidatePath('/', 'layout')
    redirect('/confirm-signup')
}