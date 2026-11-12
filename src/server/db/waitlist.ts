import "server-only";

import { createServiceClient } from "~/utils/supabase/service";

const UNIQUE_VIOLATION = "23505";

/**
 * Stores one normalized address in `waitlist_signups`. An address that is
 * already there is reported as such, not treated as a failure.
 */
export async function addWaitlistSignup(
  email: string,
): Promise<"joined" | "already_joined"> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("waitlist_signups").insert({ email });

  if (!error) return "joined";
  if (error.code === UNIQUE_VIOLATION) return "already_joined";
  throw new Error(`Waitlist insert failed: ${error.message}`);
}
