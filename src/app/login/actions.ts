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

    // TODO: Add logging here for Error Codes so we know when things go wrong
    if (error) {
        switch (error.message) {
            case 'Invalid login credentials':
                return { error: 'Invalid email or password' }
            default:
                return { error: error.message }
        }
    }

    // Get the user's documents using TRPC
    const caller = await getTrpcCaller();
    const result = await caller.document.getDocumentIdsForAuthenticatedUser();

    revalidatePath('/', 'layout')

    // Redirect to the first document if available, otherwise go to documents page
    if (result.success && result.documents?.[0]?.id) {
        return { redirectTo: `/documents/${result.documents[0].id}` }
    } else {
        return { redirectTo: '/documents' }
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