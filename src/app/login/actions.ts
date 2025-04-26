'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '../../utils/supabase/server'
import { getTrpcCaller } from '~/utils/trpc-utils'

export async function login(formData: FormData) {
    const supabase = await createClient()

    // type-casting here for convenience
    // in practice, you should validate your inputs
    const data = {
        email: formData.get('email') as string,
        password: formData.get('password') as string,
    }

    const { error } = await supabase.auth.signInWithPassword(data)

    if (error) {
        redirect('/error')
    }

    // Get the user's documents using TRPC
    const caller = await getTrpcCaller();
    const result = await caller.document.getDocumentIdsForAuthenticatedUser();

    revalidatePath('/', 'layout')

    // Redirect to the first document if available, otherwise go to documents page
    if (result.success && result.documents?.[0]?.id) {
        redirect(`/documents/${result.documents[0].id}`)
    } else {
        redirect('/documents')
    }
}

export async function signup(formData: FormData) {
    const supabase = await createClient()

    // type-casting here for convenience
    // in practice, you should validate your inputs
    const data = {
        email: formData.get('email') as string,
        password: formData.get('password') as string,
    }

    const { error } = await supabase.auth.signUp(data)

    if (error) {
        redirect('/error')
    }

    revalidatePath('/', 'layout')
    redirect('/documents')
}