import AccountForm from './account-form'
import { createClient } from '../../utils/supabase/server'

export default async function Account() {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    return (
        <div>
            <h1>Account: {user?.email}</h1>
            <AccountForm user={user} />
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