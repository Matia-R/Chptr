'use server'

import { createClient } from "~/utils/supabase/server"

export async function getUserEmail() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    console.log("User: ", user)
    return user?.email ?? null
} 