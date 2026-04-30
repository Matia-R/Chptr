import AccountForm from './account-form'
import { createClient } from '../../utils/supabase/server'

export default async function Account() {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    let initialUsername = ''
    let initialFirstName = ''
    let initialLastName = ''
    if (user) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('username, first_name, last_name')
            .eq('id', user.id)
            .maybeSingle()
        if (profile) {
            initialUsername = typeof profile.username === 'string' ? profile.username : ''
            initialFirstName = typeof profile.first_name === 'string' ? profile.first_name : ''
            initialLastName = typeof profile.last_name === 'string' ? profile.last_name : ''
        }
    }

    return (
        <div>
            <h1>Account: {user?.email}</h1>
            <AccountForm
                user={user}
                initialEmail={user?.email ?? ''}
                initialUsername={initialUsername}
                initialFirstName={initialFirstName}
                initialLastName={initialLastName}
            />
            <div>
                <form action="/auth/signout" method="post">
                    <button className="button block" type="submit">
                        Sign out
                    </button>
                </form>
            </div>
        </div>
    )
}