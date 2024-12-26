'use server'

import { createClient } from '~/utils/supabase/server'
// import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

export async function updateProfile(formData: FormData) {
    // const cookieStore = cookies()
    const supabase = await createClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) throw new Error('Not authenticated')

    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const username = formData.get('username') as string

    try {
        if (email !== user.email) {
            const { error } = await supabase.auth.updateUser({ email })
            if (error) throw error
        }

        if (password) {
            const { error } = await supabase.auth.updateUser({ password })
            if (error) throw error
        }

        const { error } = await supabase
            .from('profiles')
            .upsert({
                id: user.id,
                username,
                updated_at: new Date().toISOString(),
            })

        if (error) throw error

        revalidatePath('/account')
        return { success: true }
    } catch (error) {
        return { error: 'Error updating profile' }
    }
} 