'use server'

import { createClient } from '~/utils/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function editProfile(formData: FormData) {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
        redirect('/login')
    }

    console.log(user.id)

    const username = formData.get('username') as string || user.email?.split('@')[0]
    const bio = formData.get('bio') as string || ''

    const { error } = await supabase
        .from('profiles')
        .upsert({
            id: user.id,
            username,
            bio
        })

    if (error) redirect('/error')

    revalidatePath('/account')
    redirect('/account')
}

export async function skipProfileEdit() {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
        redirect('/login')
    }

    const { error } = await supabase
        .from('profiles')
        .upsert({
            id: user.id,
            username: user.email?.split('@')[0],
            updated_at: new Date().toISOString(),
        })

    if (error) redirect('/error')

    revalidatePath('/account')
    redirect('/account')
} 