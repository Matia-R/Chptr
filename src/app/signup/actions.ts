'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '../../utils/supabase/server'

export async function signup(formData: FormData) {
    const supabase = await createClient()

    const data = {
        email: formData.get('email') as string,
        password: formData.get('password') as string,
        options: {
            data: {
                first_name: formData.get('firstName') as string,
                last_name: formData.get('lastName') as string,
                default_avatar_background_color: `${['blue', 'green', 'red', 'yellow', 'purple', 'pink', 'indigo'][Math.floor(Math.random() * 7)]}`
            }
        }
    }

    const { error } = await supabase.auth.signUp(data)

    if (error) {
        console.log(error)
        redirect('/error')
    }

    revalidatePath('/', 'layout')
    redirect('/confirm-signup')
}