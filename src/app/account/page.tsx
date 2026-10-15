import AccountForm from "./account-form";
import { authorDisplayName } from "~/lib/published-author";
import { createClient } from "../../utils/supabase/server";

export default async function Account() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let initialUsername = "";
  let initialAuthorName = "";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, author_name, first_name, last_name")
      .eq("id", user.id)
      .maybeSingle();
    if (profile) {
      initialUsername =
        typeof profile.username === "string" ? profile.username : "";
      initialAuthorName =
        authorDisplayName({
          author_name:
            typeof profile.author_name === "string"
              ? profile.author_name
              : null,
          first_name:
            typeof profile.first_name === "string" ? profile.first_name : null,
          last_name:
            typeof profile.last_name === "string" ? profile.last_name : null,
          username: null,
        }) ?? "";
    }
  }

  return (
    <div>
      <h1>Account: {user?.email}</h1>
      <AccountForm
        user={user}
        initialEmail={user?.email ?? ""}
        initialUsername={initialUsername}
        initialAuthorName={initialAuthorName}
      />
      <div>
        <form action="/auth/signout" method="post">
          <button className="button block" type="submit">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
